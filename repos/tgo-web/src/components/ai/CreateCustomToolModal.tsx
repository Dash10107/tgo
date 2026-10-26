import React, { useState, useRef, useEffect } from 'react';
import { X, Wrench, XCircle, ExternalLink, ChevronDown, Settings } from 'lucide-react';
import { useAIStore } from '@/stores';
import { useToast } from './ToolToastProvider';
import { parseOpenAPISchema, getMethodColorClass, type ParsedEndpoint, type AutoDetectedAuth } from '@/utils/schemaParser';
import AuthMethodModal, { type AuthConfig } from './AuthMethodModal';
import ApiTestModal from './ApiTestModal';
import type { ToolCategory } from '@/types';

import { useTranslation } from 'react-i18next';
interface CreateCustomToolModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CustomToolFormData {
  name: string;
  description: string;
  category: ToolCategory;
  endpoint: string;
  apiKey: string;
  tags: string[];
  schema: string;
}

interface FormErrors {
  name?: string;
  description?: string;
  endpoint?: string;
  schema?: string;
}

interface SchemaTemplate {
  name: string;
  content: string;
}

// Predefined Schema templates
const SCHEMA_TEMPLATES: SchemaTemplate[] = [
  {
    name: 'Weather (JSON)',
    content: `{
  "openapi": "3.1.0",
  "info": {
    "title": "Get weather data",
    "description": "Retrieves current weather data for a location.",
    "version": "v1.0.0"
  },
  "servers": [
    {
      "url": "https://weather.example.com"
    }
  ],
  "paths": {
    "/location": {
      "get": {
        "description": "Get temperature for a specific location",
        "operationId": "GetCurrentWeather",
        "parameters": [
          {
            "name": "location",
            "in": "query",
            "description": "The city and state to retrieve the weather for",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "deprecated": false
      }
    }
  },
  "components": {
    "schemas": {}
  }
}`
  },
  {
    name: 'Pet Store (YAML)',
    content: `# Taken from https://github.com/OAI/OpenAPI-Specification/blob/main/examples/v3.0/petstore.yaml

openapi: "3.0.0"
info:
  version: 1.0.0
  title: Swagger Petstore
  license:
    name: MIT
servers:
  - url: https://petstore.swagger.io/v1
paths:
  /pets:
    get:
      summary: List all pets
      operationId: listPets
      tags:
        - pets
      parameters:
        - name: limit
          in: query
          description: How many items to return at one time (max 100)
          required: false
          schema:
            type: integer
            maximum: 100
            format: int32
      responses:
        '200':
          description: A paged array of pets
          headers:
            x-next:
              description: A link to the next page of responses
              schema:
                type: string
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Pets"
        default:
          description: unexpected error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
    post:
      summary: Create a pet
      operationId: createPets
      tags:
        - pets
      responses:
        '201':
          description: Null response
        default:
          description: unexpected error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
  /pets/{petId}:
    get:
      summary: Info for a specific pet
      operationId: showPetById
      tags:
        - pets
      parameters:
        - name: petId
          in: path
          required: true
          description: The id of the pet to retrieve
          schema:
            type: string
      responses:
        '200':
          description: Expected response to a valid request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Pet"
        default:
          description: unexpected error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
components:
  schemas:
    Pet:
      type: object
      required:
        - id
        - name
      properties:
        id:
          type: integer
          format: int64
        name:
          type: string
        tag:
          type: string
    Pets:
      type: array
      maxItems: 100
      items:
        $ref: "#/components/schemas/Pet"
    Error:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: integer
          format: int32
        message:
          type: string`
  },
  {
    name: 'User Management API (complex example)',
    content: `{
  "openapi": "3.0.3",
  "info": {
    "title": "User Management API",
    "description": "A comprehensive user management API with validation",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://api.example.com/v1"
    }
  ],
  "paths": {
    "/users": {
      "get": {
        "summary": "List users",
        "description": "Retrieve a paginated list of users with filtering options",
        "operationId": "listUsers",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "description": "Page number for pagination",
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 1,
              "default": 1,
              "example": 1
            }
          },
          {
            "name": "limit",
            "in": "query",
            "description": "Number of users per page",
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100,
              "default": 20,
              "example": 20
            }
          },
          {
            "name": "status",
            "in": "query",
            "description": "Filter users by status",
            "required": false,
            "schema": {
              "type": "string",
              "enum": ["active", "inactive", "pending"],
              "example": "active"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "List of users retrieved successfully"
          }
        }
      },
      "post": {
        "summary": "Create user",
        "description": "Create a new user account",
        "operationId": "createUser",
        "requestBody": {
          "description": "User data for creation",
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["name", "email"],
                "properties": {
                  "name": {
                    "type": "string",
                    "minLength": 2,
                    "maxLength": 100,
                    "description": "Full name of the user",
                    "example": "John Doe"
                  },
                  "email": {
                    "type": "string",
                    "format": "email",
                    "description": "Email address (must be unique)",
                    "example": "john.doe@example.com"
                  },
                  "age": {
                    "type": "integer",
                    "minimum": 13,
                    "maximum": 120,
                    "description": "User's age",
                    "example": 25
                  },
                  "role": {
                    "type": "string",
                    "enum": ["user", "admin", "moderator"],
                    "default": "user",
                    "description": "User role in the system"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "User created successfully"
          }
        }
      }
    },
    "/users/{userId}": {
      "get": {
        "summary": "Get user by ID",
        "description": "Retrieve a specific user by their ID",
        "operationId": "getUserByIdWithVeryLongOperationNameToTestTruncation",
        "parameters": [
          {
            "name": "userId",
            "in": "path",
            "description": "Unique identifier for the user",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid",
              "example": "123e4567-e89b-12d3-a456-426614174000"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "User retrieved successfully"
          }
        }
      }
    },
    "/users/{userId}/preferences/notifications/settings": {
      "put": {
        "summary": "Update user notification preferences",
        "description": "Update detailed notification preferences for a specific user",
        "operationId": "updateUserNotificationPreferencesWithExtremelyLongOperationNameForTruncationTesting",
        "parameters": [
          {
            "name": "userId",
            "in": "path",
            "description": "Unique identifier for the user",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "description": "Notification preferences to update",
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "emailNotifications": {
                    "type": "boolean",
                    "description": "Enable email notifications"
                  },
                  "pushNotifications": {
                    "type": "boolean",
                    "description": "Enable push notifications"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Preferences updated successfully"
          }
        }
      }
    }
  }
}`
  },
  {
    name: 'API Authentication Example (auto-detect)',
    content: `{
  "openapi": "3.0.3",
  "info": {
    "title": "Secure API Example",
    "description": "API with various authentication methods for auto-detection testing",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://api.secure-example.com/v1"
    }
  ],
  "security": [
    {
      "bearerAuth": []
    }
  ],
  "paths": {
    "/users": {
      "get": {
        "summary": "List users (Bearer Auth)",
        "description": "Get list of users using global Bearer authentication",
        "operationId": "listUsersWithBearerAuth",
        "parameters": [
          {
            "name": "limit",
            "in": "query",
            "description": "Number of users to return",
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100,
              "default": 20
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Users retrieved successfully"
          },
          "401": {
            "description": "Unauthorized"
          }
        }
      }
    },
    "/admin/users": {
      "get": {
        "summary": "Admin list users (API Key)",
        "description": "Admin endpoint with API key authentication",
        "operationId": "adminListUsers",
        "security": [
          {
            "apiKeyAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Admin users retrieved successfully"
          }
        }
      }
    },
    "/public/stats": {
      "get": {
        "summary": "Public statistics (No Auth)",
        "description": "Public endpoint with no authentication required",
        "operationId": "getPublicStats",
        "security": [],
        "responses": {
          "200": {
            "description": "Statistics retrieved successfully"
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "JWT Bearer token authentication"
      },
      "apiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key",
        "description": "API key authentication via header"
      },
      "basicAuth": {
        "type": "http",
        "scheme": "basic",
        "description": "Basic HTTP authentication"
      }
    }
  }
}`
  },
  {
    name: 'Blank Template',
    content: `{
  "openapi": "3.1.0",
  "info": {
    "title": "Untitled",
    "description": "Your OpenAPI specification",
    "version": "v1.0.0"
  },
  "servers": [
    {
      "url": ""
    }
  ],
  "paths": {},
  "components": {
    "schemas": {}
  }
}`
  }
];

