import apiClient from '@/services/api';
import { 
  ToolStoreItem, 
  ToolStoreLoginResponse, 
  ToolStoreRefreshResponse,
  AgentStoreItem,
  AgentDependencyCheckResponse
} from '@/types';
import type { ToolStoreCategory } from '@/types';
import { STORAGE_KEYS } from '@/constants';

// Get the store API address (via the tgo-api proxy)
const PROXY_PATH = '/v1/store/proxy';

// Get the store's access token (read from the Zustand store in localStorage)
const getStoreAccessToken = (): string | null => {
  try {
    const authDataStr = localStorage.getItem(STORAGE_KEYS.TOOLSTORE_AUTH);
    if (authDataStr) {
      const authData = JSON.parse(authDataStr);
      return authData.state?.accessToken || null;
    }
  } catch (e) {
    console.error('Failed to get store access token', e);
  }
  return null;
};

// Get the API base URL
const getApiBaseUrl = (): string => {
  // Prefer the runtime config (set by docker-entrypoint.sh)
  if (typeof window !== 'undefined' && (window as any).ENV?.VITE_API_BASE_URL) {
    return (window as any).ENV.VITE_API_BASE_URL;
  }
  // Then the build-time environment variable
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  return '/api';
};

// Request function with store authentication
const storeAuthFetch = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${getApiBaseUrl()}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add the Pelatis API token
  const tgoToken = localStorage.getItem('tgo-auth-token');
  if (tgoToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${tgoToken}`;
  }

  // Add the store's token as a custom header
  const storeToken = getStoreAccessToken();
  if (storeToken) {
    (headers as Record<string, string>)['X-Store-Authorization'] = `Bearer ${storeToken}`;
  }

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
};

export const storeApi = {
  // --- Authentication ---
  
  login: async (credentials: { username: string; password: string }): Promise<ToolStoreLoginResponse> => {
    const response = await storeAuthFetch<ToolStoreLoginResponse>(`${PROXY_PATH}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
      }),
    });

    // Automatically bind to the current project after a successful login
    try {
      await apiClient.post('/v1/store/bind', {
        access_token: response.access_token
      });
    } catch (e) {
      console.error('Failed to bind Store credential automatically', e);
    }

    return response;
  },

  exchangeCode: async (code: string, codeVerifier: string): Promise<ToolStoreLoginResponse> => {
    const response = await storeAuthFetch<ToolStoreLoginResponse>(`${PROXY_PATH}/auth/exchange?code=${code}&code_verifier=${codeVerifier}`, {
      method: 'POST',
    });

    // Automatically bind to the current project after a successful exchange
    try {
      await apiClient.post('/v1/store/bind', {
        access_token: response.access_token
      });
    } catch (e) {
      console.error('Failed to bind Store credential automatically', e);
    }

    return response;
  },

  refreshToken: async (refreshToken: string): Promise<ToolStoreRefreshResponse> => {
    const response = await storeAuthFetch<ToolStoreRefreshResponse>(`${PROXY_PATH}/auth/refresh?refresh_token=${refreshToken}`, {
      method: 'POST',
    });
    return response;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await storeAuthFetch(`${PROXY_PATH}/auth/logout?refresh_token=${refreshToken}`, {
      method: 'POST',
    });
  },

  getMe: async () => {
    const response = await storeAuthFetch<any>(`${PROXY_PATH}/auth/me`, {
      method: 'GET',
    });
    return response;
  },

  // --- Tools ---

  getToolCategories: async (): Promise<ToolStoreCategory[]> => {
    const response = await storeAuthFetch<ToolStoreCategory[]>(`${PROXY_PATH}/tools/categories`, {
      method: 'GET',
    });
    return response;
  },

  getTools: async (params?: { category?: string; search?: string; skip?: number; limit?: number }) => {
    const filteredParams = Object.fromEntries(
      Object.entries(params || {}).filter(([_, v]) => v !== undefined && v !== 'undefined' && v !== '')
    );
    const query = Object.keys(filteredParams).length > 0 
      ? `?${new URLSearchParams(filteredParams as any).toString()}` 
      : '';
    const response = await storeAuthFetch<{ items: ToolStoreItem[]; total: number }>(`${PROXY_PATH}/tools${query}`, {
      method: 'GET',
    });
    return response;
  },

  getTool: async (id: string) => {
    const response = await storeAuthFetch<ToolStoreItem>(`${PROXY_PATH}/tools/${id}`, {
      method: 'GET',
    });
    return response;
  },

  installTool: async (id: string) => {
    // Call the Pelatis API to sync the tool to the local project (the Pelatis API handles store state internally)
    const response = await apiClient.post<any>('/v1/store/install-tool', { resource_id: id });
    return response;
  },

  uninstallTool: async (id: string) => {
    // Call the Pelatis API to uninstall (the Pelatis API handles store state internally)
    const response = await apiClient.delete<any>(`/v1/store/uninstall-tool/${id}`);
    return response;
  },

  // --- Models ---

  getModelCategories: async (): Promise<any[]> => {
    const response = await storeAuthFetch<any[]>(`${PROXY_PATH}/models/categories`, {
      method: 'GET',
    });
    return response;
  },

  getModels: async (params?: { category?: string; provider?: string; provider_id?: string; search?: string; skip?: number; limit?: number }) => {
    const filteredParams = Object.fromEntries(
      Object.entries(params || {}).filter(([_, v]) => v !== undefined && v !== 'undefined' && v !== '')
    );
    const query = Object.keys(filteredParams).length > 0 
      ? `?${new URLSearchParams(filteredParams as any).toString()}` 
      : '';
    const response = await storeAuthFetch<{ items: any[]; total: number }>(`${PROXY_PATH}/models${query}`, {
      method: 'GET',
    });
    return response;
  },

  getModelsByProvider: async (providerId: string) => {
    const response = await storeAuthFetch<{ items: any[]; total: number }>(`${PROXY_PATH}/models?provider_id=${providerId}&limit=100`, {
      method: 'GET',
    });
    return (response as any).items || [];
  },

  getModel: async (id: string) => {
    const response = await storeAuthFetch<any>(`${PROXY_PATH}/models/${id}`, {
      method: 'GET',
    });
    return response;
  },

  installModel: async (id: string) => {
    // Call the Pelatis API to sync the model to the local project (the Pelatis API handles store state internally)
    const response = await apiClient.post<any>('/v1/store/install-model', { resource_id: id });
    return response;
  },

  uninstallModel: async (id: string) => {
    // Call the Pelatis API to uninstall (the Pelatis API handles store state internally)
    const response = await apiClient.delete<any>(`/v1/store/uninstall-model/${id}`);
    return response;
  },

  getInstalledModels: async (): Promise<string[]> => {
    // Get the list of installed models (model_id list) from the local Pelatis API
    const response = await apiClient.get<string[]>('/v1/store/installed-models');
    return response;
  },

  // --- Agent templates ---

  getAgentCategories: async (): Promise<any[]> => {
    const response = await storeAuthFetch<any[]>(`${PROXY_PATH}/agents/categories`, {
      method: 'GET',
    });
    return response;
  },

  getAgents: async (params?: { category?: string; search?: string; skip?: number; limit?: number }) => {
    const filteredParams = Object.fromEntries(
      Object.entries(params || {}).filter(([_, v]) => v !== undefined && v !== 'undefined' && v !== '')
    );
    const query = Object.keys(filteredParams).length > 0 
      ? `?${new URLSearchParams(filteredParams as any).toString()}` 
      : '';
    const response = await storeAuthFetch<{ items: any[]; total: number }>(`${PROXY_PATH}/agents${query}`, {
      method: 'GET',
    });
    return response;
  },

  getAgent: async (id: string): Promise<AgentStoreItem> => {
    const response = await storeAuthFetch<AgentStoreItem>(`${PROXY_PATH}/agents/${id}`, {
      method: 'GET',
    });
    return response;
  },

  checkAgentDependencies: async (id: string): Promise<AgentDependencyCheckResponse> => {
    return await apiClient.get<AgentDependencyCheckResponse>(`/v1/store/agent/${id}/check-dependencies`);
  },

  installAgent: async (id: string, options?: { install_tool_ids?: string[], install_model?: boolean }) => {
    // Call the Pelatis API to hire the agent into the local project
    const response = await apiClient.post<any>('/v1/store/install-agent', { 
      resource_id: id,
      ...options
    });
    return response;
  },

  uninstallAgent: async (id: string) => {
    const response = await apiClient.delete<any>(`/v1/store/uninstall-agent/${id}`);
    return response;
  },

  getStoreConfig: async () => {
    const response = await apiClient.get<{ store_web_url: string; store_api_url: string }>('/v1/store/config');
    return response;
  },
};

export default storeApi;
