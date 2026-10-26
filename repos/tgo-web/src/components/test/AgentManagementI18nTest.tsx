import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Test component to verify Agent Management i18n implementation
 */
const AgentManagementI18nTest: React.FC = () => {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Agent Management i18n Test</h1>
        <button
          onClick={toggleLanguage}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Switch to {i18n.language === 'zh' ? 'English' : 'Chinese'}
        </button>
        <p className="mt-2 text-sm text-gray-600">
          Current language: {i18n.language}
        </p>
      </div>

      <div className="space-y-6">
        {/* Page Title and Actions */}
        <section className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Page Title & Actions</h2>
          <div className="space-y-2">
            <p><strong>Title:</strong> {t('agents.title', 'Agent Team Management')}</p>
            <p><strong>Create:</strong> {t('agents.actions.create', 'Create Agent')}</p>
            <p><strong>Refresh:</strong> {t('agents.actions.refresh', 'Refresh')}</p>
            <p><strong>Edit:</strong> {t('agents.actions.edit', 'Edit')}</p>
            <p><strong>Delete:</strong> {t('agents.actions.delete', 'Delete')}</p>
          </div>
        </section>

        {/* Messages */}
        <section className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Messages</h2>
          <div className="space-y-2">
            <p><strong>Load Failed:</strong> {t('agents.messages.loadFailed', 'Load Failed')}</p>
            <p><strong>Load Failed Desc:</strong> {t('agents.messages.loadFailedDesc', 'Unable to load agent list, please try again later')}</p>
            <p><strong>Refresh Success:</strong> {t('agents.messages.refreshSuccess', 'Refresh Successful')}</p>
            <p><strong>Create Success:</strong> {t('agents.messages.createSuccessDesc', 'Agent "{{name}}" has been successfully created', { name: 'Test Agent' })}</p>
            <p><strong>Delete Success:</strong> {t('agents.messages.deleteSuccessDesc', 'Agent "{{name}}" has been deleted', { name: 'Test Agent' })}</p>
          </div>
        </section>

        {/* Card Content */}
        <section className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Card Content</h2>
          <div className="space-y-2">
            <p><strong>Default Role:</strong> {t('agents.card.defaultRole', 'Agent')}</p>
            <p><strong>No Tools:</strong> {t('agents.card.noTools', 'No tools associated')}</p>
            <p><strong>No Knowledge Bases:</strong> {t('agents.card.noKnowledgeBases', 'No knowledge bases associated')}</p>
            <p><strong>LLM Label:</strong> {t('agents.card.llmLabel', 'LLM')}</p>
            <p><strong>Edit Tooltip:</strong> {t('agents.card.editTooltip', 'Edit Agent')}</p>
            <p><strong>View More:</strong> {t('agents.actions.viewMore', 'View More')}</p>
            <p><strong>Collapse:</strong> {t('agents.actions.collapse', 'Collapse')}</p>
          </div>
        </section>

        {/* Empty State */}
        <section className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Empty State</h2>
          <div className="space-y-2">
            <p><strong>Title:</strong> {t('agents.empty.title', 'No Agents')}</p>
            <p><strong>Description:</strong> {t('agents.empty.description', 'Click the "Create Agent" button to start creating your first agent')}</p>
          </div>
        </section>

        {/* Error State */}
        <section className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Error State</h2>
          <div className="space-y-2">
            <p><strong>Title:</strong> {t('agents.error.title', 'Load Failed')}</p>
            <p><strong>Retry:</strong> {t('agents.error.retry', 'Retry')}</p>
          </div>
        </section>

        {/* Modal Content */}
        <section className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Modal Content</h2>
          <div className="space-y-2">
            <p><strong>Create Title:</strong> {t('agents.modal.create.title', 'Create Agent')}</p>
            <p><strong>Edit Title:</strong> {t('agents.modal.edit.title', 'Edit Agent')}</p>
            <p><strong>Delete Title:</strong> {t('agents.modal.delete.title', 'Delete Agent')}</p>
            <p><strong>Delete Message:</strong> {t('agents.modal.delete.message', 'Are you sure you want to delete agent "{{name}}"? This action cannot be undone.', { name: 'Test Agent' })}</p>
            <p><strong>Delete Confirm:</strong> {t('agents.modal.delete.confirm', 'Delete')}</p>
            <p><strong>Delete Cancel:</strong> {t('agents.modal.delete.cancel', 'Cancel')}</p>
          </div>
        </section>

        {/* Pagination */}
        <section className="border p-4 rounded">
          <h2 className="font-semibold mb-2">Pagination</h2>
          <div className="space-y-2">
            <p><strong>Previous:</strong> {t('agents.pagination.previous', 'Previous')}</p>
            <p><strong>Next:</strong> {t('agents.pagination.next', 'Next')}</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AgentManagementI18nTest;
