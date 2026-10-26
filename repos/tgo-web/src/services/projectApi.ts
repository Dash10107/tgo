import { apiClient } from './api';
import type { ToolStoreCredential } from '@/types';

export const projectApi = {
  // Bind the tool store credentials
  bindToolStoreCredential: async (projectId: string, data: {
    toolstore_user_id: string;
    toolstore_email: string;
    api_key: string;
    refresh_token?: string;
  }) => {
    return await apiClient.post<ToolStoreCredential>(`/v1/toolstore/${projectId}/bindCredential`, data);
  },

  // Get the tool store credential status
  getToolStoreCredential: async (projectId: string) => {
    return await apiClient.get<ToolStoreCredential | null>(`/v1/toolstore/${projectId}/credential`);
  },

  // Unbind the tool store credentials
  unbindToolStoreCredential: async (projectId: string) => {
    return await apiClient.delete(`/v1/toolstore/${projectId}/credential`);
  },
};

export default projectApi;
