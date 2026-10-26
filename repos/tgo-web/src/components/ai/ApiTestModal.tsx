import React, { useState, useEffect } from 'react';
import { X, Settings, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getMethodColorClass, type ParsedEndpoint } from '@/utils/schemaParser';
import AuthMethodModal, { type AuthConfig } from './AuthMethodModal';

interface ApiTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  endpoint: ParsedEndpoint | null;
  authConfig: AuthConfig;
  onAuthConfigChange?: (config: AuthConfig) => void;
}

interface TestParameter {
  name: string;
  value: string;
  type: 'query' | 'path' | 'header' | 'body';
  required: boolean;
  description?: string;
  schema: {
    type: string;
    format?: string;
    enum?: any[];
    default?: any;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    example?: any;
    examples?: any[];
    title?: string;
    nullable?: boolean;
  };
  deprecated?: boolean;
  example?: any;
  examples?: Record<string, any>;
}

interface TestResult {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  data?: any;
  error?: string;
  timestamp?: string;
}

/**
 * API endpoint test modal component
 */
const ApiTestModal: React.FC<ApiTestModalProps> = ({
  isOpen,
  onClose,
  endpoint,
  authConfig,
  onAuthConfigChange
}) => {
  const { t } = useTranslation();
  const [parameters, setParameters] = useState<TestParameter[]>([]);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Initialize parameters from endpoint schema
  useEffect(() => {
    if (endpoint && endpoint.parameters) {
      const initialParams: TestParameter[] = endpoint.parameters.map(param => ({
        name: param.name,
        value: param.schema.default?.toString() || param.example?.toString() || '',
        type: param.type,
        required: param.required,
        description: param.description,
        schema: param.schema,
        deprecated: param.deprecated,
        example: param.example,
        examples: param.examples
      }));
      setParameters(initialParams);
    } else {
      setParameters([]);
    }
    // Reset test result when endpoint changes
    setTestResult(null);
  }, [endpoint]);

  // Handle parameter value changes
  const handleParameterChange = (index: number, value: string) => {
    const newParameters = [...parameters];
    newParameters[index].value = value;
    setParameters(newParameters);
  };

  // Validate parameters
  const validateParameters = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    parameters.forEach(param => {
      // Check required parameters
      if (param.required && !param.value.trim()) {
        errors.push(t('agents.modal.apiTest.errors.required', { name: param.name }));
        return;
      }

      if (!param.value.trim()) return; // Skip empty optional parameters

      const value = param.value.trim();
      const schema = param.schema;

      // Type validation
      if (schema.type === 'number' || schema.type === 'integer') {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          errors.push(t('agents.modal.apiTest.errors.mustBeNumber', { name: param.name }));
          return;
        }

        if (schema.minimum !== undefined && numValue < schema.minimum) {
          errors.push(t('agents.modal.apiTest.errors.minValue', { name: param.name, min: schema.minimum }));
        }
        if (schema.maximum !== undefined && numValue > schema.maximum) {
          errors.push(t('agents.modal.apiTest.errors.maxValue', { name: param.name, max: schema.maximum }));
        }
      }

      // String length validation
      if (schema.type === 'string') {
        if (schema.minLength !== undefined && value.length < schema.minLength) {
          errors.push(t('agents.modal.apiTest.errors.minLength', { name: param.name, min: schema.minLength }));
        }
        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
          errors.push(t('agents.modal.apiTest.errors.maxLength', { name: param.name, max: schema.maxLength }));
        }

        // Regex pattern validation
        if (schema.pattern) {
          try {
            const regex = new RegExp(schema.pattern);
            if (!regex.test(value)) {
              errors.push(t('agents.modal.apiTest.errors.formatInvalid', { name: param.name }));
            }
          } catch (e) {
            console.warn(`Invalid regex pattern for parameter ${param.name}:`, schema.pattern);
          }
        }
      }

      // Enum value validation
      if (schema.enum && schema.enum.length > 0) {
        if (!schema.enum.includes(value)) {
          errors.push(t('agents.modal.apiTest.errors.enumInvalid', { name: param.name, values: schema.enum.join(', ') }));
        }
      }
    });

    return { isValid: errors.length === 0, errors };
  };

  // Build the request URL
  const buildRequestUrl = (baseUrl: string): string => {
    let url = baseUrl;
    const queryParams: string[] = [];

    // Replace path parameters
    parameters.forEach(param => {
      if (param.type === 'path' && param.value.trim()) {
        url = url.replace(`{${param.name}}`, encodeURIComponent(param.value.trim()));
      }
    });

    // Add query parameters
    parameters.forEach(param => {
      if (param.type === 'query' && param.value.trim()) {
        queryParams.push(`${encodeURIComponent(param.name)}=${encodeURIComponent(param.value.trim())}`);
      }
    });

    // Add authentication query parameters
    const effectiveAuthConfig = getEffectiveAuthConfig();
    if (effectiveAuthConfig.type === 'query' && effectiveAuthConfig.key && effectiveAuthConfig.value) {
      queryParams.push(`${encodeURIComponent(effectiveAuthConfig.key)}=${encodeURIComponent(effectiveAuthConfig.value)}`);
    }

    if (queryParams.length > 0) {
      url += (url.includes('?') ? '&' : '?') + queryParams.join('&');
    }

    return url;
  };

  // Build the request headers
  const buildRequestHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};

    // Add headers from parameters
    parameters.forEach(param => {
      if (param.type === 'header' && param.value.trim()) {
        headers[param.name] = param.value.trim();
      }
    });

    // Add authentication headers
    const effectiveAuthConfig = getEffectiveAuthConfig();
    if (effectiveAuthConfig.type === 'header' && effectiveAuthConfig.key && effectiveAuthConfig.value) {
      if (effectiveAuthConfig.headerPrefix === 'basic') {
        headers[effectiveAuthConfig.key] = `Basic ${effectiveAuthConfig.value}`;
      } else if (effectiveAuthConfig.headerPrefix === 'bearer') {
        headers[effectiveAuthConfig.key] = `Bearer ${effectiveAuthConfig.value}`;
      } else {
        headers[effectiveAuthConfig.key] = effectiveAuthConfig.value;
      }
    }

    return headers;
  };

  // Build the request body
  const buildRequestBody = (): any => {
    const bodyParams = parameters.filter(param => param.type === 'body' && param.value.trim());

    if (bodyParams.length === 0) return null;

    // If there is only one body parameter named 'body', use its value directly
    if (bodyParams.length === 1 && bodyParams[0].name === 'body') {
      try {
        return JSON.parse(bodyParams[0].value);
      } catch {
        return bodyParams[0].value;
      }
    }

    // Otherwise build a JSON object
    const body: any = {};
    bodyParams.forEach(param => {
      let value: any = param.value.trim();

      // Try to convert the value according to the schema type
      if (param.schema.type === 'number' || param.schema.type === 'integer') {
        const numValue = Number(value);
        if (!isNaN(numValue)) {
          value = numValue;
        }
      } else if (param.schema.type === 'boolean') {
        value = value.toLowerCase() === 'true';
      } else if (param.schema.type === 'array') {
        try {
          value = JSON.parse(value);
        } catch {
          value = value.split(',').map((v: string) => v.trim());
        }
      } else if (param.schema.type === 'object') {
        try {
          value = JSON.parse(value);
        } catch {
          // Keep the string value
        }
      }

      body[param.name] = value;
    });

    return body;
  };

  // Run the API test
  const handleTest = async (e?: React.MouseEvent) => {
    // Prevent form submission and event bubbling
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!endpoint) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      // Validate parameters
      const validation = validateParameters();
      if (!validation.isValid) {
        setTestResult({
          error: t('agents.modal.apiTest.errors.validationFailedPrefix') + '\n' + validation.errors.join('\n'),
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Build the request URL (uses a sample base URL; in a real app it should come from the endpoint or config)
      const baseUrl = 'https://api.example.com' + endpoint.path;
      const requestUrl = buildRequestUrl(baseUrl);

      // Build the request headers
      const headers = buildRequestHeaders();

      // Set Content-Type
      const hasBodyData = ['POST', 'PUT', 'PATCH'].includes(endpoint.method.toUpperCase());
      if (hasBodyData) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      }

      // Build the request body
      const requestBody = buildRequestBody();

      // Build the fetch options
      const fetchOptions: RequestInit = {
        method: endpoint.method.toUpperCase(),
        headers,
        mode: 'cors', // Handle CORS
        credentials: 'omit', // Do not send credentials, to avoid CORS issues
      };

      // Add the request body (only for methods that support a body)
      if (hasBodyData && requestBody !== null) {
        if (headers['Content-Type']?.includes('application/json')) {
          fetchOptions.body = JSON.stringify(requestBody);
        } else {
          fetchOptions.body = requestBody;
        }
      }

      console.log('Sending API request:', {
        url: requestUrl,
        method: endpoint.method.toUpperCase(),
        headers,
        body: requestBody
      });

      // Send the request
      const response = await fetch(requestUrl, fetchOptions);

      // Parse the response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Parse the response body
      let responseData: any;
      const contentType = response.headers.get('content-type');

      try {
        if (contentType?.includes('application/json')) {
          responseData = await response.json();
        } else if (contentType?.includes('text/')) {
          responseData = await response.text();
        } else {
          // Try to parse as text
          responseData = await response.text();
          // If the response is empty, set it to null
          if (!responseData) {
            responseData = null;
          }
        }
      } catch (parseError) {
        console.warn('Failed to parse response:', parseError);
        responseData = t('agents.modal.apiTest.errors.parseResponseFailed', 'Failed to parse response');
      }

      // Build the test result
      const testResult: TestResult = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data: responseData,
        timestamp: new Date().toISOString()
      };

      // If the response was not successful, add error info
      if (!response.ok) {
        testResult.error = `HTTP ${response.status}: ${response.statusText}`;
      }

      setTestResult(testResult);

    } catch (error) {
      console.error('API test failed:', error);

      let errorMessage = t('agents.modal.apiTest.errors.requestFailed', 'Request failed');

      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = t('agents.modal.apiTest.errors.networkFailed', 'Network connection failed. Check that the URL is correct or whether there is a CORS issue');
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setTestResult({
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Handle saving the authentication config
  const handleAuthSave = (config: AuthConfig) => {
    if (onAuthConfigChange) {
      onAuthConfigChange(config);
    }
  };

  // Get the authentication display text
  const getAuthDisplayText = () => {
    const autoAuth = endpoint?.autoDetectedAuth;

    let baseText = '';
    if (authConfig.type === 'none') {
      if (autoAuth && autoAuth.type !== 'none') {
        baseText = `${t('authMethod.autoDetected', 'Auto-detected')}: ${autoAuth.type === 'header' ? t('authMethod.header', 'Request Header') : t('authMethod.query', 'Query Parameter')}`;
      } else {
        baseText = t('authMethod.none', 'None');
      }
    } else if (authConfig.type === 'header') {
      baseText = `${t('authMethod.header', 'Request Header')} (${authConfig.headerPrefix?.toUpperCase()})`;
    } else if (authConfig.type === 'query') {
      baseText = t('authMethod.query', 'Query Parameter');
    } else {
      baseText = t('authMethod.none', 'None');
    }

    return baseText;
  };

  // Check whether the authentication was auto-detected
  const isAutoDetectedAuth = () => {
    const autoAuth = endpoint?.autoDetectedAuth;
    return autoAuth && (
      (authConfig.type === autoAuth.type && authConfig.key === autoAuth.key) ||
      (authConfig.type === 'none' && autoAuth.type !== 'none')
    );
  };

  // Get the effective authentication config (manual config first, otherwise auto-detected)
  const getEffectiveAuthConfig = (): AuthConfig => {
    if (authConfig.type !== 'none') {
      return authConfig;
    }

    // If there is no manual config, try the auto-detected config
    const autoAuth = endpoint?.autoDetectedAuth;
    if (autoAuth && autoAuth.type !== 'none') {
      return {
        type: autoAuth.type,
        headerPrefix: autoAuth.headerPrefix,
        key: autoAuth.key,
        value: '', // The user must provide the real API key
      };
    }

    return authConfig;
  };

  if (!isOpen || !endpoint) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <h2
              className="text-xl font-semibold text-gray-900 truncate max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg"
              title={t('agents.modal.apiTest.title', { name: endpoint.name })}
            >
              {t('agents.modal.apiTest.title', { name: endpoint.name })}
            </h2>
            <span className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${getMethodColorClass(endpoint.method)} bg-opacity-10`}>
              {endpoint.method}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-4"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Endpoint info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span className={`font-medium ${getMethodColorClass(endpoint.method)}`}>
                  {endpoint.method}
                </span>
                <span className="font-mono">{endpoint.path}</span>
              </div>
              <p className="text-sm text-gray-700 mt-1">{endpoint.description}</p>
            </div>

            {/* Authentication method */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-medium text-gray-700">{t('agents.modal.apiTest.sections.authMethod', 'Authentication Method')}</h3>
                  {isAutoDetectedAuth() && (
                    <span
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full"
                      title={t('agents.modal.apiTest.auth.autoDetectedTitle', { level: t(`agents.modal.apiTest.auth.level.${endpoint?.autoDetectedAuth?.source === 'operation' ? 'operation' : 'global'}`) })}
                    >
                      {t('agents.modal.apiTest.auth.autoDetected', 'Auto-detected')}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{getAuthDisplayText()}</span>
                  {endpoint?.autoDetectedAuth && (
                    <span className="text-xs text-gray-400">
                      {endpoint.autoDetectedAuth.description && (
                        <span title={endpoint.autoDetectedAuth.description}>
                          {endpoint.autoDetectedAuth.schemeName}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Parameters and values */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">{t('apiTestModal.paramsAndValues', 'Parameters and values')}</h3>
              {parameters.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm font-medium text-gray-500 px-3">
                    <span>{t('agents.modal.apiTest.labels.param', 'Parameter')}</span>
                    <span>{t('agents.modal.apiTest.labels.value', 'Value')}</span>
                  </div>
                  {parameters.map((param, index) => (
                    <div key={index} className="grid grid-cols-2 gap-4">
                      <div className="px-3 py-2 bg-gray-50 rounded border">
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-medium ${param.deprecated ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                            {param.name}
                          </span>
                          {param.required && (
                            <span className="text-xs text-red-500 font-medium">*</span>
                          )}
                          {param.deprecated && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-yellow-100 text-yellow-700">
                              deprecated
                            </span>
                          )}
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            param.type === 'query' ? 'bg-blue-100 text-blue-700' :
                            param.type === 'path' ? 'bg-green-100 text-green-700' :
                            param.type === 'header' ? 'bg-purple-100 text-purple-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {param.type}
                          </span>
                        </div>
                        {param.description && (
                          <p className="text-xs text-gray-500 mt-1">{param.description}</p>
                        )}
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-400">
                          {param.schema.type && (
                            <span>{t('agents.modal.apiTest.labels.type', 'Type')}: {param.schema.type}</span>
                          )}
                          {param.schema.format && (
                            <span>{t('agents.modal.apiTest.labels.format', 'Format')}: {param.schema.format}</span>
                          )}
                          {param.schema.minimum !== undefined && (
                            <span>{t('agents.modal.apiTest.labels.min', 'Minimum')}: {param.schema.minimum}</span>
                          )}
                          {param.schema.maximum !== undefined && (
                            <span>{t('agents.modal.apiTest.labels.max', 'Maximum')}: {param.schema.maximum}</span>
                          )}
                          {param.schema.minLength !== undefined && (
                            <span>{t('agents.modal.apiTest.labels.minLength', 'Minimum length')}: {param.schema.minLength}</span>
                          )}
                          {param.schema.maxLength !== undefined && (
                            <span>{t('agents.modal.apiTest.labels.maxLength', 'Maximum length')}: {param.schema.maxLength}</span>
                          )}
                        </div>
                        {param.schema.pattern && (
                          <p className="text-xs text-gray-400 mt-1">{t('agents.modal.apiTest.labels.pattern', 'Pattern')}: {param.schema.pattern}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        {param.schema?.enum ? (
                          <select
                            value={param.value}
                            onChange={(e) => handleParameterChange(index, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          >
                            <option value="">{t('agents.modal.apiTest.placeholders.select', 'Please select')}</option>
                            {param.schema.enum.map((option, optIndex) => (
                              <option key={optIndex} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={param.schema.type === 'number' || param.schema.type === 'integer' ? 'number' : 'text'}
                            value={param.value}
                            onChange={(e) => handleParameterChange(index, e.target.value)}
                            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                              param.deprecated ? 'bg-gray-100 text-gray-500' : 'border-gray-300'
                            }`}
                            placeholder={
                              param.schema.example ? t('agents.modal.apiTest.placeholders.example', { value: String(param.schema.example) }) :
                              param.schema.default ? t('agents.modal.apiTest.placeholders.default', { value: String(param.schema.default) }) :
                              param.example ? t('agents.modal.apiTest.placeholders.example', { value: String(param.example) }) :
                              t('agents.modal.apiTest.placeholders.enter', 'Please enter')
                            }
                            required={param.required}
                            min={param.schema.minimum}
                            max={param.schema.maximum}
                            minLength={param.schema.minLength}
                            maxLength={param.schema.maxLength}
                            pattern={param.schema.pattern}
                            disabled={param.deprecated}
                            title={param.description}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 text-sm">
                  {t('agents.modal.apiTest.noParams', 'This endpoint defines no parameters')}
                </div>
              )}
            </div>

            {/* Test button */}
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              <span>{isTesting ? t('agents.modal.apiTest.buttons.testing', 'Testing...') : t('agents.modal.apiTest.buttons.test', 'Test')}</span>
            </button>

            {/* Test result */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">{t('agents.modal.apiTest.sections.testResult', 'Test Result')}</h3>
                <div className="text-xs text-gray-500">
                  <span title={t('agents.modal.apiTest.result.corsHintTitle', 'Note: due to browser CORS restrictions, some APIs cannot be tested directly')}>ⓘ {t('agents.modal.apiTest.result.corsHint', 'CORS hint')}</span>
                </div>
              </div>
              <div className="min-h-[200px] p-4 bg-gray-50 rounded-lg border">
                {testResult ? (
                  <div className="space-y-3">
                    {testResult.error ? (
                      <div className="text-red-600 text-sm">
                        <strong>{t('agents.modal.apiTest.result.error', 'Error:')}</strong>
                        <pre className="mt-2 whitespace-pre-wrap font-mono text-xs bg-red-50 p-2 rounded border">
                          {testResult.error}
                        </pre>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center space-x-4 text-sm">
                          <span className="text-green-600 font-medium">
                            {testResult.status} {testResult.statusText}
                          </span>
                          <span className="text-gray-500">
                            {testResult.timestamp && new Date(testResult.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        
                        {testResult.headers && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-600 mb-2">{t('agents.modal.apiTest.result.responseHeaders', 'Response headers:')}</h4>
                            <pre className="text-xs text-gray-700 bg-white p-2 rounded border overflow-x-auto">
                              {JSON.stringify(testResult.headers, null, 2)}
                            </pre>
                          </div>
                        )}
                        
                        {testResult.data && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-600 mb-2">{t('agents.modal.apiTest.result.responseData', 'Response data:')}</h4>
                            <pre className="text-xs text-gray-700 bg-white p-2 rounded border overflow-x-auto">
                              {JSON.stringify(testResult.data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-gray-500">
                    {t('agents.modal.apiTest.result.empty', 'Test results will be shown here')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Authentication method settings modal */}
        <AuthMethodModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSave={handleAuthSave}
          initialConfig={getEffectiveAuthConfig()} // Use the effective config, including auto-detected settings
        />
      </div>
    </div>
  );
};

export default ApiTestModal;
