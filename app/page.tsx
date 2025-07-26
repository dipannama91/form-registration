"use client"
import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { addRegistration, uploadProfilePicture, cropImageToDimensions } from './firebase/services';
import { db } from './firebase/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { User, Mail, Phone, CheckCircle, Upload, Loader, Calendar, Briefcase, GraduationCap, Heart, Fingerprint, BadgeCheck } from 'lucide-react';

// Type definitions
interface FormData {
    fullName: string;
    dob: string;
    gender: string;
    occupation: string;
    education: string;
    aadhaar: string;
    pan: string;
    voterId: string;
    address1: string;
    address2: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    email: string;
    reasonForJoining: string;
    profilePicture: File | null;
}

type FormErrors = {
    [K in keyof FormData]?: string;
};

interface CompressingState {
    profilePicture: boolean,
}

// Extend the Window interface to include the image compression library
declare global {
    interface Window {
        imageCompression: any;
    }
}

// Main App Component
const App: React.FC = () => {
    const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [aadhaarExists, setAadhaarExists] = useState<boolean>(false);
    const [formData, setFormData] = useState<FormData>({
        fullName: '',
        dob: '',
        gender: '',
        occupation: '',
        education: '',
        aadhaar: '',
        pan: '',
        voterId: '',
        address1: '',
        address2: '',
        city: '',
        state: '',
        zip: '',
        phone: '',
        email: '',
        reasonForJoining: '',
        profilePicture: null,
    });
    const [errors, setErrors] = useState<FormErrors>({});
    const [compressing, setCompressing] = useState<CompressingState>({
        profilePicture: false,
    });

    // Effect to load the image compression library script
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js';
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        }
    }, []);

    const handleChange = async (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if ('files' in e.target && e.target.files && e.target.files[0] && name === 'profilePicture') {
            const file = e.target.files[0];
            if (!window.imageCompression) {
                console.error('Image compression library not loaded yet.');
                setErrors(prev => ({ ...prev, [name]: 'Component is loading, please try again.' }));
                return;
            }

            setCompressing(prev => ({ ...prev, [name]: true }));

            const options = {
                maxSizeMB: 0.1, // Max size 100KB
                maxWidthOrHeight: 800,
                useWebWorker: true,
            };

            try {
                const compressedFile = await window.imageCompression(file, options);
                setFormData((prev) => ({ ...prev, [name]: compressedFile }));
                if (errors[name as keyof FormErrors]) {
                    setErrors(prev => ({ ...prev, [name]: undefined }));
                }
            } catch (error) {
                console.error('Error compressing image:', error);
                setErrors(prev => ({ ...prev, [name]: 'Image compression failed. Please try another file.' }));
            } finally {
                setCompressing(prev => ({ ...prev, [name]: false }));
            }
        } else {
            // Enforce max length for specific fields
            let processedValue = value;
            if (name === 'aadhaar' && value.length > 16) {
                processedValue = value.slice(0, 16);
            } else if (name === 'pan' && value.length > 10) {
                processedValue = value.slice(0, 10);
            } else if (name === 'voterId' && value.length > 10) {
                processedValue = value.slice(0, 10);
            }

            setFormData((prev) => ({ ...prev, [name]: processedValue }));
            if (errors[name as keyof FormErrors]) {
                setErrors(prev => ({ ...prev, [name]: undefined }));
            }
        }
    };

    const validateForm = (): boolean => {
        let newErrors: FormErrors = {};
        if (!formData.fullName) newErrors.fullName = 'Full name is required.';
        if (!formData.dob) newErrors.dob = 'Date of birth is required.';
        if (!formData.gender) newErrors.gender = 'Gender is required.';
        if (!formData.occupation) newErrors.occupation = 'Occupation is required.';
        if (!formData.education) newErrors.education = 'Highest qualification is required.';
        if (!formData.aadhaar || !/^\d{16}$/.test(formData.aadhaar)) newErrors.aadhaar = 'A valid 16-digit Aadhaar number is required.';
        if (formData.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan.toUpperCase())) newErrors.pan = 'Please enter a valid PAN number.';
        if (!formData.voterId || !/^[A-Z]{3}[0-9]{7}$/.test(formData.voterId.toUpperCase())) newErrors.voterId = 'A valid 10-character Voter ID is required.';
        if (!formData.address1) newErrors.address1 = 'Permanent address is required.';
        if (!formData.city) newErrors.city = 'City is required.';
        if (!formData.state) newErrors.state = 'State is required.';
        if (formData.zip && !/^\d{6}$/.test(formData.zip)) newErrors.zip = 'Please enter a valid 6-digit Zip Code.';
        if (!formData.phone || !/^\d{10}$/.test(formData.phone)) newErrors.phone = 'A 10-digit phone number is required.';
        if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email.';
        if (!formData.profilePicture) newErrors.profilePicture = 'Profile picture is required.';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        setAadhaarExists(false);
        if (!validateForm()) {
            setIsSubmitting(false);
            return;
        }

        // Check if Aadhaar already exists
        try {
            const q = query(collection(db, 'registrations'), where('aadhaar', '==', formData.aadhaar));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                setAadhaarExists(true);
                setIsSubmitting(false);
                return;
            }
        } catch (err) {
            setErrors(prev => ({ ...prev, aadhaar: 'Error checking Aadhaar. Please try again.' }));
            setIsSubmitting(false);
            return;
        }

        let profilePictureUrl = '';
        try {
            let processedFile = formData.profilePicture;
            // Crop the image to 150x190px if needed
            if (processedFile) {
                const img = new window.Image();
                const url = URL.createObjectURL(processedFile);
                await new Promise((resolve, reject) => {
                    img.onload = () => {
                        if (img.width !== 150 || img.height !== 190) {
                            cropImageToDimensions(processedFile as File, 150, 190).then(cropped => {
                                processedFile = cropped;
                                resolve(null);
                            }).catch(reject);
                        } else {
                            resolve(null);
                        }
                    };
                    img.onerror = reject;
                    img.src = url;
                });
                URL.revokeObjectURL(url);
                profilePictureUrl = await uploadProfilePicture(processedFile, formData.aadhaar || Date.now().toString());
            }
            // Prepare data for Firestore (exclude File object)
            const dataToSubmit = {
                ...formData,
                profilePicture: profilePictureUrl,
                submissionDate: new Date().toISOString(),
            };
            await addRegistration(dataToSubmit);
            setIsSubmitted(true);
        } catch (err) {
            setErrors(prev => ({ ...prev, profilePicture: 'Failed to upload data. Please try again.' }));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReset = () => {
        setIsSubmitted(false);
        setFormData({
            fullName: '', dob: '', gender: '', occupation: '', education: '',
            aadhaar: '', pan: '', voterId: '',
            address1: '', address2: '', city: '',
            state: '', zip: '', phone: '', email: '', reasonForJoining: '',
            profilePicture: null,
        });
        setErrors({});
    };


    return (
        <div className="min-h-screen bg-orange-500/80 font-sans" tabIndex={isSubmitting ? -1 : undefined} style={isSubmitting ? { pointerEvents: 'none', userSelect: 'none' } : {}}>
            <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
            <header className="bg-white shadow-md flex items-center p-2">
                <div className="container mx-auto px-4 py-0 flex items-center space-x-4">
                    <img src="/logo.png" alt="Rudra Foundation Logo" className="w-24 h-24 rounded-full" />
                    <div className="flex flex-col justify-center pt-1" >
                        <h1 className="text-xl -ml-4 md:text-2xl lg:text-3xl leading-8 font-bold text-orange-600">R.U.D.R.A</h1>
                        <p className="text-md -ml-4  text-gray-400">Rising Union for Digital Riders Association</p>
                    </div>

                </div>
            </header>

            <main className="container mx-auto p-4 md:p-8">
                <div className="max-w-4xl mx-auto bg-white p-6 md:p-8 rounded-lg border border-gray-200">
                    {aadhaarExists ? (
                        <div className="text-center text-red-600 text-lg font-semibold py-8">Oops! Seems like You are already Registered.</div>
                    ) : isSubmitted ? (
                        <SuccessView handleReset={handleReset} />
                    ) : (
                        <RegistrationForm
                            formData={formData}
                            errors={errors}
                            compressing={compressing}
                            handleChange={handleChange}
                            handleSubmit={handleSubmit}
                            isSubmitting={isSubmitting}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}

export default App;

// Component Prop Types
interface RegistrationFormProps {
    formData: FormData;
    errors: FormErrors;
    compressing: CompressingState;
    handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
    isSubmitting?: boolean;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ formData, errors, compressing, handleChange, handleSubmit, isSubmitting }) => {
    const occupationOptions = [
        "Private Sector Employee", "Government Employee", "Self-employed/Business",
        "Professional", "Farmer", "Student", "Homemaker", "Retired", "Unemployed", "Other"
    ];

    return (
        <div className="animate-fade-in">
            <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
                <div>
                    <h1 className='text-2xl font-bold flex justify-center text-orange-600'>Registration Form</h1>
                </div>
                <hr className='text-gray-100 w-full '></hr>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Form Fields - Left/Center */}
                    <div className="md:col-span-2 space-y-6">
                        <InputField id="fullName" name="fullName" type="text" placeholder="Full Name" label="Full Name *" value={formData.fullName} onChange={handleChange} error={errors.fullName} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField id="dob" name="dob" type="date" placeholder="" label="Date of Birth *" value={formData.dob} onChange={handleChange} error={errors.dob} />
                            <SelectField id="gender" name="gender" label="Gender *" value={formData.gender} onChange={handleChange} error={errors.gender} options={["Male", "Female", "Other"]} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <SelectField id="occupation" name="occupation" label="Occupation *" value={formData.occupation} onChange={handleChange} error={errors.occupation} options={occupationOptions} />
                            <InputField id="education" name="education" type="text" placeholder="e.g., B.Tech, High School" label="Highest Qualification *" value={formData.education} onChange={handleChange} error={errors.education} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField id="aadhaar" name="aadhaar" type="text" placeholder="16-digit Number" label="Aadhaar Number *" value={formData.aadhaar} onChange={handleChange} error={errors.aadhaar} maxLength={16} />
                            <InputField id="pan" name="pan" type="text" placeholder="10-character PAN" label="PAN Number (Optional)" value={formData.pan} onChange={handleChange} error={errors.pan} maxLength={10} />
                        </div>
                        <InputField id="voterId" name="voterId" type="text" placeholder="10-character Voter ID" label="Voter ID *" value={formData.voterId} onChange={handleChange} error={errors.voterId} maxLength={10} />
                        <InputField id="address1" name="address1" type="text" placeholder="Permanent Address" label="Residential/Permanent Address *" value={formData.address1} onChange={handleChange} error={errors.address1} />
                        <InputField id="address2" name="address2" type="text" placeholder="Current Address" label="Current Address" value={formData.address2} onChange={handleChange} error={errors.address2} />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <InputField id="city" name="city" type="text" placeholder="City" label="City *" value={formData.city} onChange={handleChange} error={errors.city} />
                            <InputField id="state" name="state" type="text" placeholder="State" label="State *" value={formData.state} onChange={handleChange} error={errors.state} />
                            <InputField id="zip" name="zip" type="text" placeholder="Zip Code" label="Zip Code (Optional)" value={formData.zip} onChange={handleChange} error={errors.zip} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField id="phone" name="phone" type="tel" placeholder="Phone Number" label="Phone *" value={formData.phone} onChange={handleChange} error={errors.phone} />
                            <InputField id="email" name="email" type="email" placeholder="Email" label="Email (Optional)" value={formData.email} onChange={handleChange} error={errors.email} />
                        </div>
                        <TextAreaField id="reasonForJoining" name="reasonForJoining" placeholder="Tell us why you want to join our NGO..." label="Reason for Joining" value={formData.reasonForJoining} onChange={handleChange} />
                    </div>

                    {/* Profile Picture Upload - Right */}
                    <div className="md:col-span-1">
                        <ProfileUploadField
                            id="profilePicture"
                            name="profilePicture"
                            file={formData.profilePicture}
                            onChange={handleChange}
                            error={errors.profilePicture}
                            isCompressing={compressing.profilePicture}
                        />
                    </div>
                </div>

                <div className="pt-8 flex justify-center">
                    <button
                        type="submit"
                        className={`w-full md:w-auto px-8 py-3 bg-orange-500 text-white font-semibold rounded-md focus:outline-none focus:ring-4 focus:ring-red-300 transition-colors text-lg ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-800'}`}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Submitting...' : 'Register'}
                    </button>
                </div>
            </form>
        </div>
    );
};

interface InputFieldProps {
    id: string;
    name: string;
    type: string;
    placeholder: string;
    value: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    error?: string;
    label: string;
    maxLength?: number;
}

const InputField: React.FC<InputFieldProps> = ({ id, name, type, placeholder, value, onChange, error, label, maxLength }) => {
    const isRequired = label.endsWith('*');
    const labelText = isRequired ? label.slice(0, -1).trim() : label;

    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
                {labelText}
                {isRequired && <span className="text-red-500"> *</span>}
            </label>
            <input
                type={type}
                id={id}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                maxLength={maxLength}
                className={`w-full px-3 py-2 bg-white border rounded-md text-gray-900 focus:outline-none focus:ring-2 ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'}`}
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
};

interface SelectFieldProps {
    id: string;
    name: string;
    label: string;
    value: string;
    onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
    error?: string;
    options: string[];
}

const SelectField: React.FC<SelectFieldProps> = ({ id, name, label, value, onChange, error, options }) => {
    const isRequired = label.endsWith('*');
    const labelText = isRequired ? label.slice(0, -1).trim() : label;

    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
                {labelText}
                {isRequired && <span className="text-red-500"> *</span>}
            </label>
            <select
                id={id}
                name={name}
                value={value}
                onChange={onChange}
                className={`w-full px-3 py-2 bg-white border rounded-md text-gray-900 focus:outline-none focus:ring-2 ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'}`}
            >
                <option value="" disabled>Select...</option>
                {options.map(option => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
};


interface TextAreaFieldProps {
    id: string;
    name: string;
    placeholder: string;
    value: string;
    onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
    error?: string;
    label: string;
}

const TextAreaField: React.FC<TextAreaFieldProps> = ({ id, name, placeholder, value, onChange, error, label }) => {
    const isRequired = label.endsWith('*');
    const labelText = isRequired ? label.slice(0, -1).trim() : label;

    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
                {labelText}
                {isRequired && <span className="text-red-500"> *</span>}
            </label>
            <textarea
                id={id}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                rows={3}
                className={`w-full px-3 py-2 bg-white border rounded-md text-gray-900 focus:outline-none focus:ring-2 ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'}`}
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
};


interface ProfileUploadFieldProps {
    id: string;
    name: string;
    file: File | null;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    error?: string;
    isCompressing: boolean;
}

const ProfileUploadField: React.FC<ProfileUploadFieldProps> = ({ id, name, file, onChange, error, isCompressing }) => {
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
        if (!file) {
            setPreview(null);
            return;
        }
        const objectUrl = URL.createObjectURL(file);
        setPreview(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    return (
        <div className="flex flex-col items-center text-center mt-5">
            <label className="block text-sm font-medium text-gray-700">
                Profile Picture <span className="text-red-500">*</span>
            </label>
            <div className="relative w-[180px] h-[220px]">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150px] h-[190px] bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 rounded-md">
                    {isCompressing ? (
                        <Loader className="text-gray-400 animate-spin" size={48} />
                    ) : preview ? (
                        <img src={preview} alt="Profile Preview" className="w-full h-full object-cover" />
                    ) : (
                        <User size={64} className="text-gray-300" />
                    )}
                </div>
                <span className="absolute top-1/2 -right-1 -translate-y-1/2 -rotate-90 text-xs text-gray-400 tracking-widest">H: 4.5cm</span>
                <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs text-gray-400 tracking-widest">W: 3.5cm</span>
            </div>
            <label htmlFor={id} className={`inline-block px-8 py-2 text-sm font-medium text-white bg-orange-500 rounded-md  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${isCompressing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                {isCompressing ? 'Compressing...' : 'Upload Image'}
            </label>
            <input id={id} name={name} type="file" className="sr-only" onChange={onChange} disabled={isCompressing} accept="image/png, image/jpeg" />
            <p className="mt-2 text-xs text-gray-500">
                Max 100KB. PNG or JPG.
            </p>
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
};


interface SuccessViewProps {
    handleReset: () => void;
}

const SuccessView: React.FC<SuccessViewProps> = ({ handleReset }) => (
    <div className="animate-fade-in text-center flex flex-col items-center justify-center p-8 h-full">
        <CheckCircle size={64} className="text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Submitted!</h2>
        <p className="text-gray-600 mb-6">Thank you for registering. We will get in touch with you shortly.</p>
    </div>
);
