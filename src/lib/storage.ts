// ============================================================
// FIREBASE STORAGE UTILITIES
// ============================================================
import { ref, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export type UploadFolder = 'questions' | 'options' | 'profiles';

/**
 * Upload an image file to Firebase Storage via server-side API route
 * This bypasses CORS issues by uploading through the Next.js backend
 * @returns The download URL of the uploaded file
 */
export const uploadImage = async (
  file: File,
  folder: UploadFolder,
  id: string
): Promise<string> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File size must be less than 5MB');
  }

  // Upload via server-side API route instead of directly to Firebase
  // This avoids browser CORS restrictions
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  formData.append('id', id);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Upload failed');
  }

  const data = await response.json();
  return data.url;
};

/**
 * Delete an image from Firebase Storage by its URL
 */
export const deleteImage = async (url: string): Promise<void> => {
  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch (error) {
    // File might not exist, ignore error
    console.warn('Could not delete image:', error);
  }
};

/**
 * Convert File to base64 for preview
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
