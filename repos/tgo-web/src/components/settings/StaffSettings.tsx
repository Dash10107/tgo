/**
 * Staff Settings Component
 * Manage human agents/staff members
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  UserCog,
  Eye,
  EyeOff,
  Loader2,
  Info,
  Settings2,
  Save,
  ChevronDown,
  Clock,
  MessageSquare,
  Brain,
  RotateCcw,
  CalendarDays,
  Headphones,
  Radio,
} from 'lucide-react';
import { staffApi, StaffRole, StaffStatus, StaffUpdateRequest, VisitorAssignmentRuleResponse } from '@/services/staffApi';
import { StaffResponse, StaffCreateRequest } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import AIProvidersApiService from '@/services/aiProvidersApi';
import Toggle from '@/components/ui/Toggle';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Modal, Field, FieldGroup, PrimaryButton, SecondaryButton } from '@/components/ui/ModalKit';
import { InkButton, SectionHeader, EmptyPanel, SkeletonGrid } from '@/components/ui/PageKit';
import { SettingsPage, SettingsNote } from './SettingsKit';

const roleStyleConfig: Record<StaffRole, string> = {
  admin: 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900',
  user: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  agent: 'bg-acid-300 text-ink-900',
};

const statusDotConfig: Record<StaffStatus, string> = {
  online: 'bg-acid-500',
  offline: 'bg-gray-400',
  busy: 'bg-amber-400',
};

const errorMessage = (err: unknown): string | undefined => (err instanceof Error ? err.message : undefined);

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

/** Password input with a reveal toggle */
const PasswordInput: React.FC<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  invalid?: boolean;
}> = ({ id, value, onChange, placeholder, invalid }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        autoComplete="new-password"
        className="tgo-input pr-12"
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? t('common.hide', 'Hide') : t('common.show', 'Show')}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};

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

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      preventClose={isLoading}
      icon={isEditing ? UserCog : UserPlus}
      title={isEditing ? t('settings.staff.editStaff', 'Edit Staff') : t('settings.staff.addStaff', 'Add Staff')}
      subtitle={isEditing ? `@${staff?.username}` : t('settings.staff.dialogSubtitle', 'Give a teammate access to take over conversations.')}
      onSubmit={handleSubmit}
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={isLoading}>{t('common.cancel', 'Cancel')}</SecondaryButton>
          <PrimaryButton type="submit" loading={isLoading}>
            {isEditing ? t('common.save', 'Save') : t('common.create', 'Create')}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('settings.staff.username', 'Username')} htmlFor="staff-username" required={!isEditing} error={errors.username}>
          <input
            id="staff-username"
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            disabled={isEditing}
            aria-invalid={Boolean(errors.username)}
            autoComplete="off"
            className="tgo-input"
            placeholder={t('settings.staff.usernamePlaceholder', 'Enter username')}
          />
        </Field>
        <Field label={t('settings.staff.name', 'Name')} htmlFor="staff-name" required error={errors.name}>
          <input
            id="staff-name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            aria-invalid={Boolean(errors.name)}
            className="tgo-input"
            placeholder={t('settings.staff.namePlaceholder', 'Enter name')}
          />
        </Field>
      </div>

      <Field label={t('settings.staff.password', 'Password')} htmlFor="staff-password" required={!isEditing} error={errors.password}>
        <PasswordInput
          id="staff-password"
          value={formData.password}
          onChange={(password) => setFormData({ ...formData, password })}
          invalid={Boolean(errors.password)}
          placeholder={isEditing
            ? t('settings.staff.passwordPlaceholderEdit', 'Leave empty to keep current password')
            : t('settings.staff.passwordPlaceholder', 'Enter password (at least 8 characters)')}
        />
      </Field>

      <Field label={t('settings.staff.confirmPassword', 'Confirm Password')} htmlFor="staff-confirm-password" required={!isEditing} error={errors.confirmPassword}>
        <PasswordInput
          id="staff-confirm-password"
          value={formData.confirmPassword}
          onChange={(confirmPassword) => setFormData({ ...formData, confirmPassword })}
          invalid={Boolean(errors.confirmPassword)}
          placeholder={t('settings.staff.confirmPasswordPlaceholder', 'Re-enter password')}
        />
      </Field>

      <Field label={t('settings.staff.descriptionLabel', 'Description')} htmlFor="staff-description" optional>
        <textarea
          id="staff-description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="tgo-input resize-none"
          placeholder={t('settings.staff.descriptionPlaceholder', 'Enter staff description (optional)')}
        />
      </Field>
    </Modal>
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
        const options = (res.data || []).map(m => ({
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
    } catch (error) {
      console.error('Failed to toggle is_active:', error);
      showError(errorMessage(error) || t('settings.staff.toggleActiveError', 'Failed to toggle service status'));
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
    } catch (error) {
      console.error('Failed to save staff:', error);
      showError(errorMessage(error) || t('settings.staff.saveError', 'Save failed'));
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
    } catch (error) {
      console.error('Failed to delete staff:', error);
      showError(errorMessage(error) || t('settings.staff.deleteError', 'Delete failed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Open edit dialog
  const handleEdit = (staff: StaffResponse) => {
    setSelectedStaff(staff);
    setDialogOpen(true);
  };

  // Open delete dialog
  const handleDeleteClick = (staff: StaffResponse) => {
    setSelectedStaff(staff);
    setDeleteDialogOpen(true);
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

  const weekdays = [
    { value: 1, label: t('settings.staff.weekday.mon', 'Mon') },
    { value: 2, label: t('settings.staff.weekday.tue', 'Tue') },
    { value: 3, label: t('settings.staff.weekday.wed', 'Wed') },
    { value: 4, label: t('settings.staff.weekday.thu', 'Thu') },
    { value: 5, label: t('settings.staff.weekday.fri', 'Fri') },
    { value: 6, label: t('settings.staff.weekday.sat', 'Sat') },
    { value: 7, label: t('settings.staff.weekday.sun', 'Sun') },
  ];

  const onlineCount = staffList.filter(s => s.status === 'online').length;
  const activeCount = staffList.filter(s => s.is_active).length;
  const promptTooLong = assignmentPrompt.length > 1000;

  return (
    <SettingsPage
      wide
      title={t('settings.staff.title', 'Human Agents')}
      subtitle={t('settings.staff.subtitle', 'Your human team behind the AI: manage access, availability and how conversations are routed.')}
      actions={
        <InkButton onClick={handleCreate} icon={<Plus className="h-4 w-4" />}>
          {t('settings.staff.addStaff', 'Add Staff')}
        </InkButton>
      }
    >
      {/* Figures */}
      <div className="flex flex-wrap items-end gap-8 md:gap-12">
        {[
          { key: 'total', value: staffList.length, label: t('settings.staff.statTotal', 'agents'), badge: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200', badgeText: t('common.all', 'All') },
          { key: 'online', value: onlineCount, label: t('settings.staff.statuses.online', 'online').toLowerCase(), badge: 'bg-acid-300 text-ink-900' },
          { key: 'active', value: activeCount, label: t('settings.staff.statActive', 'in service'), badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
        ].map(stat => (
          <div key={stat.key} className="flex items-end gap-2">
            <span key={stat.value} className="tgo-pop tgo-display text-[44px] tabular-nums text-gray-900 dark:text-white">{stat.value}</span>
            <span className="mb-1 flex flex-col items-start gap-1">
              <span className={`rounded-full px-1.5 text-[10px] font-semibold leading-4 ${stat.badge}`}>
                {stat.badgeText ?? `${staffList.length > 0 ? Math.round((stat.value / staffList.length) * 100) : 0}%`}
              </span>
              <span className="text-sm text-gray-400 dark:text-gray-500">{stat.label}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Assignment rules */}
      <section className="tgo-surface overflow-hidden">
        <button
          onClick={() => setAssignmentRulesExpanded(!assignmentRulesExpanded)}
          aria-expanded={assignmentRulesExpanded}
          className="flex w-full items-center gap-4 p-6 text-left transition-colors hover:bg-gray-50/60 md:p-7 dark:hover:bg-white/[0.02]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900">
            <Settings2 className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-medium tracking-tight text-gray-900 dark:text-white">
              {t('settings.staff.assignmentRules', 'Assignment Rules')}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <span className="tgo-chip"><Clock className="h-3 w-3" />{serviceStartTime} – {serviceEndTime}</span>
              <span className="tgo-chip"><CalendarDays className="h-3 w-3" />{serviceWeekdays.length}/7</span>
              <span className={`tgo-chip ${llmAssignmentEnabled ? 'bg-acid-100 text-acid-800 dark:bg-acid-400/15 dark:text-acid-300' : ''}`}>
                <Brain className="h-3 w-3" />
                {t('settings.staff.llmAssignment', 'Intelligent Assignment')}
              </span>
            </span>
          </span>
          <span className="tgo-icon-btn">
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${assignmentRulesExpanded ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {assignmentRulesExpanded && (
          <div className="tgo-fade-in border-t border-gray-100 p-6 md:p-7 dark:border-gray-800">
            {rulesLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <FieldGroup title={t('settings.staff.serviceTime', 'Service Hours')} icon={Clock}>
                    <Field label={t('settings.staff.serviceWeekdays', 'Service Days')}>
                      <div className="flex flex-wrap gap-1.5">
                        {weekdays.map(day => {
                          const active = serviceWeekdays.includes(day.value);
                          return (
                            <button
                              key={day.value}
                              type="button"
                              aria-pressed={active}
                              data-active={active}
                              onClick={() => {
                                setServiceWeekdays(active
                                  ? serviceWeekdays.filter(d => d !== day.value)
                                  : [...serviceWeekdays, day.value].sort((a, b) => a - b));
                              }}
                              className="tgo-pill h-9 w-12 justify-center px-0"
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label={t('settings.staff.serviceStartTime', 'Start Time')} htmlFor="service-start">
                        <input id="service-start" type="time" value={serviceStartTime} onChange={(e) => setServiceStartTime(e.target.value)} className="tgo-input" />
                      </Field>
                      <Field label={t('settings.staff.serviceEndTime', 'End Time')} htmlFor="service-end">
                        <input id="service-end" type="time" value={serviceEndTime} onChange={(e) => setServiceEndTime(e.target.value)} className="tgo-input" />
                      </Field>
                    </div>
                    <Field label={t('settings.staff.timezone', 'Timezone')} htmlFor="service-timezone">
                      <select id="service-timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="tgo-input">
                        <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                        <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                        <option value="America/New_York">America/New_York (UTC-5)</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                        <option value="Europe/London">Europe/London (UTC+0)</option>
                        <option value="Europe/Paris">Europe/Paris (UTC+1)</option>
                      </select>
                    </Field>
                  </FieldGroup>

                  <FieldGroup title={t('settings.staff.chatSettings', 'Chat Settings')} icon={MessageSquare}>
                    <Field
                      label={t('settings.staff.maxConcurrentChats', 'Max Concurrent Chats')}
                      htmlFor="max-concurrent"
                      hint={t('settings.staff.maxConcurrentChatsHint', 'Maximum number of conversations each agent can handle simultaneously')}
                    >
                      <input
                        id="max-concurrent"
                        type="number"
                        min="1"
                        max="100"
                        value={maxConcurrentChats}
                        onChange={(e) => setMaxConcurrentChats(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
                        className="tgo-input"
                      />
                    </Field>
                    <Field
                      label={t('settings.staff.autoCloseHours', 'Auto Close Time')}
                      htmlFor="auto-close"
                      hint={t('settings.staff.autoCloseHoursHint', 'Time after which inactive conversations are automatically closed')}
                    >
                      <div className="relative">
                        <input
                          id="auto-close"
                          type="number"
                          min="1"
                          max="720"
                          value={autoCloseHours}
                          onChange={(e) => setAutoCloseHours(Math.max(1, Math.min(720, parseInt(e.target.value, 10) || 1)))}
                          className="tgo-input pr-16"
                        />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                          {t('settings.staff.hours', 'hours')}
                        </span>
                      </div>
                    </Field>
                  </FieldGroup>
                </div>

                <FieldGroup>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                        <Brain className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.staff.llmAssignment', 'Intelligent Assignment')}</p>
                        <p className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">
                          {t('settings.staff.llmAssignmentHint', 'When enabled, the system uses an LLM with this prompt to intelligently assign conversations to the most suitable agent.')}
                        </p>
                      </div>
                    </div>
                    <Toggle
                      checked={llmAssignmentEnabled}
                      onChange={setLlmAssignmentEnabled}
                      aria-label={t('settings.staff.llmAssignment', 'Intelligent Assignment')}
                    />
                  </div>

                  {llmAssignmentEnabled && (
                    <div className="tgo-fade-in space-y-5">
                      <Field
                        label={t('settings.staff.assignmentModel', 'Assignment Model')}
                        htmlFor="assignment-model"
                        hint={t('settings.staff.assignmentModelHint', 'Select the LLM for intelligent conversation assignment, models come from Model Providers configuration')}
                      >
                        <select
                          id="assignment-model"
                          value={selectedModelId}
                          onChange={(e) => setSelectedModelId(e.target.value)}
                          className="tgo-input"
                          disabled={modelsLoading}
                        >
                          <option value="">{t('settings.staff.selectModel', 'Select a model')}</option>
                          {llmOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </Field>

                      <Field
                        label={t('settings.staff.assignmentPrompt', 'Assignment Prompt')}
                        htmlFor="assignment-prompt"
                        aside={<span className={promptTooLong ? 'text-red-500' : ''}>{assignmentPrompt.length}/1000</span>}
                        error={promptTooLong ? t('settings.staff.promptTooLong', 'Prompt cannot exceed 1000 characters') : undefined}
                      >
                        <textarea
                          id="assignment-prompt"
                          value={assignmentPrompt}
                          onChange={(e) => {
                            if (e.target.value.length <= 1000) setAssignmentPrompt(e.target.value);
                          }}
                          maxLength={1000}
                          rows={8}
                          aria-invalid={promptTooLong}
                          className="tgo-input min-h-[160px] font-mono text-[13px] leading-relaxed"
                          placeholder={t('settings.staff.assignmentRulesPlaceholder', 'Enter assignment rules prompt...')}
                        />
                      </Field>
                      <button onClick={handleResetRules} className="tgo-pill h-8 px-3 text-xs">
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t('settings.staff.resetToDefault', 'Reset to Default')}
                      </button>
                    </div>
                  )}
                </FieldGroup>

                <div className="flex justify-end">
                  <PrimaryButton
                    onClick={handleSaveRules}
                    loading={savingRules}
                    disabled={promptTooLong}
                    icon={<Save className="h-4 w-4" />}
                  >
                    {t('settings.staff.saveRules', 'Save Rules')}
                  </PrimaryButton>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Staff list */}
      <section className="space-y-5">
        <SectionHeader title={t('settings.staff.listTitle', 'Team')} count={staffList.length} countLabel={t('settings.staff.statTotal', 'agents')} />

        {loading && staffList.length === 0 ? (
          <SkeletonGrid count={3} className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3" itemClassName="h-56" />
        ) : staffList.length === 0 ? (
          <EmptyPanel
            icon={Users}
            title={t('settings.staff.emptyTitle', 'No agents yet')}
            description={t('settings.staff.empty', 'No staff yet, click "Add Staff" to create')}
            action={
              <InkButton onClick={handleCreate} icon={<Plus className="h-4 w-4" />}>
                {t('settings.staff.addStaff', 'Add Staff')}
              </InkButton>
            }
          />
        ) : (
          <div className="tgo-stagger grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {staffList.map(staff => {
              const name = staff.nickname || staff.username;
              const role = staff.role as StaffRole;
              const status = staff.status as StaffStatus;
              return (
                <article key={staff.id} className="tgo-surface group flex flex-col p-6 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1">
                  <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-lg font-light text-gray-800 dark:bg-gray-800 dark:text-gray-100">
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-900 ${statusDotConfig[status] || 'bg-gray-400'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-medium tracking-tight text-gray-900 dark:text-gray-100" title={name}>{name}</h3>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">@{staff.username}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${roleStyleConfig[role] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                      {t(`settings.staff.roles.${staff.role}`, staff.role)}
                    </span>
                  </div>

                  <p className="mt-4 line-clamp-2 min-h-[2lh] text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    {staff.description || t('workflow.noDescription', 'No description')}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    <span className="tgo-chip">
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDotConfig[status] || 'bg-gray-400'}`} />
                      {t(`settings.staff.statuses.${staff.status}`, staff.status)}
                    </span>
                    <span className="tgo-chip">
                      <CalendarDays className="h-3 w-3" />
                      {new Date(staff.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mt-auto flex items-center gap-2 pt-5">
                    <label className="flex h-10 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-full pl-4 pr-2 text-sm text-gray-700 ring-1 ring-gray-200 dark:text-gray-200 dark:ring-gray-700">
                      <span className="flex min-w-0 items-center gap-2">
                        {staff.is_active ? <Headphones className="h-4 w-4 shrink-0 text-acid-600 dark:text-acid-400" /> : <Radio className="h-4 w-4 shrink-0 text-gray-400" />}
                        <span className="truncate">{t('settings.staff.tableServiceActive', 'Service')}</span>
                      </span>
                      {togglingActiveStaffId === staff.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin text-gray-400" />
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
                    </label>
                    {staff.role !== 'admin' && (
                      <button
                        onClick={() => handleDeleteClick(staff)}
                        aria-label={t('common.delete', 'Delete')}
                        title={t('common.delete', 'Delete')}
                        className="tgo-icon-btn h-10 w-10 hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-900/30 dark:hover:!text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(staff)}
                      aria-label={t('common.edit', 'Edit')}
                      title={t('common.edit', 'Edit')}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white transition-transform duration-200 hover:scale-105 active:scale-95 dark:bg-acid-400 dark:text-ink-900"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <SettingsNote icon={Info}>
        <p className="font-medium text-gray-900 dark:text-gray-100">{t('settings.staff.description', 'About Human Agents')}</p>
        <p className="mt-0.5">{t('settings.staff.descriptionText', 'When AI agents cannot resolve user issues, the system automatically assigns conversations to human agents. Human agents can take over conversations to provide more professional human support.')}</p>
      </SettingsNote>

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

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title={t('settings.staff.deleteConfirmTitle', 'Confirm Delete')}
        message={t('settings.staff.deleteConfirmMessage', 'Are you sure you want to delete staff "{{name}}"? This action cannot be undone.', { name: selectedStaff?.nickname || selectedStaff?.username || '' })}
        confirmText={t('common.delete', 'Delete')}
        cancelText={t('common.cancel', 'Cancel')}
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setSelectedStaff(null);
        }}
        isLoading={submitting}
      />
    </SettingsPage>
  );
};

export default StaffSettings;
