import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { User, AlertCircle, Loader2, X, Tag as TagIcon } from 'lucide-react';
import TagManager from '../ui/TagManager';
import CollapsibleSection from '../ui/CollapsibleSection';
import VisitorHeader from './VisitorHeader';
import BasicInfoSection from './BasicInfoSection';
import ImageCropModal from '../ui/ImageCropModal';

import AIInsightsSection from './AIInsightsSection';
import SystemInfoSection from './SystemInfoSection';
import RecentActivitySection from './RecentActivitySection';
import PluginPanelSection from '../plugin/PluginPanelSection';
import { visitorApiService, type VisitorAttributesUpdateRequest, type VisitorResponse } from '@/services/visitorApi';
import { tagsApiService } from '@/services/tagsApi';
import { useChannelStore } from '@/stores/channelStore';
import { useChatStore } from '@/stores/chatStore';
import { getChannelKey } from '@/utils/channelUtils';
import { useToast } from '@/hooks/useToast';
import type { ChannelVisitorExtra } from '@/types';
import { PlatformType } from '@/types';
import { toPlatformType } from '@/utils/platformUtils';
import { formatOnlineDuration } from '@/utils/dateUtils';
import type { ExtendedVisitor, CustomAttribute, VisitorTag } from '@/data/mockVisitor';

export interface VisitorDetailPanelProps {
  /** Visitor ID (for standalone mode) */
  visitorId?: string;
  /** Channel ID (for chat mode) */
  channelId?: string | null;
  /** Channel type (for chat mode) */
  channelType?: number | null;
  /** Visitor data passed in directly (optional, for pre-filling) */
  visitorData?: VisitorResponse | null;
  /** Whether to show the close button */
  showCloseButton?: boolean;
  /** Close callback */
  onClose?: () => void;
  /** Callback after the visitor data is updated (for standalone mode, to notify the parent to refresh) */
  onVisitorUpdated?: (visitorId: string) => void;
  /** Panel style variant */
  variant?: 'sidebar' | 'drawer';
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: React.CSSProperties;
}

/**
 * Convert the visitor extension data in the channel info into the extended structure used by the panel
 */
const toExtendedVisitorFromChannel = (extra: ChannelVisitorExtra): ExtendedVisitor => {
  const tags = Array.isArray(extra.tags)
    ? extra.tags.map((t, idx) => ({
        id: t.id || `tag_${idx}`,
        name: t.display_name || '',
        display_name: t.display_name || '',
        color: t.color || 'gray',
        weight: typeof t.weight === 'number' ? t.weight : 0
      }))
    : [];

  const customAttrsObj = (extra.custom_attributes || {}) as Record<string, unknown>;
  const customAttributes = Object.entries(customAttrsObj).map(([key, value], index) => ({
    id: `custom_${index}`,
    key,
    value: String(value ?? ''),
    editable: true,
  }));

  return {
    id: extra.id,
    name: extra.name || extra.nickname || i18n.t('visitor.unknown', 'Unknown Visitor'),
    avatar: extra.avatar_url || '',
    status: extra.is_online ? 'online' : 'offline',
    platform: extra.source || 'website',
    firstVisit: extra.first_visit_time || '',
    visitCount: 1,
    tags,
    basicInfo: {
      name: extra.name || '',
      email: extra.email || '',
      phone: extra.phone_number || '',
      nickname: extra.display_nickname || '',
      company: extra.company || '',
      jobTitle: extra.job_title || '',
      source: extra.source || '',
      note: extra.note || '',
      avatarUrl: extra.avatar_url || '',
      lastOnlineDurationMinutes: (extra as any).last_online_duration_minutes,
      customAttributes,
    },
    aiInsights: {
      satisfaction: 4,
      emotion: { type: 'neutral', icon: 'Meh', label: i18n.t('visitor.ai.emotion.neutral', 'Neutral') },
    },
    systemInfo: {
      firstVisit: extra.first_visit_time || '',
      source: extra.source || i18n.t('visitor.system.defaultSource', 'Official Website'),
      browser: 'Chrome / macOS',
    },
    recentActivity: [],
    relatedTickets: [],
    aiPersonaTags: [],
  };
};

/**
 * Convert a VisitorResponse to an ExtendedVisitor
 */
const toExtendedVisitorFromResponse = (response: VisitorResponse): ExtendedVisitor => {
  const tags = Array.isArray(response.tags)
    ? response.tags.map((t, idx) => ({
        id: t.id || `tag_${idx}`,
        name: t.name || '',
        display_name: t.name || '',
        color: t.color || 'gray',
        weight: 0
      }))
    : [];

  const customAttrsObj = (response.custom_attributes || {}) as Record<string, unknown>;
  const customAttributes = Object.entries(customAttrsObj).map(([key, value], index) => ({
    id: `custom_${index}`,
    key,
    value: String(value ?? ''),
    editable: true,
  }));

  return {
    id: response.id,
    name: response.name || response.display_nickname || response.nickname_zh || response.nickname || i18n.t('visitor.unknown', 'Unknown Visitor'),
    avatar: response.avatar_url || '',
    status: response.is_online ? 'online' : 'offline',
    platform: response.platform_type || 'website',
    firstVisit: response.first_visit_time || '',
    visitCount: 1,
    tags,
    basicInfo: {
      name: response.name || '',
      email: response.email || '',
      phone: response.phone_number || '',
      nickname: response.display_nickname || response.nickname_zh || response.nickname || '',
      company: response.company || '',
      jobTitle: response.job_title || '',
      source: response.source || '',
      note: response.note || '',
      avatarUrl: response.avatar_url || '',
      lastOnlineDurationMinutes: response.last_online_duration_minutes,
      customAttributes,
    },
    aiInsights: {
      satisfaction: 4,
      emotion: { type: 'neutral', icon: 'Meh', label: i18n.t('visitor.ai.emotion.neutral', 'Neutral') },
    },
    systemInfo: {
      firstVisit: response.first_visit_time || '',
      source: response.source || i18n.t('visitor.system.defaultSource', 'Official Website'),
      browser: response.system_info?.browser || '',
    },
    recentActivity: [],
    relatedTickets: [],
    aiPersonaTags: [],
  };
};

