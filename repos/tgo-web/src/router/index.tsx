import { createBrowserRouter, Navigate } from 'react-router-dom';
import RootLayout from '../components/layout/RootLayout';
import Layout from '../components/layout/Layout';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import ChatPage from '../pages/ChatPage';
import VisitorManagement from '../pages/VisitorManagement';
import AIInterface from '../pages/AIInterface';
import AgentManagement from '../components/ai/AgentManagement';
import Tools from '../components/ai/Tools';
import Skills from '../components/ai/Skills';
import { DeviceManagement } from '../components/ai/device-control';
import WorkflowManagement from '../pages/WorkflowManagement';
import WorkflowEditorPage from '../pages/WorkflowEditorPage';
// @ts-ignore
import { LoginPage, RegisterPage } from 'auth-pages';
import SetupWizard from '../pages/SetupWizard';

import PlatformOverview from '../components/platforms/PlatformOverview';
import KnowledgeBase from '../pages/KnowledgeBase';
import KnowledgeBaseDetail from '../pages/KnowledgeBaseDetail';
import WebsiteKnowledgeBaseDetail from '../pages/WebsiteKnowledgeBaseDetail';
import QAKnowledgeBaseDetail from '../pages/QAKnowledgeBaseDetail';
import PlatformManagement from '../pages/PlatformManagement';
import PlatformConfigPage from '../pages/PlatformConfigPage';
import SettingsLayout from '../pages/SettingsLayout';

import GeneralSettings from '../components/settings/GeneralSettings';
import ProfileSettings from '../components/settings/ProfileSettings';
import StaffSettings from '../components/settings/StaffSettings';
import NotificationSettings from '../components/settings/NotificationSettings';
import ModelProvidersSettings from '../components/settings/ModelProvidersSettings';
import PluginsSettings from '../components/settings/PluginsSettings';
import AboutSettings from '../components/settings/AboutSettings';
import MarkdownTestPage from '../pages/MarkdownTestPage';

// Import SaaS routes if they exist (will be resolved via Vite alias or empty default)
// @ts-ignore
import { saasRoutes, saasPublicRoutes } from 'saas-routes';

/**
 * Router configuration for the application
 */
export const router = createBrowserRouter([
  // Public marketing landing page – outside RootLayout so it never waits on
  // the backend setup check, and lazy-loaded so the 3D stack stays out of the
  // main app bundle.
  {
    path: '/landing',
    lazy: async () => ({ Component: (await import('../pages/LandingPage')).default }),
    hydrateFallbackElement: <div style={{ minHeight: '100vh', background: '#050506' }} />
  },
  {
    path: '/',
    element: <RootLayout />,
    children: [
      // Setup wizard route (outside of Layout and ProtectedRoute)
      {
        path: 'setup',
        element: <SetupWizard />
      },
      // Authentication routes (outside of Layout)
      {
        path: 'login',
        element: <LoginPage />
      },
      {
        path: 'register',
        element: <RegisterPage />
      },
      // SaaS public routes (verify-email, etc.)
      ...(saasPublicRoutes || []),
      // Main application routes
      {
        path: '/',
        element: (
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        ),
        children: [
      {
        index: true,
        element: <Navigate to="/chat" replace />
      },
      {
        path: 'settings',
        element: <SettingsLayout />,
        children: [
          { index: true, element: <Navigate to="/settings/profile" replace /> },

          { path: 'profile', element: <ProfileSettings /> },
          { path: 'general', element: <GeneralSettings /> },
          { path: 'notifications', element: <NotificationSettings /> },
          { path: 'staff', element: <StaffSettings /> },
          { path: 'providers', element: <ModelProvidersSettings /> },
          { path: 'plugins', element: <PluginsSettings /> },
          { path: 'about', element: <AboutSettings /> },
          // Inject SaaS settings routes
          ...(saasRoutes || [])
            .filter((r: any) => r.path.startsWith('/settings/'))
            .map((r: any) => ({
              ...r,
              path: r.path.replace('/settings/', '')
            }))
        ]
      },
      {
        path: 'chat',
        element: <ChatPage />,
        children: [
          { index: true, element: null },
          { path: ':channelType/:channelId', element: null }
        ]
      },
      {
        path: 'visitors',
        element: <VisitorManagement />
      },
      {
        path: 'ai',
        element: <AIInterface />,
        children: [
          {
            index: true,
            element: <Navigate to="/ai/agents" replace />
          },
          {
            path: 'agents',
            element: <AgentManagement />
          },
          {
            path: 'tools',
            element: <Tools />
          },
          {
            path: 'skills',
            element: <Skills />
          },
          {
            path: 'device-control',
            element: <DeviceManagement />
          },
          {
            path: 'workflows',
            element: <WorkflowManagement />
          },
          {
            path: 'workflows/:id/edit',
            element: <WorkflowEditorPage />
          },
          {
            path: 'workflows/new',
            element: <WorkflowEditorPage />
          }
        ]
      },
      {
        path: 'knowledge',
        element: <KnowledgeBase/>
      },
      {
        path: 'knowledge/:id',
        element: <KnowledgeBaseDetail/>
      },
      {
        path: 'knowledge/website/:id',
        element: <WebsiteKnowledgeBaseDetail/>
      },
      {
        path: 'knowledge/qa/:id',
        element: <QAKnowledgeBaseDetail/>
      },
      {
        path: 'platforms',
        element: <PlatformManagement />,
        children: [
          {
            index: true,
            element: <PlatformOverview />
          },
          {
            path: ':platformId',
            element: <PlatformConfigPage />
          }
        ]
      },
      {
        path: 'test/markdown',
        element: <MarkdownTestPage />
      },
      // Inject other SaaS routes (that don't go into settings)
      ...(saasRoutes || []).filter((r: any) => !r.path.startsWith('/settings/'))
    ]
      }
    ]
  }
]);
