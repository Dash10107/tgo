import React from 'react';
import { useWuKongIMWebSocket } from '../../hooks/useWuKongIMWebSocket';

import { useTranslation } from 'react-i18next';
interface ConnectionStatusProps {
  className?: string;
  showText?: boolean;
}

/**
 * Connection status indicator component
 * Shows real-time WebSocket connection status
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = React.memo(({
  className = '',
  showText = true,
}) => {
  const { t } = useTranslation();
  const { connectionStatus, connect } = useWuKongIMWebSocket();
  const { isConnected, isConnecting, error } = connectionStatus;

  const getStatusColor = () => {
    if (isConnected) return 'bg-green-500';
    if (isConnecting) return 'bg-yellow-500';
    if (error) return 'bg-red-500';
    return 'bg-gray-400';
  };

  const getStatusText = () => {
    if (isConnected) return t('connectionStatus.connected', 'Connected');
    if (isConnecting) return t('connectionStatus.connecting', 'Connecting...');
    if (error) return t('connectionStatus.failed', 'Connection failed');
    return t('connectionStatus.disconnected', 'Not connected');
  };

  const handleRetryConnection = async () => {
    if (!isConnected && !isConnecting) {
      try {
        await connect();
      } catch (error) {
        console.error('Manual reconnection failed:', error);
      }
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Status indicator dot */}
      <div className="relative">
        <div
          className={`w-2 h-2 rounded-full ${getStatusColor()} ${
            isConnecting ? 'animate-pulse' : ''
          }`}
        />
        {isConnected && (
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping opacity-75" />
        )}
      </div>

      {/* Status text */}
      {showText && (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {getStatusText()}
        </span>
      )}

      {/* Retry button for failed connections */}
      {error && !isConnecting && (
        <button
          onClick={handleRetryConnection}
          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
          title={t('connectionStatus.reconnect', 'Reconnect')}
        >
          {t('common.retry', 'Retry')}
        </button>
      )}

      {/* Error tooltip */}
      {error && (
        <div className="relative group">
          <div className="w-3 h-3 text-red-500 cursor-help">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
            {error}
          </div>
        </div>
      )}
    </div>
  );
});

ConnectionStatus.displayName = 'ConnectionStatus';
