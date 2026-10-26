/**
 * Authentication Test Utility
 * Helps verify that authentication headers are properly included in API requests
 */

import { KnowledgeBaseApiService, isAuthenticated } from '@/services/knowledgeBaseApi';
import { apiClient } from '@/services/api';

export interface AuthTestResult {
  isAuthenticated: boolean;
  hasToken: boolean;
  tokenPreview?: string;
  testResults: {
    collections: 'success' | 'auth_error' | 'other_error' | 'not_tested';
    files: 'success' | 'auth_error' | 'other_error' | 'not_tested';
  };
  errors: string[];
}

/**
 * Test authentication status and API endpoints
 */
export const testAuthentication = async (): Promise<AuthTestResult> => {
  const result: AuthTestResult = {
    isAuthenticated: isAuthenticated(),
    hasToken: false,
    testResults: {
      collections: 'not_tested',
      files: 'not_tested',
    },
    errors: [],
  };

  // Check if token exists
  const token = apiClient.getToken();
  result.hasToken = token !== null && token.trim() !== '';
  
  if (result.hasToken && token) {
    // Show first and last 4 characters of token for debugging
    result.tokenPreview = `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }

  // Test collections endpoint
  try {
    await KnowledgeBaseApiService.getCollections({ limit: 1 });
    result.testResults.collections = 'success';
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('Authentication failed')) {
        result.testResults.collections = 'auth_error';
        result.errors.push(`Collections API: ${error.message}`);
      } else {
        result.testResults.collections = 'other_error';
        result.errors.push(`Collections API: ${error.message}`);
      }
    }
  }

  // Test files endpoint (only if we have a collection to test with)
  try {
    await KnowledgeBaseApiService.getFiles({ limit: 1 });
    result.testResults.files = 'success';
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('Authentication failed')) {
        result.testResults.files = 'auth_error';
        result.errors.push(`Files API: ${error.message}`);
      } else {
        result.testResults.files = 'other_error';
        result.errors.push(`Files API: ${error.message}`);
      }
    }
  }

  return result;
};

/**
 * Log authentication test results to console
 */
export const logAuthTestResults = async (): Promise<void> => {
  console.group('🔐 Authentication Test Results');
  
  const results = await testAuthentication();
  
  console.log('Authentication Status:', results.isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated');
  console.log('Token Present:', results.hasToken ? '✅ Yes' : '❌ No');
  
  if (results.tokenPreview) {
    console.log('Token Preview:', results.tokenPreview);
  }
  
  console.log('Collections API:', 
    results.testResults.collections === 'success' ? '✅ Success' :
    results.testResults.collections === 'auth_error' ? '🔒 Auth Error' :
    results.testResults.collections === 'other_error' ? '❌ Other Error' :
    '⏸️ Not Tested'
  );
  
  console.log('Files API:', 
    results.testResults.files === 'success' ? '✅ Success' :
    results.testResults.files === 'auth_error' ? '🔒 Auth Error' :
    results.testResults.files === 'other_error' ? '❌ Other Error' :
    '⏸️ Not Tested'
  );
  
  if (results.errors.length > 0) {
    console.group('Errors:');
    results.errors.forEach(error => console.error('❌', error));
    console.groupEnd();
  }
  
  console.groupEnd();
};

/**
 * Test file upload authentication (without actually uploading)
 */
export const testFileUploadAuth = (): { hasAuth: boolean; authHeaders: Record<string, string> } => {
  const token = apiClient.getToken();
  const authHeaders: Record<string, string> = {};
  
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  return {
    hasAuth: token !== null && token.trim() !== '',
    authHeaders,
  };
};

/**
 * Simulate a file upload request to test authentication headers
 */
export const simulateFileUploadRequest = (): void => {
  const { hasAuth, authHeaders } = testFileUploadAuth();
  
  console.group('📁 File Upload Authentication Test');
  console.log('Has Authentication:', hasAuth ? '✅ Yes' : '❌ No');
  console.log('Auth Headers:', authHeaders);
  
  if (hasAuth) {
    console.log('✅ File upload requests will include authentication headers');
  } else {
    console.warn('⚠️ File upload requests will NOT include authentication headers');
    console.log('💡 Make sure to log in before uploading files');
  }
  
  console.groupEnd();
};

// Export for use in browser console during development
if (typeof window !== 'undefined') {
  (window as any).authTest = {
    test: logAuthTestResults,
    fileUpload: simulateFileUploadRequest,
    check: testAuthentication,
  };
  
  console.log('🔧 Auth test utilities available at window.authTest');
  console.log('   - window.authTest.test() - Run full authentication test');
  console.log('   - window.authTest.fileUpload() - Test file upload auth');
  console.log('   - window.authTest.check() - Get detailed test results');
}
