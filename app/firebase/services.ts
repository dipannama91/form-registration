// 'use client';
import { db } from './firebase';import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { addDoc, collection,  query, where, getDocs } from 'firebase/firestore';
// Utility to crop an image file to the specified width and height
export async function cropImageToDimensions(file: File, width: number, height: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // Create a canvas with the target dimensions
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      // Calculate cropping area (center crop)
      const aspectRatio = width / height;
      let srcWidth = img.width;
      let srcHeight = img.height;
      let cropWidth = srcWidth;
      let cropHeight = srcWidth / aspectRatio;
      if (cropHeight > srcHeight) {
        cropHeight = srcHeight;
        cropWidth = srcHeight * aspectRatio;
      }
      const sx = (srcWidth - cropWidth) / 2;
      const sy = (srcHeight - cropHeight) / 2;
      ctx.drawImage(img, sx, sy, cropWidth, cropHeight, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        // Create a new File object with the same name and type
        const croppedFile = new File([blob], file.name, { type: file.type });
        resolve(croppedFile);
        URL.revokeObjectURL(url);
      }, file.type);
    };
    img.onerror = (err) => {
      reject(err);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export const addRegistration = async (data: any) => {
  try {
    const docRef = await addDoc(collection(db, 'registrations'), data);
    console.log("Document written with ID: ", docRef.id);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// Utility to get file extension from File object
const getFileExtension = (file: File) => {
  const parts = file.name.split('.');
  return parts.length > 1 ? '.' + parts.pop() : '';
};

// Utility to generate profile picture filename from UID
export const getProfilePictureFilename = (uid: string, file: File) => {
  return `${uid}${getFileExtension(file)}`;
};

export const uploadProfilePicture = async (file: File, userId: string) => {
  const storage = getStorage();
  const filename = getProfilePictureFilename(userId, file);
  const fileRef = ref(storage, `profilePictures/${filename}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
};

export const checkAadhaarExists = async (aadhaar: string) => {
  const registrationsRef = collection(db, 'registrations');
  const q = query(registrationsRef, where('aadhaar', '==', aadhaar));
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
};