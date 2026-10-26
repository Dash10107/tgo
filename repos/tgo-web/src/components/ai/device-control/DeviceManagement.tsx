/**
 * DeviceManagement Component
 * Main page for managing connected devices
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  MonitorSmartphone,
  Plus,
  Search,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle,
  Activity,
  X,
} from 'lucide-react';
import DeviceCard from './DeviceCard';
import BindCodeModal from './BindCodeModal';
import EditDeviceModal from './EditDeviceModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { ComputerUseSessionMonitor } from '../remote-agent';
import { useDeviceControlStore } from '@/stores/deviceControlStore';
import type { Device, DeviceStatus } from '@/types/deviceControl';

const DeviceManagement: React.FC = () => {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | 'all'>('all');
  const [showBindCodeModal, setShowBindCodeModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [deviceToDisconnect, setDeviceToDisconnect] = useState<Device | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  
  // Session monitor state
  const [showSessionMonitor, setShowSessionMonitor] = useState(false);
  const [monitoringSessionId, setMonitoringSessionId] = useState<string | null>(null);

  const {
    devices,
    isLoading,
    error,
    loadDevices,
    deleteDevice,
    disconnectDevice,
    clearError,
  } = useDeviceControlStore();

  // Load devices on mount
  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // Filter devices
  const filteredDevices = useMemo(() => {
    let filtered = devices;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.device_name.toLowerCase().includes(query) ||
          d.os.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [devices, statusFilter, searchQuery]);

  // Stats
  const onlineCount = devices.filter((d) => d.status === 'online').length;
  const offlineCount = devices.filter((d) => d.status === 'offline').length;

  // Handlers
  const handleEdit = (device: Device) => {
    setSelectedDevice(device);
    setShowEditModal(true);
  };

  const handleDelete = (device: Device) => {
    setDeviceToDelete(device);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deviceToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDevice(deviceToDelete.id);
      setShowDeleteConfirm(false);
      setDeviceToDelete(null);
    } catch (err) {
      console.error('Failed to delete device:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDisconnect = (device: Device) => {
    setDeviceToDisconnect(device);
    setShowDisconnectConfirm(true);
  };

  const handleDisconnectConfirm = async () => {
    if (!deviceToDisconnect) return;
    setIsDisconnecting(true);
    try {
      await disconnectDevice(deviceToDisconnect.id);
      setShowDisconnectConfirm(false);
      setDeviceToDisconnect(null);
    } catch (err) {
      console.error('Failed to disconnect device:', err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRefresh = () => {
    clearError();
    loadDevices();
  };

  return (
    <main className="flex-grow flex flex-col bg-[#f8fafc] dark:bg-gray-950 overflow-hidden">
      {/* Header */}
      <header className="px-8 py-5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-30">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MonitorSmartphone className="w-7 h-7 text-blue-600" />
            {t('deviceControl.title', 'Device Control')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('deviceControl.subtitle', 'Manage remote devices controlled by AI agents')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative group hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder={t('deviceControl.search.placeholder', 'Search devices...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-48 lg:w-64 bg-gray-100/50 dark:bg-gray-800/50 border-transparent focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl text-sm transition-all outline-none"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshCw
              className={`w-5 h-5 text-gray-500 ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>

          {/* Session Monitor */}
          <button
            onClick={() => setShowSessionMonitor(true)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xl transition-colors group"
            title={t('deviceControl.sessionMonitor.title', 'Session Monitor')}
          >
            <Activity className="w-5 h-5 text-purple-500 group-hover:text-purple-600" />
            <span className="hidden lg:inline text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">
              {t('deviceControl.sessionMonitor.title', 'Session Monitor')}
            </span>
          </button>

          <div className="h-8 w-px bg-gray-200 dark:bg-gray-800 mx-1 hidden sm:block" />

          {/* Add Device */}
          <button
            onClick={() => setShowBindCodeModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden lg:inline">
              {t('deviceControl.addDevice', 'Add Device')}
            </span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto p-8 space-y-8">
          {/* Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-200 dark:shadow-none flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
            <div className="relative z-10">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <MonitorSmartphone className="w-6 h-6" />
                {t('deviceControl.banner.title', 'Remote Device Control')}
              </h3>
              <p className="text-blue-100 text-sm mt-1 opacity-90 max-w-xl">
                {t(
                  'deviceControl.banner.description',
                  'Connect your computer or mobile device to let AI agents control the screen directly for more complex automation tasks.'
                )}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <MonitorSmartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {devices.length}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('deviceControl.stats.total', 'Total Devices')}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <Wifi className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {onlineCount}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('deviceControl.stats.online', 'Online')}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl">
                  <WifiOff className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {offlineCount}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('deviceControl.stats.offline', 'Offline')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t('deviceControl.filter.all', 'All')}
            </button>
            <button
              onClick={() => setStatusFilter('online')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                statusFilter === 'online'
                  ? 'bg-green-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t('deviceControl.filter.online', 'Online')}
            </button>
            <button
              onClick={() => setStatusFilter('offline')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                statusFilter === 'offline'
                  ? 'bg-gray-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t('deviceControl.filter.offline', 'Offline')}
            </button>
          </div>

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={handleRefresh}
                className="ml-auto px-3 py-1 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium transition-colors"
              >
                {t('common.retry', 'Retry')}
              </button>
            </div>
          )}

          {/* Device List */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-4">
                <MonitorSmartphone className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {searchQuery || statusFilter !== 'all'
                  ? t('deviceControl.empty.noResults', 'No matching devices found')
                  : t('deviceControl.empty.title', 'No Connected Devices')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
                {searchQuery || statusFilter !== 'all'
                  ? t('deviceControl.empty.tryOther', 'Try other search criteria or filters')
                  : t(
                      'deviceControl.empty.description',
                      'Click the "Add Device" button to generate a bind code, then enter the bind code in the control client software to connect your device.'
                    )}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <button
                  onClick={() => setShowBindCodeModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  {t('deviceControl.addDevice', 'Add Device')}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDisconnect={handleDisconnect}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <BindCodeModal
        isOpen={showBindCodeModal}
        onClose={() => setShowBindCodeModal(false)}
      />

      <EditDeviceModal
        isOpen={showEditModal}
        device={selectedDevice}
        onClose={() => {
          setShowEditModal(false);
          setSelectedDevice(null);
        }}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('deviceControl.delete.title', 'Confirm Delete')}
        message={t('deviceControl.delete.message', {
          name: deviceToDelete?.device_name,
          defaultValue: `Are you sure you want to delete the device "${deviceToDelete?.device_name}"? This action cannot be undone.`,
        })}
        confirmText={t('common.delete', 'Delete')}
        cancelText={t('common.cancel', 'Cancel')}
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeviceToDelete(null);
        }}
        isLoading={isDeleting}
      />

      <ConfirmDialog
        isOpen={showDisconnectConfirm}
        title={t('deviceControl.disconnect.title', 'Confirm Disconnect')}
        message={t('deviceControl.disconnect.message', {
          name: deviceToDisconnect?.device_name,
          defaultValue: `Are you sure you want to disconnect the device "${deviceToDisconnect?.device_name}"?`,
        })}
        confirmText={t('deviceControl.device.disconnect', 'Disconnect')}
        cancelText={t('common.cancel', 'Cancel')}
        confirmVariant="primary"
        onConfirm={handleDisconnectConfirm}
        onCancel={() => {
          setShowDisconnectConfirm(false);
          setDeviceToDisconnect(null);
        }}
        isLoading={isDisconnecting}
      />

      {/* Session Monitor Modal */}
      {showSessionMonitor && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-900/60 dark:bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
            onClick={() => setShowSessionMonitor(false)}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-purple-600 to-indigo-600">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {t('deviceControl.sessionMonitor.modalTitle', 'Computer Use Session Monitor')}
                  </h2>
                  <p className="text-purple-100 text-xs opacity-80">
                    {t('deviceControl.sessionMonitor.modalSubtitle', 'View the execution status of AI-controlled devices in real time')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSessionMonitor(false)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {monitoringSessionId ? (
                <ComputerUseSessionMonitor
                  sessionId={monitoringSessionId}
                  onClose={() => setMonitoringSessionId(null)}
                  autoRefresh={true}
                  refreshInterval={2000}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl mb-4">
                    <Activity className="w-12 h-12 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {t('deviceControl.sessionMonitor.noSession', 'No active sessions')}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
                    {t('deviceControl.sessionMonitor.noSessionDesc', 'When an AI agent starts controlling a device to perform a task, you can monitor its progress and steps here in real time.')}
                  </p>
                  <div className="flex flex-col gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <p>💡 {t('deviceControl.sessionMonitor.tip1', 'Make sure the device is online')}</p>
                    <p>🤖 {t('deviceControl.sessionMonitor.tip2', 'Add a remote agent in the team configuration')}</p>
                    <p>💬 {t('deviceControl.sessionMonitor.tip3', 'Ask the AI agent in a conversation to perform device operations')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default DeviceManagement;