/**
 * Create custom tool modal component
 */
const CreateCustomToolModal: React.FC<CreateCustomToolModalProps> = ({
  isOpen,
  onClose
}) => {
  const { t } = useTranslation();
  const { createTool } = useAIStore();
  const { showToast } = useToast();
  
  const [formData, setFormData] = useState<CustomToolFormData>({
    name: '',
    description: '',
    category: 'productivity',
    endpoint: '',
    apiKey: '',
    tags: [],
    schema: ''
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [isCreating, setIsCreating] = useState(false);
  const [showExamplesDropdown, setShowExamplesDropdown] = useState(false);
  const [parsedEndpoints, setParsedEndpoints] = useState<ParsedEndpoint[]>([]);
  const [isParsingSchema, setIsParsingSchema] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfig>({ type: 'none' });
  const [showTestModal, setShowTestModal] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<ParsedEndpoint | null>(null);

  const examplesDropdownRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (examplesDropdownRef.current && !examplesDropdownRef.current.contains(event.target as Node)) {
        setShowExamplesDropdown(false);
      }
    };

    if (showExamplesDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }

    return undefined;
  }, [showExamplesDropdown]);

  // Parse the Schema content
  useEffect(() => {
    const parseSchema = async () => {
      if (!formData.schema.trim()) {
        setParsedEndpoints([]);
        // Reset the authentication config when the schema is empty
        if (authConfig.type !== 'none') {
          setAuthConfig({ type: 'none' });
        }
        return;
      }

      setIsParsingSchema(true);

      try {
        // Use the enhanced async parser
        const endpoints = await parseOpenAPISchema(formData.schema);
        setParsedEndpoints(endpoints);

        // Auto-detect and configure authentication
        if (endpoints.length > 0) {
          // Find the first endpoint that has auto-detected authentication
          const endpointWithAuth = endpoints.find(endpoint => endpoint.autoDetectedAuth);

          if (endpointWithAuth?.autoDetectedAuth && authConfig.type === 'none') {
            const autoAuthConfig = convertAutoDetectedAuth(endpointWithAuth.autoDetectedAuth);
            setAuthConfig(autoAuthConfig);

            // Show the auto-detection success notice
            const authTypeText = endpointWithAuth.autoDetectedAuth.type === 'header' ? t('authMethod.header', 'Request Header') : t('authMethod.query', 'Query Parameter');
            const sourceText = endpointWithAuth.autoDetectedAuth.source === 'operation' ? t('customTool.authSourceOperation', 'operation level') : t('customTool.authSourceGlobal', 'global level');

            setTimeout(() => {
              showToast(
                'success',
                t('customTool.authAutoConfigured', 'Authentication auto-configured'),
                t('customTool.authDetectedFromSpec', { authType: authTypeText, source: sourceText, defaultValue: 'Detected {{authType}} authentication from the OpenAPI spec ({{source}})' })
              );
            }, 500); // Delay the display to avoid conflicting with the parse success notice
          }
        } else {
          // If no endpoint was found, reset the authentication config
          if (authConfig.type !== 'none') {
            setAuthConfig({ type: 'none' });
          }
        }
      } catch (error) {
        console.error('Schema parsing error:', error);
        setParsedEndpoints([]);
        // Reset the authentication config when parsing fails
        if (authConfig.type !== 'none') {
          setAuthConfig({ type: 'none' });
        }
      } finally {
        setIsParsingSchema(false);
      }
    };

    parseSchema();
  }, [formData.schema]);

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = t('customTool.errors.nameRequired', 'Please enter a tool name');
    } else if (formData.name.length > 50) {
      newErrors.name = t('customTool.errors.nameTooLong', 'Tool name cannot exceed 50 characters');
    }
    
    if (!formData.schema.trim()) {
      newErrors.schema = t('customTool.errors.schemaRequired', 'Please enter the Schema configuration');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setIsCreating(true);
      
      // Simulate an API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Create the tool using the store
      createTool({
        name: formData.name,
        description: formData.description,
        category: formData.category,
        endpoint: formData.endpoint,
        author: 'Custom',
        tags: formData.tags,
        version: 'v1.0.0'
      });
      
      showToast('success', t('customTool.createSuccess', 'Created successfully'), t('customTool.createSuccessMessage', { name: formData.name, defaultValue: 'Custom tool "{{name}}" has been created' }));
      handleClose();
    } catch (error) {
      console.error('Failed to create custom tool:', error);
      showToast('error', t('customTool.createFailed', 'Creation failed'), t('customTool.createFailedMessage', 'An error occurred while creating the custom tool, please try again'));
    } finally {
      setIsCreating(false);
    }
  };

  // Handle modal close
  const handleClose = () => {
    if (isCreating) return;
    
    setFormData({
      name: '',
      description: '',
      category: 'productivity',
      endpoint: '',
      apiKey: '',
      tags: [],
      schema: ''
    });
    setErrors({});
    onClose();
  };

  // Handle input changes
  const handleInputChange = (field: keyof CustomToolFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear errors
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle template selection
  const handleTemplateSelect = (template: SchemaTemplate) => {
    handleInputChange('schema', template.content);
    setShowExamplesDropdown(false);
  };

  // Toggle the examples dropdown
  const toggleExamplesDropdown = () => {
    setShowExamplesDropdown(!showExamplesDropdown);
  };

  // Handle saving the authentication config
  const handleAuthSave = (config: AuthConfig) => {
    setAuthConfig(config);
  };

  // Check whether the authentication was auto-detected
  const isAutoDetectedAuth = () => {
    if (parsedEndpoints.length === 0) return false;

    const endpointWithAuth = parsedEndpoints.find(endpoint => endpoint.autoDetectedAuth);
    const autoAuth = endpointWithAuth?.autoDetectedAuth;

    return autoAuth && (
      (authConfig.type === autoAuth.type && authConfig.key === autoAuth.key) ||
      (authConfig.type !== 'none' && autoAuth.type !== 'none')
    );
  };

  // Get the authentication display text
  const getAuthDisplayText = () => {
    const endpointWithAuth = parsedEndpoints.find(endpoint => endpoint.autoDetectedAuth);
    const autoAuth = endpointWithAuth?.autoDetectedAuth;

    if (authConfig.type === 'none') {
      if (autoAuth && autoAuth.type !== 'none') {
        return `${t('authMethod.autoDetected', 'Auto-detected')}: ${autoAuth.type === 'header' ? t('authMethod.header', 'Request Header') : t('authMethod.query', 'Query Parameter')}`;
      }
      return t('authMethod.none', 'None');
    } else if (authConfig.type === 'header') {
      return `${t('authMethod.header', 'Request Header')} (${authConfig.headerPrefix?.toUpperCase()})`;
    } else if (authConfig.type === 'query') {
      return t('authMethod.query', 'Query Parameter');
    }
    return t('authMethod.none', 'None');
  };

  // Convert the auto-detected authentication to an AuthConfig
  const convertAutoDetectedAuth = (autoAuth: AutoDetectedAuth): AuthConfig => {
    return {
      type: autoAuth.type,
      headerPrefix: autoAuth.headerPrefix,
      key: autoAuth.key,
      value: '', // The user must enter the real API key
    };
  };

  // Handle test button click
  const handleTestEndpoint = (endpoint: ParsedEndpoint, e?: React.MouseEvent) => {
    // Prevent any form submission or event bubbling
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // If the endpoint has auto-detected authentication and the current auth is in its default state, apply the auto-detected config
    if (endpoint.autoDetectedAuth && authConfig.type === 'none') {
      const autoAuthConfig = convertAutoDetectedAuth(endpoint.autoDetectedAuth);
      setAuthConfig(autoAuthConfig);
    }

    setSelectedEndpoint(endpoint);
    setShowTestModal(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{t('customTool.title', 'Create Custom Tool')}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isCreating}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Tool name */}
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                <Wrench className="w-4 h-4 text-yellow-600" />
                <span>{t('customTool.name', 'Name')} <span className="text-red-500">*</span></span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                  errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                }`}
                placeholder={t('customTool.namePlaceholder', 'Enter tool name')}
                disabled={isCreating}
                maxLength={50}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500 flex items-center space-x-1">
                  <XCircle className="w-4 h-4" />
                  <span>{errors.name}</span>
                </p>
              )}
            </div>

            {/* Schema configuration */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <span>Schema <span className="text-red-500">*</span></span>
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    className="flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                    onClick={() => window.open('https://swagger.io/specification/', '_blank')}
                  >
                    <span>{t('customTool.viewOpenApiSpec', 'View OpenAPI-Swagger specification')}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <div className="relative" ref={examplesDropdownRef}>
                    <button
                      type="button"
                      className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-700 transition-colors"
                      onClick={toggleExamplesDropdown}
                    >
                      <span>{t('customTool.examples', 'Examples')}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showExamplesDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown menu */}
                    {showExamplesDropdown && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                        <div className="py-1">
                          {SCHEMA_TEMPLATES.map((template, index) => (
                            <button
                              key={index}
                              type="button"
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                              onClick={() => handleTemplateSelect(template)}
                            >
                              {template.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <textarea
                value={formData.schema}
                onChange={(e) => handleInputChange('schema', e.target.value)}
                rows={12}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 resize-none font-mono text-sm ${
                  errors.schema ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                }`}
                placeholder={t('customTool.schemaPlaceholder', 'Enter OpenAPI Schema configuration...')}
                disabled={isCreating}
              />
              {errors.schema && (
                <p className="mt-1 text-sm text-red-500 flex items-center space-x-1">
                  <XCircle className="w-4 h-4" />
                  <span>{errors.schema}</span>
                </p>
              )}
            </div>

            {/* Available tools table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">{t('customTool.availableTools', 'Available tools')}</h3>
                {isParsingSchema && (
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <div className="animate-spin w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full"></div>
                    <span>{t('customTool.parsing', 'Parsing...')}</span>
                  </div>
                )}
              </div>
              <div className="border border-gray-200 rounded-lg overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('customTool.table.name', 'Name')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('customTool.table.description', 'Description')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('customTool.table.method', 'Method')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('customTool.table.path', 'Path')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('customTool.table.actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {parsedEndpoints.length > 0 ? (
                      parsedEndpoints.map((endpoint, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-sm text-gray-900">{endpoint.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{endpoint.description}</td>
                          <td className={`px-4 py-3 text-sm font-medium ${getMethodColorClass(endpoint.method)}`}>
                            {endpoint.method.toLowerCase()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{endpoint.path}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleTestEndpoint(endpoint);
                              }}
                              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                            >
                              {t('customTool.test', 'Test')}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                          {formData.schema.trim() ? t('customTool.noValidEndpoints', 'No valid API endpoints found') : t('customTool.enterSchemaToView', 'Enter an OpenAPI Schema to view available tools')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Authentication method */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-medium text-gray-700">{t('authMethod.title', 'Authentication Method')}</h3>
                  {isAutoDetectedAuth() && (
                    <span
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full"
                      title={t('customTool.autoDetectedAuthTitle', 'Authentication configuration auto-detected from the OpenAPI spec')}
                    >
                      {t('authMethod.autoDetectedShort', 'Auto-detect')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                   onClick={() => setShowAuthModal(true)}>
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm text-gray-600">{getAuthDisplayText()}</span>
                  {parsedEndpoints.find(endpoint => endpoint.autoDetectedAuth) && (
                    <span className="text-xs text-gray-400 mr-8">
                      {(() => {
                        const endpointWithAuth = parsedEndpoints.find(endpoint => endpoint.autoDetectedAuth);
                        const autoAuth = endpointWithAuth?.autoDetectedAuth;
                        return autoAuth?.description ? (
                          <span title={autoAuth.description}>
                            {autoAuth.schemeName}
                          </span>
                        ) : null;
                      })()}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAuthModal(true);
                  }}
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              disabled={isCreating}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              disabled={isCreating}
            >
              <span>{isCreating ? t('common.saving', 'Saving...') : t('common.save', 'Save')}</span>
            </button>
          </div>
        </form>

        {/* Authentication method settings modal */}
        <AuthMethodModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSave={handleAuthSave}
          initialConfig={authConfig}
        />

        {/* API test modal */}
        <ApiTestModal
          isOpen={showTestModal}
          onClose={() => setShowTestModal(false)}
          endpoint={selectedEndpoint}
          authConfig={authConfig}
          onAuthConfigChange={handleAuthSave}
        />
      </div>
    </div>
  );
};

export default CreateCustomToolModal;
