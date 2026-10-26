/**
 * Base API Service
 * Provides common functionality for all API services
 */

import { apiClient, APIError } from '../api';

import i18n from '@/i18n';
// Common query parameters interface
export interface BaseQueryParams {
  page?: number;
  limit?: number;
  offset?: number;
  search?: string;
  category?: string;
  status?: string | null;
  tags?: string[];
  // Agent-specific parameters (allowing null for API compatibility)
  model?: string | null;
  is_default?: boolean | null;
  // Model-specific parameters (allowing null for API compatibility)
  provider?: string | null;
  type?: string | null;
  model_type?: string | null;
}

// Common response metadata interface
export interface BaseResponseMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// Common list response interface
export interface BaseListResponse<T> {
  data: T[];
  meta: BaseResponseMeta;
}

/**
 * Base API Service Class
 * Provides common functionality for all API services
 */
export abstract class BaseApiService {
  protected abstract readonly endpoints: Record<string, string | ((...args: any[]) => string)>;
  protected abstract readonly apiVersion: string;

  /**
   * Handle API errors consistently across all services
   */
  protected handleApiError(error: unknown): string {
    if (error instanceof APIError) {
      return error.getUserMessage();
    }
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Network errors
      if (message.includes('network') || message.includes('fetch')) {
        return i18n.t('errors.networkFailed', 'Network connection failed, please check your network and try again');
      }
      
      // Timeout errors
      if (message.includes('timeout')) {
        return i18n.t('errors.timeout', 'Request timed out, please try again later');
      }
      
      // HTTP status errors
      if (message.includes('400')) return i18n.t('errors.badRequest', 'Invalid request parameters, please check your input');
      if (message.includes('401')) return i18n.t('errors.unauthorized', 'Authentication failed, please log in again');
      if (message.includes('403')) return i18n.t('errors.forbidden', 'Insufficient permissions, unable to perform this action');
      if (message.includes('404')) return i18n.t('errors.notFound', 'The requested resource does not exist');
      if (message.includes('409')) return i18n.t('errors.conflict', 'Resource conflict, please refresh the page and try again');
      if (message.includes('413')) return i18n.t('errors.fileTooLarge', 'File is too large, please choose a smaller file');
      if (message.includes('415')) return i18n.t('errors.unsupportedFileType', 'Unsupported file type');
      if (message.includes('500')) return i18n.t('errors.serverError', 'Server error, please try again later');
      
      return error.message;
    }
    