/**
 * Shared visitor detail panel component
 * Can be used in the chat sidebar and in the detail drawer of visitor management
 */
const VisitorDetailPanel: React.FC<VisitorDetailPanelProps> = ({
  visitorId,
  channelId,
  channelType,
  visitorData,
  showCloseButton = false,
  onClose,
  onVisitorUpdated,
  variant = 'sidebar',
  className = '',
  style,
}) => {
  const [visitor, setVisitor] = useState<ExtendedVisitor | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null);
  
  // Section expand/collapse state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('visitor_panel_expanded_sections');
      return saved ? JSON.parse(saved) : {
        basic_info: true,
        ai_insights: true,
        tags: true,
        system_info: false,
        plugins: true,
        recent_activity: false
      };
    } catch {
      return {
        basic_info: true,
        ai_insights: true,
        tags: true,
        system_info: false,
        plugins: true,
        recent_activity: false
      };
    }
  });

  const handleToggleSection = (sectionId: string, expanded: boolean) => {
    setExpandedSections(prev => {
      const next = { ...prev, [sectionId]: expanded };
      localStorage.setItem('visitor_panel_expanded_sections', JSON.stringify(next));
      return next;
    });
  };
  // Avatar crop modal state
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string>('');
  const [cropImageMimeType, setCropImageMimeType] = useState<string>('image/png');
  const { t } = useTranslation();
  const { showToast } = useToast();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Default module order
  const DEFAULT_ORDER = ['basic_info', 'ai_insights', 'tags', 'system_info', 'plugins', 'recent_activity'];
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('visitor_panel_section_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Verify that the saved order contains all currently defined modules, to prevent issues after version updates
        if (Array.isArray(parsed) && parsed.length === DEFAULT_ORDER.length && parsed.every(id => DEFAULT_ORDER.includes(id))) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load visitor panel order:', e);
    }
    return DEFAULT_ORDER;
  });

  // Whether to use channel mode (get data from channelStore)
  const useChannelMode = Boolean(channelId && channelType != null);

  const compositeKey = useMemo(() => {
    if (!channelId || channelType == null) return null;
    return getChannelKey(channelId, channelType);
  }, [channelId, channelType]);

  const channelInfo = useChannelStore(state => (compositeKey ? state.channels[compositeKey] : undefined));
  const channelStoreError = useChannelStore(state => (compositeKey ? state.errors[compositeKey] : null));
  const isChannelFetching = useChannelStore(state => (compositeKey ? Boolean(state.inFlight[compositeKey]) : false));
  const ensureChannelInfo = useChannelStore(state => state.ensureChannel);

  // Derive recent activities from channel extra
  const recentActivities = useMemo(() => {
    const extra = channelInfo?.extra as ChannelVisitorExtra | undefined;
    const list = extra?.recent_activities;
    if (!Array.isArray(list)) return [] as NonNullable<ChannelVisitorExtra['recent_activities']>;
    return [...list].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  }, [channelInfo]);

  // Derive system info from channel extra
  const systemInfo = useMemo(() => {
    const extra = channelInfo?.extra as ChannelVisitorExtra | undefined;
    return extra?.system_info || null;
  }, [channelInfo]);

  // Derive AI insights from channel extra
  const aiInsights = useMemo(() => {
    const extra = channelInfo?.extra as ChannelVisitorExtra | undefined;
    return extra?.ai_insights ?? visitorData?.ai_insights ?? null;
  }, [channelInfo, visitorData]);

  // Channel mode: get data from channelStore
  useEffect(() => {
    if (!useChannelMode || !channelId) {
      return;
    }

    // Only auto-fetch when we have not fetched yet, nothing is in-flight, and no prior error exists
    if (!channelInfo && !isChannelFetching && !channelStoreError) {
      ensureChannelInfo({ channel_id: channelId, channel_type: channelType ?? 1 }).catch(error => {
        const message = error instanceof Error ? error.message : t('visitor.load.failedDesc', 'Failed to load visitor data');
        setLoadError(message);
        showToast('error', t('visitor.load.failedTitle', 'Failed to load visitor information'), message);
      });
    }
  }, [useChannelMode, ensureChannelInfo, isChannelFetching, showToast, channelId, channelType, channelInfo, channelStoreError, t]);

  // Standalone mode: get data from visitorData or the API
  useEffect(() => {
    if (useChannelMode) return;

    if (visitorData) {
      setVisitor(toExtendedVisitorFromResponse(visitorData));
      setHasLoadedInitial(true);
      setIsLoading(false);
      return;
    }

    if (visitorId) {
      setIsLoading(true);
      setLoadError(null);
      visitorApiService.getVisitor(visitorId)
        .then(response => {
          setVisitor(toExtendedVisitorFromResponse(response));
          setHasLoadedInitial(true);
        })
        .catch(error => {
          const message = error instanceof Error ? error.message : t('visitor.load.failedDesc', 'Failed to load visitor data');
          setLoadError(message);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [useChannelMode, visitorId, visitorData, t]);

  // Channel mode: update the loading state
  useEffect(() => {
    if (!useChannelMode || !channelId) {
      return;
    }

    setIsLoading(!hasLoadedInitial && isChannelFetching && !channelInfo);
  }, [useChannelMode, isChannelFetching, channelId, channelInfo, hasLoadedInitial]);

  // Channel mode: handle errors
  useEffect(() => {
    if (!useChannelMode) return;

    if (channelStoreError) {
      setLoadError(channelStoreError);
    } else {
      setLoadError(null);
    }
  }, [useChannelMode, channelStoreError]);

  // Channel mode: convert visitor data from channelInfo
  useEffect(() => {
    if (!useChannelMode) return;

    const extra = channelInfo?.extra as any;
    const isVisitorExtra = extra && typeof extra === 'object' && 'platform_open_id' in extra && !('staff_id' in extra);
    if (isVisitorExtra) {
      setVisitor(toExtendedVisitorFromChannel(extra as ChannelVisitorExtra));
      setHasLoadedInitial(true);
    } else {
      setVisitor(null);
    }
  }, [useChannelMode, channelInfo]);

  // API-integrated basic info update function
  const handleUpdateBasicInfo = useCallback(async (
    field: 'name' | 'nickname' | 'email' | 'phone' | 'note',
    value: string
  ) => {
    if (!visitor) return;

    setIsUpdating(true);
    setUpdateError(null);

    try {
      const customAttributesForApi = (visitor.basicInfo.customAttributes || []).reduce((acc: Record<string, string | null>, attr: CustomAttribute) => {
        acc[attr.key] = attr.value;
        return acc;
      }, {} as Record<string, string | null>);

      const apiKey = field === 'phone' ? 'phone_number' : field;

      const updateData: VisitorAttributesUpdateRequest = {
        [apiKey]: value,
        custom_attributes: customAttributesForApi
      } as VisitorAttributesUpdateRequest;

      await visitorApiService.updateVisitorAttributes(visitor.id, updateData);
      if (useChannelMode && channelId) {
        await useChatStore.getState().syncChannelInfoAcrossUI(channelId, channelType ?? 1);
      }

      const localKey = field === 'phone' ? 'phone' : field;

      setVisitor((prev: ExtendedVisitor | null) => prev ? {
        ...prev,
        basicInfo: {
          ...prev.basicInfo,
          [localKey]: value
        }
      } : null);

      const labelMap: Record<string, string> = {
        name: t('visitor.fields.name', 'Name'),
        nickname: t('visitor.fields.nickname', 'Nickname'),
        email: t('visitor.fields.email', 'Email'),
        phone: t('visitor.fields.phone', 'Phone'),
        note: t('visitor.fields.note', 'Note')
      };
      showToast('success', t('visitor.update.successTitle', 'Updated successfully'), t('visitor.update.fieldUpdated', '{{field}} has been updated', { field: labelMap[field] || t('visitor.fields.field', 'Field') }));

      // Notify the parent that the data has been updated
      if (!useChannelMode && onVisitorUpdated && visitor.id) {
        onVisitorUpdated(visitor.id);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('visitor.update.failedDesc', 'Update failed');
      setUpdateError(errorMessage);
      showToast('error', t('visitor.update.failedTitle', 'Update failed'), errorMessage);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [visitor, showToast, useChannelMode, channelId, channelType, t, onVisitorUpdated]);

  // API-integrated custom attribute management functions
  const handleAddCustomAttribute = useCallback(async (key: string, value: string) => {
    if (!visitor) return;

    setIsUpdating(true);
    setUpdateError(null);

    try {
      const newAttribute: CustomAttribute = {
        id: Date.now().toString(),
        key,
        value,
        editable: true
      };

      const currentAttributes = visitor.basicInfo.customAttributes || [];
      const updatedAttributes = [...currentAttributes, newAttribute];

      const customAttributesForApi = updatedAttributes.reduce((acc, attr) => {
        acc[attr.key] = attr.value;
        return acc;
      }, {} as Record<string, any>);

      await visitorApiService.updateVisitorAttributes(visitor.id, {
        custom_attributes: customAttributesForApi
      });

      if (useChannelMode && channelId) {
        await useChatStore.getState().syncChannelInfoAcrossUI(channelId, channelType ?? 1);
      }

      setVisitor((prev: ExtendedVisitor | null) => prev ? {
        ...prev,
        basicInfo: {
          ...prev.basicInfo,
          customAttributes: updatedAttributes
        }
      } : null);

      showToast('success', t('visitor.customAttr.addSuccessTitle', 'Added successfully'), t('visitor.customAttr.addSuccessDesc', 'Custom attribute added'));
      
      // Notify the parent that the data has been updated
      if (!useChannelMode && onVisitorUpdated && visitor.id) {
        onVisitorUpdated(visitor.id);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('visitor.customAttr.addFailedDesc', 'Add failed');
      setUpdateError(errorMessage);
      showToast('error', t('visitor.customAttr.addFailedTitle', 'Add failed'), errorMessage);
    } finally {
      setIsUpdating(false);
    }
  }, [visitor, showToast, useChannelMode, channelId, channelType, t, onVisitorUpdated]);

  const handleUpdateCustomAttribute = useCallback(async (id: string, key: string, value: string) => {
    if (!visitor) return;

    setIsUpdating(true);
    setUpdateError(null);

    try {
      const updatedAttributes = visitor.basicInfo.customAttributes?.map((attr: CustomAttribute) =>
        attr.id === id ? { ...attr, key, value } : attr
      ) || [];

      const customAttributesForApi = updatedAttributes.reduce((acc: Record<string, string | null>, attr: CustomAttribute) => {
        acc[attr.key] = attr.value;
        return acc;
      }, {} as Record<string, string | null>);

      await visitorApiService.updateVisitorAttributes(visitor.id, {
        custom_attributes: customAttributesForApi
      });

      setVisitor(prev => prev ? {
        ...prev,
        basicInfo: {
          ...prev.basicInfo,
          customAttributes: updatedAttributes
        }
      } : null);

      showToast('success', t('visitor.customAttr.updateSuccessTitle', 'Updated successfully'), t('visitor.customAttr.updateSuccessDesc', 'Custom attribute updated'));
      
      // Notify the parent that the data has been updated
      if (!useChannelMode && onVisitorUpdated && visitor.id) {
        onVisitorUpdated(visitor.id);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('visitor.customAttr.updateFailedDesc', 'Update failed');
      setUpdateError(errorMessage);
      showToast('error', t('visitor.customAttr.updateFailedTitle', 'Update failed'), errorMessage);
    } finally {
      setIsUpdating(false);
    }
  }, [visitor, showToast, t, useChannelMode, onVisitorUpdated]);

  const handleDeleteCustomAttribute = useCallback(async (id: string) => {
    if (!visitor) return;

    setIsUpdating(true);
    setUpdateError(null);

    try {
      const updatedAttributes = visitor.basicInfo.customAttributes?.filter(attr => attr.id !== id) || [];

      const customAttributesForApi = updatedAttributes.reduce((acc, attr) => {
        acc[attr.key] = attr.value;
        return acc;
      }, {} as Record<string, any>);

      await visitorApiService.updateVisitorAttributes(visitor.id, {
        custom_attributes: customAttributesForApi
      });

      setVisitor(prev => prev ? {
        ...prev,
        basicInfo: {
          ...prev.basicInfo,
          customAttributes: updatedAttributes
        }
      } : null);

      showToast('success', t('visitor.customAttr.deleteSuccessTitle', 'Deleted successfully'), t('visitor.customAttr.deleteSuccessDesc', 'Custom attribute deleted'));
      
      // Notify the parent that the data has been updated
      if (!useChannelMode && onVisitorUpdated && visitor.id) {
        onVisitorUpdated(visitor.id);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('visitor.customAttr.deleteFailedDesc', 'Delete failed');
      setUpdateError(errorMessage);
      showToast('error', t('visitor.customAttr.deleteFailedTitle', 'Delete failed'), errorMessage);
    } finally {
      setIsUpdating(false);
    }
  }, [visitor, showToast, t, useChannelMode, onVisitorUpdated]);

  // Get the common tags
  const fetchCommonTags = useCallback(async () => {
    const res = await tagsApiService.listVisitorTags({ limit: 50 });
    return res.data.map(tag => ({
      id: tag.id,
      display_name: tag.display_name,
      name: tag.name,
      color: tag.color || 'gray',
      weight: tag.weight
    }));
  }, []);

  // Select an existing tag
  const handleAssociateExistingTag = useCallback(async (tagId: string) => {
    if (!visitor) return;

    setIsUpdating(true);
    setUpdateError(null);
    try {
      await tagsApiService.createVisitorTag({ visitor_id: visitor.id, tag_id: tagId });
      if (useChannelMode && channelId) {
        await useChatStore.getState().syncChannelInfoAcrossUI(channelId, channelType ?? 1);
      }
      showToast('success', t('visitor.tags.addSuccessTitle', 'Added successfully'), t('visitor.tags.addSuccessDesc', 'Tag added'));
      
      // Notify the parent that the data has been updated and refresh local data
      if (!useChannelMode && visitor.id) {
        // Re-fetch the visitor details to update the tag list
        const updatedVisitor = await visitorApiService.getVisitor(visitor.id);
        setVisitor(toExtendedVisitorFromResponse(updatedVisitor));
        if (onVisitorUpdated) {
          onVisitorUpdated(visitor.id);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('visitor.tags.addFailedDesc', 'Failed to add tag');
      setUpdateError(errorMessage);
      showToast('error', t('visitor.tags.addFailedTitle', 'Add failed'), errorMessage);
    } finally {
      setIsUpdating(false);
    }
  }, [visitor, showToast, useChannelMode, channelId, channelType, t, onVisitorUpdated]);

  // Add a new tag
  const handleAddTag = useCallback(async (tagData: Omit<VisitorTag, 'id'>) => {
    if (!visitor) return;

    setIsUpdating(true);
    setUpdateError(null);

    try {
      let tagId: string | null = null;
      try {
        const newTagResponse = await tagsApiService.createTag({
          name: tagData.name,
          category: 'visitor',
          weight: tagData.weight || 0,
          color: tagData.color || null,
          description: null
        });
        tagId = newTagResponse.id;
      } catch (createErr: any) {
        try {
          const existing = await tagsApiService.listVisitorTags({ search: tagData.name, limit: 1 });
          const found = existing.data.find(t => t.name.toLowerCase() === tagData.name.toLowerCase());
          if (found) {
            tagId = found.id;
          } else {
            throw createErr;
          }
        } catch (e) {
          throw createErr;
        }
      }

      if (!tagId) throw new Error(t('visitor.tags.errors.noTagId', 'Failed to get tag ID'));

      await tagsApiService.createVisitorTag({
        visitor_id: visitor.id,
        tag_id: tagId
      });

      if (useChannelMode && channelId) {
        await useChatStore.getState().syncChannelInfoAcrossUI(channelId, channelType ?? 1);
      }

      showToast('success', t('visitor.tags.addSuccessTitle', 'Added successfully'), t('visitor.tags.addSuccessDesc', 'Tag added'));
      
      // Notify the parent that the data has been updated and refresh local data
      if (!useChannelMode && visitor.id) {
        const updatedVisitor = await visitorApiService.getVisitor(visitor.id);
        setVisitor(toExtendedVisitorFromResponse(updatedVisitor));
        if (onVisitorUpdated) {
          onVisitorUpdated(visitor.id);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('visitor.tags.addFailedDesc', 'Failed to add tag');
      setUpdateError(errorMessage);
      showToast('error', t('visitor.tags.addFailedTitle', 'Add failed'), errorMessage);
    } finally {
      setIsUpdating(false);
    }
  }, [visitor, showToast, useChannelMode, channelId, channelType, t, onVisitorUpdated]);

  const handleUpdateTag = useCallback(async (id: string, updates: Partial<VisitorTag>) => {
    if (!visitor) return;

    setIsUpdating(true);
    setUpdateError(null);

    try {
      const tagToUpdate = visitor.tags.find(tag => tag.id === id);
      if (!tagToUpdate) {
        throw new Error(t('visitor.tags.errors.notFound', 'Tag not found'));
      }

      const updateData: { weight?: number; color?: string } = {};
      if (updates.weight !== undefined) {
        updateData.weight = updates.weight;
      }
      if (updates.color !== undefined) {
        updateData.color = updates.color;
      }

      if (Object.keys(updateData).length > 0) {
        await tagsApiService.updateTag(tagToUpdate.id, updateData);
      }

      if (useChannelMode && channelId) {
        await useChatStore.getState().syncChannelInfoAcrossUI(channelId, channelType ?? 1);
      }

      showToast('success', t('visitor.tags.updateSuccessTitle', 'Updated successfully'), t('visitor.tags.updateSuccessDesc', 'Tag updated'));
      
      // Notify the parent that the data has been updated
      if (!useChannelMode && onVisitorUpdated && visitor.id) {
        const updatedVisitor = await visitorApiService.getVisitor(visitor.id);
        setVisitor(toExtendedVisitorFromResponse(updatedVisitor));
        onVisitorUpdated(visitor.id);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('visitor.tags.updateFailedDesc', 'Failed to update tag');
      setUpdateError(errorMessage);
      showToast('error', t('visitor.tags.updateFailedTitle', 'Update failed'), errorMessage);
    } finally {
      setIsUpdating(false);
    }
  }, [visitor, showToast, useChannelMode, channelId, channelType, t, onVisitorUpdated]);

  const handleRemoveTag = useCallback(async (id: string) => {
    if (!visitor) return;

    setIsUpdating(true);
    setUpdateError(null);

    try {
      await tagsApiService.deleteVisitorTagByVisitorAndTag(visitor.id, id);
      if (useChannelMode && channelId) {
        await useChatStore.getState().syncChannelInfoAcrossUI(channelId, channelType ?? 1);
      }
      showToast('success', t('visitor.tags.removeSuccessTitle', 'Deleted successfully'), t('visitor.tags.removeSuccessDesc', 'Tag deleted'));
      
      // Notify the parent that the data has been updated and refresh local data
      if (!useChannelMode && visitor.id) {
        const updatedVisitor = await visitorApiService.getVisitor(visitor.id);
        setVisitor(toExtendedVisitorFromResponse(updatedVisitor));
        if (onVisitorUpdated) {
          onVisitorUpdated(visitor.id);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('visitor.tags.removeFailedDesc', 'Failed to delete tag');
      setUpdateError(errorMessage);
      showToast('error', t('visitor.tags.removeFailedTitle', 'Delete failed'), errorMessage);
    } finally {
      setIsUpdating(false);
    }
  }, [visitor, showToast, useChannelMode, channelId, channelType, t, onVisitorUpdated]);

  // Avatar upload handling
  const handleAvatarClick = useCallback(() => {
    avatarInputRef.current?.click();
  }, []);

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !visitor) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showToast('error', t('visitor.avatar.invalidTypeTitle', 'Invalid file type'), t('visitor.avatar.invalidTypeDesc', 'Please select a JPEG, PNG, GIF, or WebP image'));
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast('error', t('visitor.avatar.fileTooLargeTitle', 'File too large'), t('visitor.avatar.fileTooLargeDesc', 'Image size must not exceed 5MB'));
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    setCropImageSrc(imageUrl);
    setCropImageMimeType(file.type);
    setShowCropModal(true);

    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  }, [visitor, showToast, t]);

  const handleCropCancel = useCallback(() => {
    setShowCropModal(false);
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
    }
    setCropImageSrc('');
  }, [cropImageSrc]);

  const handleCropConfirm = useCallback(async (blob: Blob) => {
    if (!visitor) return;

    setShowCropModal(false);
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
    }
    setCropImageSrc('');

    setIsUploadingAvatar(true);
    setUpdateError(null);

    try {
      const fileName = `avatar_${Date.now()}.${cropImageMimeType.split('/')[1] || 'png'}`;
      const file = new File([blob], fileName, { type: cropImageMimeType });

      const response = await visitorApiService.uploadAvatar(visitor.id, file);
      
      const avatarUrlWithCacheBust = `${response.avatar_url}?t=${Date.now()}`;
      setVisitor((prev: ExtendedVisitor | null) => prev ? {
        ...prev,
        avatar: avatarUrlWithCacheBust,
        basicInfo: {
          ...prev.basicInfo,
          avatarUrl: avatarUrlWithCacheBust
        }
      } : null);

      if (useChannelMode && channelId) {
        const syncedInfo = await useChatStore.getState().syncChannelInfoAcrossUI(channelId, channelType ?? 1);
        if (syncedInfo && syncedInfo.avatar) {
          const avatarWithCacheBust = syncedInfo.avatar.includes('?') 
            ? `${syncedInfo.avatar}&t=${Date.now()}` 
            : `${syncedInfo.avatar}?t=${Date.now()}`;
          useChannelStore.getState().updateChannelAvatar(channelId, channelType ?? 1, avatarWithCacheBust);
          useChatStore.getState().applyChannelInfo(channelId, channelType ?? 1, {
            ...syncedInfo,
            avatar: avatarWithCacheBust
          });
        }
      }

      showToast('success', t('visitor.avatar.uploadSuccessTitle', 'Upload successful'), t('visitor.avatar.uploadSuccessDesc', 'Visitor avatar has been updated'));
      
      // Notify the parent that the data has been updated
      if (!useChannelMode && onVisitorUpdated && visitor.id) {
        onVisitorUpdated(visitor.id);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('visitor.avatar.uploadFailedDesc', 'Upload failed');
      setUpdateError(errorMessage);
      showToast('error', t('visitor.avatar.uploadFailedTitle', 'Upload failed'), errorMessage);
    } finally {
      setIsUploadingAvatar(false);
    }
  }, [visitor, useChannelMode, channelId, channelType, cropImageSrc, cropImageMimeType, showToast, t, onVisitorUpdated]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // Container-level dragOver handling - find the target via a data attribute
  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Find the nearest element with data-section-id
    const target = (e.target as HTMLElement).closest('[data-section-id]');
    if (!target) {
      setDragOverId(null);
      return;
    }
    
    const targetId = target.getAttribute('data-section-id');
    if (!targetId || targetId === draggedId) {
      if (dragOverId !== null) setDragOverId(null);
      return;
    }
    
    if (dragOverId !== targetId) {
      setDragOverId(targetId);
    }
  };

  // Container-level drop handling
  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    const id = e.dataTransfer.getData('text/plain') || draggedId;
    
    // Find the nearest element with data-section-id
    const target = (e.target as HTMLElement).closest('[data-section-id]');
    const targetId = target?.getAttribute('data-section-id');
    
    setDragOverId(null);
    
    if (!id || !targetId || id === targetId) {
      setDraggedId(null);
      return;
    }

    // Set the recently moved ID to trigger the settle-in animation
    setRecentlyMovedId(id);
    setTimeout(() => setRecentlyMovedId(null), 800);

    // Use a functional update to make sure the latest sectionOrder is used
    setSectionOrder(prevOrder => {
      const newOrder = [...prevOrder];
      const draggedIdx = newOrder.indexOf(id);
      const targetIdx = newOrder.indexOf(targetId);
      
      if (draggedIdx === -1 || targetIdx === -1) {
        setDraggedId(null);
        return prevOrder;
      }

      // Remove the dragged item
      newOrder.splice(draggedIdx, 1);
      
      // Recompute the target index (it may change after removal)
      const newTargetIdx = newOrder.indexOf(targetId);
      if (newTargetIdx === -1) {
        setDraggedId(null);
        return prevOrder;
      }
      
      // Insert at the target position
      newOrder.splice(newTargetIdx, 0, id);
      
      // Save to localStorage
      localStorage.setItem('visitor_panel_section_order', JSON.stringify(newOrder));
      
      // Clear the dragged ID after a delay so the transition animation has time to run
      setTimeout(() => setDraggedId(null), 50);
      
      return newOrder;
    });
  };

  // Styles based on variant
  const hasExternalWidth = style && style.width;
  const widthClass = hasExternalWidth ? '' : 'w-72';

  const containerClasses = variant === 'drawer'
    ? `tgo-vpanel w-full h-full flex flex-col overflow-hidden ${className}`
    : `tgo-vpanel ${widthClass} flex flex-col shrink-0 overflow-hidden font-sans antialiased ${className}`;

  const emptyContainerClasses = variant === 'drawer'
    ? `tgo-vpanel w-full h-full flex items-center justify-center ${className}`
    : `tgo-vpanel ${widthClass} flex items-center justify-center shrink-0 font-sans antialiased ${className}`;

  // Render the empty or error state
  if (!visitor) {
    return (
      <div className={emptyContainerClasses} style={style}>
        <div className="text-center text-gray-500 dark:text-gray-400 px-4">
          {isLoading ? (
            <>
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-acid-100 text-acid-700 dark:bg-acid-400/10 dark:text-acid-300">
                <Loader2 size={24} className="animate-spin" />
              </span>
              <p className="text-sm leading-5">{t('visitor.ui.loading', 'Loading visitor information...')}</p>
            </>
          ) : loadError ? (
            <>
              <AlertCircle size={48} className="mx-auto mb-4 text-red-300 dark:text-red-500" />
              <p className="text-sm leading-5 text-red-600 dark:text-red-400 mb-2">{t('visitor.ui.loadFailed', 'Load Failed')}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{loadError}</p>
              <button
                onClick={() => window.location.reload()}
                className="tgo-pill !h-8 !px-4 !text-xs"
              >
                {t('common.retry', 'Retry')}
              </button>
            </>
          ) : (
            <>
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                <User size={24} />
              </span>
              <p className="text-sm leading-5">{t('visitor.ui.noInfo', 'No visitor information')}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Get the channel's extra info for display
  const channelExtra = channelInfo?.extra as ChannelVisitorExtra | undefined;

  return (
    <div className={containerClasses} style={style}>
      {/* Panel Header */}
      <div className="tgo-vhero relative z-10 shrink-0 px-5 pb-5 pt-7">
        {showCloseButton && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="absolute right-3.5 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/15 backdrop-blur transition-all duration-200 hover:rotate-90 hover:bg-acid-400 hover:text-ink-900 hover:ring-transparent"
          >
            <X size={16} />
          </button>
        )}
        {/* Hidden file input for avatar upload */}
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleAvatarChange}
        />
        {/* Visitor Avatar and Name */}
        <VisitorHeader
          name={channelExtra?.display_nickname || visitor.name}
          status={visitor.status || 'offline'}
          avatar={visitor.avatar}
          platformType={(() => {
            const fromExtra: PlatformType | undefined = channelExtra?.platform_type as PlatformType | undefined;
            const fallbackPlatform = visitor.platform || '';
            return fromExtra ?? toPlatformType(fallbackPlatform);
          })()}
          lastSeenText={formatOnlineDuration(visitor.basicInfo.lastOnlineDurationMinutes, visitor.status === 'online')}
          email={visitor.basicInfo.email}
          phone={visitor.basicInfo.phone}
          location={channelExtra?.display_location || visitorData?.display_location || undefined}
          onAvatarClick={handleAvatarClick}
          isUploading={isUploadingAvatar}
          visitorId={channelId || visitor.id}
        />
      </div>

      {/* Panel Content */}
      <div 
        className="tgo-vpanel-body relative flex-grow overflow-y-auto px-3 pb-4 pt-3 space-y-3" 
        style={{ height: 0 }}
        onDragOver={handleContainerDragOver}
        onDrop={handleContainerDrop}
        onDragLeave={(e) => {
          // Clear the indicator only when leaving the container itself
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverId(null);
          }
        }}
      >
        {/* Loading/Error State */}
        {isUpdating && (
          <div className="pointer-events-none sticky top-0 z-20 mx-auto flex w-fit items-center rounded-full bg-ink-900 px-3 py-1 text-[11px] font-medium text-acid-300 shadow-lg dark:bg-acid-400 dark:text-ink-900">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            {t('common.updating', 'Updating...')}
          </div>
        )}

        {(updateError || loadError) && (
          <div className="flex items-center rounded-2xl bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-600 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900/50">
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="flex-1">{updateError || loadError}</span>
          </div>
        )}

        {sectionOrder.map((sectionId) => {
          const isDragging = draggedId === sectionId;
          const isDragOver = dragOverId === sectionId;
          const isRecentlyMoved = recentlyMovedId === sectionId;
          
          // Outer wrapper style: handles the shifting animation
          const wrapperClassName = `
            relative group/section
            transition-all duration-500 ease-[cubic-bezier(0.2,1,0.3,1)]
            ${isDragOver ? 'pt-10' : 'pt-0'}
            ${isRecentlyMoved ? 'z-20' : 'z-auto'}
          `;

          // Inner component style: handles drag visual feedback and the settle-in animation
          const sectionClassName = `
            transition-all duration-500 ease-[cubic-bezier(0.2,1,0.3,1)]
            ${isDragging ? 'opacity-20 scale-[0.95] blur-[2px]' : 'opacity-100 scale-100'}
            ${isRecentlyMoved ? 'ring-2 ring-acid-400/70' : ''}
          `;

          // Insertion position indicator
          const dropIndicator = isDragOver && (
            <div className="pointer-events-none absolute left-2 right-2 top-3 z-10 h-1 rounded-full bg-acid-400 shadow-[0_0_12px_rgba(205,238,85,0.8)] transition-all duration-300" />
          );

          const wrapWithIndicator = (content: React.ReactNode) => (
            <div 
              key={sectionId} 
              data-section-id={sectionId}
              className={wrapperClassName}
            >
              {dropIndicator}
              {content}
            </div>
          );

          switch (sectionId) {
            case 'basic_info':
              return wrapWithIndicator(
        <BasicInfoSection
          basicInfo={visitor.basicInfo}
          onUpdateBasicInfo={handleUpdateBasicInfo}
          onAddCustomAttribute={handleAddCustomAttribute}
          onUpdateCustomAttribute={handleUpdateCustomAttribute}
          onDeleteCustomAttribute={handleDeleteCustomAttribute}
                  draggable
                  className={sectionClassName}
                  expanded={expandedSections.basic_info}
                  onToggle={(expanded) => handleToggleSection('basic_info', expanded)}
                  onDragStart={(e) => handleDragStart(e, 'basic_info')}
                  onDragEnd={handleDragEnd}
        />
              );
            case 'ai_insights':
              return wrapWithIndicator(
        <AIInsightsSection
          satisfactionScore={aiInsights?.satisfaction_score ?? null}
          emotionScore={aiInsights?.emotion_score ?? null}
          intent={aiInsights?.intent ?? null}
          insightSummary={aiInsights?.insight_summary ?? null}
                  draggable
                  className={sectionClassName}
                  expanded={expandedSections.ai_insights}
                  onToggle={(expanded) => handleToggleSection('ai_insights', expanded)}
                  onDragStart={(e) => handleDragStart(e, 'ai_insights')}
                  onDragEnd={handleDragEnd}
                />
              );
            case 'tags':
              return wrapWithIndicator(
                <CollapsibleSection
                  title={t('visitor.tags.title', 'Tags')}
                  icon={<TagIcon size={14} />}
                  draggable
                  className={sectionClassName}
                  expanded={expandedSections.tags}
                  onToggle={(expanded) => handleToggleSection('tags', expanded)}
                  onDragStart={(e) => handleDragStart(e, 'tags')}
                  onDragEnd={handleDragEnd}
                  rightContent={isUpdating && (
                    <div className="flex items-center text-xs text-blue-600 dark:text-blue-400">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      {t('common.updating', 'Updating...')}
                    </div>
                  )}
                >
                  <TagManager
                    tags={visitor.tags}
                    onAddTag={handleAddTag}
                    onUpdateTag={handleUpdateTag}
                    onRemoveTag={handleRemoveTag}
                    fetchCommonTags={fetchCommonTags}
                    onAssociateExistingTag={handleAssociateExistingTag}
                    maxTags={8}
                    className="mt-1"
                  />
                </CollapsibleSection>
              );
            case 'system_info':
              return wrapWithIndicator(
        <SystemInfoSection
          systemInfo={useChannelMode ? systemInfo : (visitorData?.system_info || null)}
          language={channelExtra?.language || visitorData?.language || undefined}
          timezone={channelExtra?.timezone || visitorData?.timezone || undefined}
          ipAddress={channelExtra?.ip_address || visitorData?.ip_address || undefined}
          displayLocation={channelExtra?.display_location || visitorData?.display_location || undefined}
                  draggable
                  className={sectionClassName}
                  expanded={expandedSections.system_info}
                  onToggle={(expanded) => handleToggleSection('system_info', expanded)}
                  onDragStart={(e) => handleDragStart(e, 'system_info')}
                  onDragEnd={handleDragEnd}
                />
              );
            case 'plugins':
              return visitor && wrapWithIndicator(
          <PluginPanelSection
            visitorId={visitor.id}
            context={{
              extension_type: 'visitor_panel',
              visitor_id: visitor.id,
              channel_id: channelId,
              channel_type: channelType,
              platform_type: channelExtra?.platform_type,
            }}
                  draggable
                  className={sectionClassName}
                  expanded={expandedSections.plugins}
                  onToggle={(expanded) => handleToggleSection('plugins', expanded)}
                  onDragStart={(e) => handleDragStart(e, 'plugins')}
                  onDragEnd={handleDragEnd}
                />
              );
            case 'recent_activity':
              return wrapWithIndicator(
                <RecentActivitySection 
                  activities={useChannelMode ? recentActivities : (visitorData?.recent_activities || [])} 
                  draggable
                  className={sectionClassName}
                  expanded={expandedSections.recent_activity}
                  onToggle={(expanded) => handleToggleSection('recent_activity', expanded)}
                  onDragStart={(e) => handleDragStart(e, 'recent_activity')}
                  onDragEnd={handleDragEnd}
                />
              );
            default:
              return null;
          }
        })}
      </div>

      {/* Avatar Crop Modal */}
        <ImageCropModal
        isOpen={showCropModal}
        imageSrc={cropImageSrc}
        aspect={1}
        mimeType={cropImageMimeType}
        title={t('visitor.avatar.cropTitle', 'Crop Avatar')}
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
};

export default VisitorDetailPanel;
