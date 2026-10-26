import { apiClient } from './api';

import i18n from '@/i18n';
export interface UploadImageResponse {
  url: string; // public URL
  id?: string;
  width?: number;
  height?: number;
  content_type?: string;
}

/**
 * Upload an image (logo) and return its public URL.
 * Endpoint is configurable via Vite env VITE_UPLOAD_IMAGE_ENDPOINT; default '/v1/uploads/images'.
 */
export async function uploadImage(file: File): Promise<UploadImageResponse> {
  const endpoint = (import.meta as any).env?.VITE_UPLOAD_IMAGE_ENDPOINT || '/v1/uploads/images';
  try {
    const formData = new FormData();
    formData.append('file', file);
    return await apiClient.postFormData<UploadImageResponse>(endpoint, formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : i18n.t('upload.failedRetry', 'Upload failed, please try again later');
    throw new Error(message);
  }
}