    return 'An unexpected error occurred';
  }

  /**
   * Check if user is authenticated
   */
  protected isAuthenticated(): boolean {
    const token = apiClient.getToken();
    return token !== null && token.trim() !== '';
  }

  /**
   * Build query string from parameters
   */
  protected buildQueryString(params?: BaseQueryParams): string {
    if (!params) return '';

    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.category) queryParams.append('category', params.category);
    if (params.status !== undefined && params.status !== null) {
      queryParams.append('status', params.status);
    }
    if (params.tags?.length) {
      params.tags.forEach(tag => queryParams.append('tags', tag));
    }

    // Agent-specific parameters
    if (params.model !== undefined && params.model !== null) {
      queryParams.append('model', params.model);
    }
    if (params.is_default !== undefined && params.is_default !== null) {
      queryParams.append('is_default', params.is_default.toString());
    }

    // Model-specific parameters
    if (params.provider !== undefined && params.provider !== null) {
      queryParams.append('provider', params.provider);
    }
    if (params.type !== undefined && params.type !== null) {
      queryParams.append('type', params.type);
    }
    if (params.model_type !== undefined && params.model_type !== null) {
      queryParams.append('model_type', params.model_type);
    }

    return queryParams.toString();
  }

  /**
   * Build URL with query parameters
   */
  protected buildUrl(endpoint: string, params?: BaseQueryParams): string {
    const queryString = this.buildQueryString(params);
    return queryString ? `${endpoint}?${queryString}` : endpoint;
  }

  /**
   * Generic GET request with error handling
   */
  protected async get<T>(endpoint: string, params?: BaseQueryParams): Promise<T> {
    try {
      const url = this.buildUrl(endpoint, params);
      return await apiClient.get<T>(url);
    } catch (error) {
      console.error(`GET ${endpoint} failed:`, error);
      throw new Error(this.handleApiError(error));
    }
  }

  /**
   * Generic POST request with error handling
   */
  protected async post<T>(endpoint: string, data?: any): Promise<T> {
    try {
      return await apiClient.post<T>(endpoint, data);
    } catch (error) {
      console.error(`POST ${endpoint} failed:`, error);
      throw new Error(this.handleApiError(error));
    }
  }

  /**
   * Generic PUT request with error handling
   */
  protected async put<T>(endpoint: string, data: any): Promise<T> {
    try {
      return await apiClient.put<T>(endpoint, data);
    } catch (error) {
      console.error(`PUT ${endpoint} failed:`, error);
      throw new Error(this.handleApiError(error));
    }
  }

  /**
   * Generic PATCH request with error handling
   */
  protected async patch<T>(endpoint: string, data: any): Promise<T> {
    try {
      return await apiClient.patch<T>(endpoint, data);
    } catch (error) {
      console.error(`PATCH ${endpoint} failed:`, error);
      throw new Error(this.handleApiError(error));
    }
  }

  /**
   * Generic DELETE request with error handling
   */
  protected async delete<T>(endpoint: string): Promise<T> {
    try {
      return await apiClient.delete<T>(endpoint);
    } catch (error) {
      console.error(`DELETE ${endpoint} failed:`, error);
      throw new Error(this.handleApiError(error));
    }
  }

  /**
   * Generic GET request for raw Response with error handling
   */
  protected async getResponse(endpoint: string): Promise<Response> {
    try {
      return await apiClient.getResponse(endpoint);
    } catch (error) {
      console.error(`GET ${endpoint} (raw) failed:`, error);
      throw new Error(this.handleApiError(error));
    }
  }

  /**
   * Get list with pagination
   */
  protected async getList<T>(
    baseEndpoint: string, 
    params?: BaseQueryParams
  ): Promise<BaseListResponse<T>> {
    return this.get<BaseListResponse<T>>(baseEndpoint, params);
  }

  /**
   * Get single item by ID
   */
  protected async getById<T>(baseEndpoint: string | ((id: string) => string), id: string): Promise<T> {
    const endpoint = typeof baseEndpoint === 'function'
      ? baseEndpoint(id)
      : `${baseEndpoint}/${id}`;
    return this.get<T>(endpoint);
  }

  /**
   * Search items with filters
   */
  protected async search<T>(
    baseEndpoint: string,
    query: string,
    filters?: Omit<BaseQueryParams, 'search'>
  ): Promise<BaseListResponse<T>> {
    return this.getList<T>(baseEndpoint, { ...filters, search: query });
  }

  /**
   * Get items by category
   */
  protected async getByCategory<T>(
    baseEndpoint: string,
    category: string,
    params?: Omit<BaseQueryParams, 'category'>
  ): Promise<BaseListResponse<T>> {
    return this.getList<T>(baseEndpoint, { ...params, category });
  }

  /**
   * Get items by status
   */
  protected async getByStatus<T>(
    baseEndpoint: string,
    status: string,
    params?: Omit<BaseQueryParams, 'status'>
  ): Promise<BaseListResponse<T>> {
    return this.getList<T>(baseEndpoint, { ...params, status });
  }

  /**
   * Get paginated items
   */
  protected async getPage<T>(
    baseEndpoint: string,
    page: number,
    pageSize: number = 20,
    filters?: Omit<BaseQueryParams, 'limit' | 'page'>
  ): Promise<BaseListResponse<T>> {
    return this.getList<T>(baseEndpoint, {
      ...filters,
      page,
      limit: pageSize,
    });
  }
}

export default BaseApiService;
