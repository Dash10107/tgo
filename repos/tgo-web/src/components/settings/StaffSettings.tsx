/**
 * Staff Settings Component
 * Manage human agents/staff members
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  UserPlus,
  X,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Info,
  Settings2,
  Save,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  Brain,
} from 'lucide-react';
import { staffApi, StaffRole, StaffStatus, StaffUpdateRequest, VisitorAssignmentRuleResponse } from '@/services/staffApi';
import { StaffResponse, StaffCreateRequest } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import AIProvidersApiService from '@/services/aiProvidersApi';
import Toggle from '@/components/ui/Toggle';

// Role configuration for display (colors only, labels from i18n)
const roleStyleConfig: Record<StaffRole, { bgColor: string; textColor: string }> = {
  admin: { bgColor: 'bg-purple-100 dark:bg-purple-900/30', textColor: 'text-purple-700 dark:text-purple-300' },
  user: { bgColor: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-700 dark:text-blue-300' },
  agent: { bgColor: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-700 dark:text-green-300' },
};

// Status configuration for display (colors only, labels from i18n)
const statusStyleConfig: Record<StaffStatus, { dotColor: string }> = {
  online: { dotColor: 'bg-green-500' },
  offline: { dotColor: 'bg-gray-400' },
  busy: { dotColor: 'bg-yellow-500' },
};

// Form data type
interface StaffFormData {
  username: string;
  name: string;
  password: string;
  confirmPassword: string;
  description: string;
  role: StaffRole;
  status: StaffStatus;
}

// Initial form state
const initialFormData: StaffFormData = {
  username: '',
  name: '',
  password: '',
  confirmPassword: '',
  description: '',
  role: 'user',
  status: 'offline',
};

interface StaffDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: StaffCreateRequest | StaffUpdateRequest) => Promise<void>;
  staff?: StaffResponse | null;
  isLoading?: boolean;
}

const StaffDialog: React.FC<StaffDialogProps> = ({
  open,
  onClose,
  onSubmit,
  staff,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const isEditing = !!staff;
  const [formData, setFormData] = useState<StaffFormData>(initialFormData);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof StaffFormData, string>>>({});

  useEffect(() => {
    if (staff) {
      setFormData({
        username: staff.username,
        name: staff.nickname || '',
        password: '',
        confirmPassword: '',
        description: staff.description || '',
        role: (staff.role as StaffRole) || 'user',
        status: (staff.status as StaffStatus) || 'offline',
      });
    } else {
      setFormData(initialFormData);
    }
    setErrors({});
  }, [staff, open]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof StaffFormData, string>> = {};

    // Name is always required
    if (!formData.name.trim()) {
      newErrors.name = t('settings.staff.errors.nameRequired', 'Please enter name');
    }

    if (!isEditing) {
      if (!formData.username.trim()) {
        newErrors.username = t('settings.staff.errors.usernameRequired', 'Please enter username');
      } else if (formData.username.length < 1 || formData.username.length > 50) {
        newErrors.username = t('settings.staff.errors.usernameLength', 'Username must be between 1-50 characters');
      }

      if (!formData.password) {
        newErrors.password = t('settings.staff.errors.passwordRequired', 'Please enter password');
      } else if (formData.password.length < 8) {
        newErrors.password = t('settings.staff.errors.passwordLength', 'Password must be at least 8 characters');
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = t('settings.staff.errors.passwordMismatch', 'Passwords do not match');
      }
    } else {
      // When editing, only validate password if it's being changed
      if (formData.password && formData.password.length < 8) {
        newErrors.password = t('settings.staff.errors.passwordLength', 'Password must be at least 8 characters');
      }
      if (formData.password && formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = t('settings.staff.errors.passwordMismatch', 'Passwords do not match');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (isEditing) {
      const updateData: StaffUpdateRequest = {
        nickname: formData.name,
        description: formData.description || null,
        role: formData.role,
        status: formData.status,
      };
      if (formData.password) {
        updateData.password = formData.password;
      }
      await onSubmit(updateData);
    } else {
      const createData: StaffCreateRequest = {
        username: formData.username,
        password: formData.password,
        nickname: formData.name,
        description: formData.description || null,
      };
      await onSubmit(createData);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              {isEditing
                ? t('settings.staff.editStaff', 'Edit Staff')
                : t('settings.staff.addStaff', 'Add Staff')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Username - Required for new staff */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('settings.staff.username', 'Username')} {!isEditing && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              disabled={isEditing}
              className={`
                w-full px-3 py-2 rounded-lg border transition-colors
                ${isEditing ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : 'bg-white dark:bg-gray-800'}
                ${errors.username
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                }
                focus:outline-none focus:ring-2 focus:ring-offset-0
                text-gray-800 dark:text-gray-200
              `}
              placeholder={t('settings.staff.usernamePlaceholder', 'Enter username')}
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.username}
              </p>
            )}
          </div>

          {/* Name - Required */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('settings.staff.name', 'Name')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`
                w-full px-3 py-2 rounded-lg border transition-colors
                bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200
                ${errors.name
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                }
                focus:outline-none focus:ring-2 focus:ring-offset-0
              `}
              placeholder={t('settings.staff.namePlaceholder', 'Enter name')}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Password - Required for new staff */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('settings.staff.password', 'Password')} {!isEditing && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={`
                  w-full px-3 py-2 pr-10 rounded-lg border transition-colors
                  bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200
                  ${errors.password
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                  }
                  focus:outline-none focus:ring-2 focus:ring-offset-0
                `}
                placeholder={isEditing
                  ? t('settings.staff.passwordPlaceholderEdit', 'Leave empty to keep current password')
                  : t('settings.staff.passwordPlaceholder', 'Enter password (at least 8 characters)')
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.password}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('settings.staff.confirmPassword', 'Confirm Password')} {!isEditing && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className={`
                  w-full px-3 py-2 pr-10 rounded-lg border transition-colors
                  bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200
                  ${errors.confirmPassword
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                  }
                  focus:outline-none focus:ring-2 focus:ring-offset-0
                `}
                placeholder={t('settings.staff.confirmPasswordPlaceholder', 'Re-enter password')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Description - Optional */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('settings.staff.descriptionLabel', 'Description')}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="
                w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0
                transition-colors resize-none
              "
              placeholder={t('settings.staff.descriptionPlaceholder', 'Enter staff description (optional)')}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="
                flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800
                hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
              "
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="
                flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white
                hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors flex items-center justify-center gap-2
              "
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing
                ? t('common.save', 'Save')
                : t('common.create', 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Delete confirmation dialog
interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  staffName: string;
  isLoading?: boolean;
}

const DeleteDialog: React.FC<DeleteDialogProps> = ({
  open,
  onClose,
  onConfirm,
  staffName,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30">
            <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-center text-gray-800 dark:text-gray-200 mb-2">
            {t('settings.staff.deleteConfirmTitle', 'Confirm Delete')}
          </h3>
          <p className="text-sm text-center text-gray-600 dark:text-gray-400">
            {t('settings.staff.deleteConfirmMessage', 'Are you sure you want to delete staff "{{name}}"? This action cannot be undone.', { name: staffName })}
          </p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="
              flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600
              text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800
              hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
            "
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="
              flex-1 px-4 py-2 rounded-lg bg-red-600 text-white
              hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors flex items-center justify-center gap-2
            "
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('common.delete', 'Delete')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Default assignment rules prompt
const DEFAULT_ASSIGNMENT_PROMPT = `You are an intelligent customer-service assignment assistant. When the AI cannot resolve a user's problem, assign the conversation to a suitable human agent according to the following rules:

## Assignment principles
1. **Skill match**: based on the type of the user's problem, prefer agents with relevant expertise
2. **Load balancing**: among skill-matched agents, prefer the agent currently handling fewer conversations
3. **Online status**: only assign to online agents; busy agents are a fallback
4. **Response speed**: consider each agent's historical average response time and prefer faster agents

## Assignment process
1. Analyze the conversation to identify the problem type and urgency
2. Filter the available agents that meet the conditions
3. Sort by priority and choose the most suitable agent
4. If no agent is suitable, put the conversation into the waiting queue

## Special cases
- Urgent problems: assign to experienced senior agents first
- VIP users: consider assigning to a dedicated agent
- Complaints: assign to agents with complaint-handling experience`;

const StaffSettings: React.FC = () => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  
  const [staffList, setStaffList] = useState<StaffResponse[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Dropdown menu state
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Service toggle state (for is_active)
  const [togglingActiveStaffId, setTogglingActiveStaffId] = useState<string | null>(null);

  // Assignment rules state
  const [assignmentRulesExpanded, setAssignmentRulesExpanded] = useState(false);
  const [_assignmentRule, setAssignmentRule] = useState<VisitorAssignmentRuleResponse | null>(null);
  const [assignmentPrompt, setAssignmentPrompt] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState(DEFAULT_ASSIGNMENT_PROMPT);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [savingRules, setSavingRules] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(true);
  
  // New assignment rule fields
  const [llmAssignmentEnabled, setLlmAssignmentEnabled] = useState(false);
  const [timezone, setTimezone] = useState('Asia/Shanghai');
  const [serviceWeekdays, setServiceWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [serviceStartTime, setServiceStartTime] = useState('09:00');
  const [serviceEndTime, setServiceEndTime] = useState('18:00');
  const [maxConcurrentChats, setMaxConcurrentChats] = useState(10);
  const [autoCloseHours, setAutoCloseHours] = useState(48);

  const [llmOptions, setLlmOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Fetch chat models from providers
  useEffect(() => {
    let cancelled = false;
    const fetchChatOptions = async () => {
      setModelsLoading(true);
      try {
        const svc = new AIProvidersApiService();
        const res = await svc.listProjectModels({ model_type: 'chat', is_active: true });
        const options = (res.data || []).map((m: any) => ({
          value: `${m.provider_id}:${m.model_id}`,
          label: `${m.model_name} · ${m.provider_name}`,
        }));
        if (!cancelled) {
          setLlmOptions(options);
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      } finally {
        if (!cancelled) {
          setModelsLoading(false);
        }
      }
    };
    fetchChatOptions();
    return () => { cancelled = true; };
  }, []);

  // Fetch staff list
  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const response = await staffApi.listStaff();
      setStaffList(response.data);
    } catch (error) {
      console.error('Failed to fetch staff:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Toggle staff is_active status (long-term service switch)
  const handleToggleIsActive = async (staffId: string, currentActive: boolean) => {
    if (togglingActiveStaffId) return;

    setTogglingActiveStaffId(staffId);
    try {
      const updated = await staffApi.setStaffIsActive(staffId, !currentActive);
      // Update the staff list with the new data
      setStaffList(prev => prev.map(s => s.id === staffId ? updated : s));
      showSuccess(
        currentActive
          ? t('settings.staff.serviceStopped', 'Service stopped for this agent')
          : t('settings.staff.serviceStarted', 'Service started for this agent')
      );
    } catch (error: any) {
      console.error('Failed to toggle is_active:', error);
      showError(error?.message || t('settings.staff.toggleActiveError', 'Failed to toggle service status'));
    } finally {
      setTogglingActiveStaffId(null);
    }
  };

  // Fetch assignment rules on mount
  useEffect(() => {
    const fetchAssignmentRules = async () => {
      setRulesLoading(true);
      try {
        // Fetch default prompt first
        const defaultRes = await staffApi.getDefaultAssignmentPrompt();
        setDefaultPrompt(defaultRes.default_prompt);
        
        // Fetch current assignment rule
        const ruleRes = await staffApi.getAssignmentRule();
        setAssignmentRule(ruleRes);
        
        // Set prompt (use custom or effective)
        setAssignmentPrompt(ruleRes.prompt || ruleRes.effective_prompt);
        
        // Set model if exists (format: providerId:modelName)
        if (ruleRes.ai_provider_id && ruleRes.model) {
          setSelectedModelId(`${ruleRes.ai_provider_id}:${ruleRes.model}`);
        }
        
        // Set new fields
        setLlmAssignmentEnabled(ruleRes.llm_assignment_enabled);
        setTimezone(ruleRes.timezone || 'Asia/Shanghai');
        setServiceWeekdays(ruleRes.service_weekdays || [1, 2, 3, 4, 5]);
        setServiceStartTime(ruleRes.service_start_time || '09:00');
        setServiceEndTime(ruleRes.service_end_time || '18:00');
        setMaxConcurrentChats(ruleRes.max_concurrent_chats || 10);
        setAutoCloseHours(ruleRes.auto_close_hours || 48);
      } catch (error) {
        console.error('Failed to fetch assignment rules:', error);
        // Use default prompt if API fails
        setAssignmentPrompt(DEFAULT_ASSIGNMENT_PROMPT);
      } finally {
        setRulesLoading(false);
      }
    };
    fetchAssignmentRules();
  }, []);

  // Handle create/update staff
  const handleSubmit = async (data: StaffCreateRequest | StaffUpdateRequest) => {
    try {
      setSubmitting(true);
      if (selectedStaff) {
        await staffApi.updateStaff(selectedStaff.id, data as StaffUpdateRequest);
        showSuccess(t('settings.staff.updateSuccess', 'Staff updated successfully'));
      } else {
        await staffApi.createStaff(data as StaffCreateRequest);
        showSuccess(t('settings.staff.createSuccess', 'Staff created successfully'));
      }
      setDialogOpen(false);
      setSelectedStaff(null);
      fetchStaff();
    } catch (error: any) {
      console.error('Failed to save staff:', error);
      const errorMessage = error?.message || t('settings.staff.saveError', 'Save failed');
      showError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete staff
  const handleDelete = async () => {
    if (!selectedStaff) return;
    
    try {
      setSubmitting(true);
      await staffApi.deleteStaff(selectedStaff.id);
      showSuccess(t('settings.staff.deleteSuccess', 'Staff deleted successfully'));
      setDeleteDialogOpen(false);
      setSelectedStaff(null);
      fetchStaff();
    } catch (error: any) {
      console.error('Failed to delete staff:', error);
      const errorMessage = error?.message || t('settings.staff.deleteError', 'Delete failed');
      showError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Open edit dialog
  const handleEdit = (staff: StaffResponse) => {
    setSelectedStaff(staff);
    setDialogOpen(true);
    setMenuOpen(null);
  };

  // Open delete dialog
  const handleDeleteClick = (staff: StaffResponse) => {
    setSelectedStaff(staff);
    setDeleteDialogOpen(true);
    setMenuOpen(null);
  };

  // Open create dialog
  const handleCreate = () => {
    setSelectedStaff(null);
    setDialogOpen(true);
  };

  // Save assignment rules
  const handleSaveRules = async () => {
    try {
      setSavingRules(true);
      
      // Parse selected model (format: providerId:modelName)
      let ai_provider_id: string | null = null;
      let model: string | null = null;
      if (selectedModelId) {
        const [providerId, ...modelParts] = selectedModelId.split(':');
        ai_provider_id = providerId;
        model = modelParts.join(':');
      }
      
      const ruleRes = await staffApi.updateAssignmentRule({
        ai_provider_id,
        model,
        prompt: assignmentPrompt || null,
        llm_assignment_enabled: llmAssignmentEnabled,
        timezone,
        service_weekdays: serviceWeekdays,
        service_start_time: serviceStartTime,
        service_end_time: serviceEndTime,
        max_concurrent_chats: maxConcurrentChats,
        auto_close_hours: autoCloseHours,
      });
      
      setAssignmentRule(ruleRes);
      showSuccess(t('settings.staff.rulesSaved', 'Assignment rules saved successfully'));
    } catch (error) {
      console.error('Failed to save rules:', error);
      showError(t('settings.staff.rulesSaveError', 'Failed to save assignment rules'));
    } finally {
      setSavingRules(false);
    }
  };

  // Reset assignment rules to default
  const handleResetRules = () => {
    setAssignmentPrompt(defaultPrompt);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">
            {t('settings.staff.title', 'Human Agents')}
          </h2>
        </div>
        <button
          onClick={handleCreate}
          className="
            flex items-center gap-2 px-4 py-2 rounded-lg
            bg-blue-600 text-white hover:bg-blue-700 transition-colors
          "
        >
          <Plus className="w-4 h-4" />
          {t('settings.staff.addStaff', 'Add Staff')}
        </button>
      </div>

      {/* Description Card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">{t('settings.staff.description', 'About Human Agents')}</p>
            <p className="text-blue-700 dark:text-blue-300">
              {t('settings.staff.descriptionText', 'When AI agents cannot resolve user issues, the system automatically assigns conversations to human agents. Human agents can take over conversations to provide more professional human support.')}
            </p>
          </div>
        </div>
      </div>

      {/* Assignment Rules */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          onClick={() => setAssignmentRulesExpanded(!assignmentRulesExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {t('settings.staff.assignmentRules', 'Assignment Rules')}
            </span>
          </div>
          {assignmentRulesExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
        
        {assignmentRulesExpanded && (
          <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
            {rulesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              </div>
            ) : (
              <div className="space-y-6 mt-4">
                {/* Service Time Settings */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <h3 className="font-medium text-gray-800 dark:text-gray-200">
                      {t('settings.staff.serviceTime', 'Service Hours')}
                    </h3>
                  </div>
                  
                  {/* Weekdays */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('settings.staff.serviceWeekdays', 'Service Days')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 1, label: t('settings.staff.weekday.mon', 'Mon') },
                        { value: 2, label: t('settings.staff.weekday.tue', 'Tue') },
                        { value: 3, label: t('settings.staff.weekday.wed', 'Wed') },
                        { value: 4, label: t('settings.staff.weekday.thu', 'Thu') },
                        { value: 5, label: t('settings.staff.weekday.fri', 'Fri') },
                        { value: 6, label: t('settings.staff.weekday.sat', 'Sat') },
                        { value: 7, label: t('settings.staff.weekday.sun', 'Sun') },
                      ].map((day) => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            if (serviceWeekdays.includes(day.value)) {
                              setServiceWeekdays(serviceWeekdays.filter(d => d !== day.value));
                            } else {
                              setServiceWeekdays([...serviceWeekdays, day.value].sort());
                            }
                          }}
                          className={`
                            px-3 py-1.5 text-sm rounded-lg border transition-colors
                            ${serviceWeekdays.includes(day.value)
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-500'
                            }
                          `}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Time Range */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('settings.staff.serviceStartTime', 'Start Time')}
                      </label>
                      <input
                        type="time"
                        value={serviceStartTime}
                        onChange={(e) => setServiceStartTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('settings.staff.serviceEndTime', 'End Time')}
                      </label>
                      <input
                        type="time"
                        value={serviceEndTime}
                        onChange={(e) => setServiceEndTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  {/* Timezone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('settings.staff.timezone', 'Timezone')}
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                      <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                      <option value="America/New_York">America/New_York (UTC-5)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                      <option value="Europe/London">Europe/London (UTC+0)</option>
                      <option value="Europe/Paris">Europe/Paris (UTC+1)</option>
                    </select>
                  </div>
                </div>

                {/* Chat Settings */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <h3 className="font-medium text-gray-800 dark:text-gray-200">
                      {t('settings.staff.chatSettings', 'Chat Settings')}
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Max Concurrent Chats */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('settings.staff.maxConcurrentChats', 'Max Concurrent Chats')}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={maxConcurrentChats}
                        onChange={(e) => setMaxConcurrentChats(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t('settings.staff.maxConcurrentChatsHint', 'Maximum number of conversations each agent can handle simultaneously')}
                      </p>
                    </div>
                    
                    {/* Auto Close Hours */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('settings.staff.autoCloseHours', 'Auto Close Time')}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="720"
                          value={autoCloseHours}
                          onChange={(e) => setAutoCloseHours(Math.max(1, Math.min(720, parseInt(e.target.value) || 1)))}
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {t('settings.staff.hours', 'hours')}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t('settings.staff.autoCloseHoursHint', 'Time after which inactive conversations are automatically closed')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* LLM Assignment Settings */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <h3 className="font-medium text-gray-800 dark:text-gray-200">
                        {t('settings.staff.llmAssignment', 'Intelligent Assignment')}
                      </h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={llmAssignmentEnabled}
                        onChange={(e) => setLlmAssignmentEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {t('settings.staff.llmAssignmentHint', 'When enabled, the system uses an LLM with this prompt to intelligently assign conversations to the most suitable agent.')}
                  </p>
                  
                  {llmAssignmentEnabled && (
                    <>
                      {/* Model Selector */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('settings.staff.assignmentModel', 'Assignment Model')}
                        </label>
                        <select
                          value={selectedModelId}
                          onChange={(e) => setSelectedModelId(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 transition-colors"
                          disabled={modelsLoading}
                        >
                          <option value="">{t('settings.staff.selectModel', 'Select a model')}</option>
                          {llmOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {t('settings.staff.assignmentModelHint', 'Select the LLM for intelligent conversation assignment, models come from Model Providers configuration')}
                        </p>
                      </div>

                      {/* Assignment Prompt */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('settings.staff.assignmentPrompt', 'Assignment Prompt')}
                          </label>
                          <span className={`text-xs ${assignmentPrompt.length > 1000 ? 'text-red-500' : 'text-gray-400'}`}>
                            {assignmentPrompt.length}/1000
                          </span>
                        </div>
                        <textarea
                          value={assignmentPrompt}
                          onChange={(e) => {
                            if (e.target.value.length <= 1000) {
                              setAssignmentPrompt(e.target.value);
                            }
                          }}
                          maxLength={1000}
                          rows={8}
                          className={`
                            w-full px-3 py-2 rounded-lg border
                            bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                            focus:outline-none focus:ring-2 focus:ring-offset-0
                            placeholder:text-gray-400 transition-colors font-mono text-sm
                            resize-y min-h-[150px]
                            ${assignmentPrompt.length > 1000
                              ? 'border-red-500 focus:ring-red-500'
                              : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                            }
                          `}
                          placeholder={t('settings.staff.assignmentRulesPlaceholder', 'Enter assignment rules prompt...')}
                        />
                        {assignmentPrompt.length > 1000 && (
                          <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {t('settings.staff.promptTooLong', 'Prompt cannot exceed 1000 characters')}
                          </p>
                        )}
                        <button
                          onClick={handleResetRules}
                          className="mt-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                        >
                          {t('settings.staff.resetToDefault', 'Reset to Default')}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveRules}
                    disabled={savingRules || assignmentPrompt.length > 1000}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingRules ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {t('settings.staff.saveRules', 'Save Rules')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Staff List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : staffList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <Users className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">
              {t('settings.staff.empty', 'No staff yet, click "Add Staff" to create')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('settings.staff.tableUser', 'User')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('settings.staff.tableRole', 'Role')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('settings.staff.tableDescription', 'Description')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('settings.staff.tableStatus', 'Status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('settings.staff.tableServiceActive', 'Service')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('settings.staff.tableCreated', 'Created At')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('settings.staff.tableActions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
                          {(staff.nickname || staff.username).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {staff.nickname || staff.username}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            @{staff.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`
                        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${roleStyleConfig[staff.role as StaffRole]?.bgColor || 'bg-gray-100 dark:bg-gray-700'}
                        ${roleStyleConfig[staff.role as StaffRole]?.textColor || 'text-gray-700 dark:text-gray-300'}
                      `}>
                        {t(`settings.staff.roles.${staff.role}`, staff.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 max-w-xs">
                        {staff.description || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${statusStyleConfig[staff.status as StaffStatus]?.dotColor || 'bg-gray-400'}`} />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {t(`settings.staff.statuses.${staff.status}`, staff.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {togglingActiveStaffId === staff.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : (
                          <Toggle
                            checked={staff.is_active}
                            onChange={() => handleToggleIsActive(staff.id, staff.is_active)}
                            size="sm"
                            aria-label={staff.is_active
                              ? t('settings.staff.clickToStop', 'Click to stop service')
                              : t('settings.staff.clickToStart', 'Click to start service')}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {new Date(staff.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        ref={(el) => {
                          if (el) menuButtonRefs.current.set(staff.id, el);
                        }}
                        onClick={(e) => {
                          if (menuOpen === staff.id) {
                            setMenuOpen(null);
                            setMenuPosition(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuPosition({
                              top: rect.bottom + 4,
                              left: rect.right - 144, // 144 = menu width (w-36 = 9rem = 144px)
                            });
                            setMenuOpen(staff.id);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dropdown Menu - Rendered outside table to avoid overflow clipping */}
      {menuOpen && menuPosition && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => {
              setMenuOpen(null);
              setMenuPosition(null);
            }}
          />
          <div 
            className="fixed w-36 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <button
              onClick={() => {
                const staff = staffList.find(s => s.id === menuOpen);
                if (staff) handleEdit(staff);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              {t('common.edit', 'Edit')}
            </button>
            {staffList.find(s => s.id === menuOpen)?.role !== 'admin' && (
              <button
                onClick={() => {
                  const staff = staffList.find(s => s.id === menuOpen);
                  if (staff) handleDeleteClick(staff);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {t('common.delete', 'Delete')}
              </button>
            )}
          </div>
        </>
      )}

      {/* Create/Edit Dialog */}
      <StaffDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedStaff(null);
        }}
        onSubmit={handleSubmit}
        staff={selectedStaff}
        isLoading={submitting}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setSelectedStaff(null);
        }}
        onConfirm={handleDelete}
        staffName={selectedStaff?.nickname || selectedStaff?.username || ''}
        isLoading={submitting}
      />
    </div>
  );
};

export default StaffSettings;

