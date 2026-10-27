import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, MessageSquare, FileText, X, ChevronDown } from 'lucide-react';
import { KnowledgeBaseApiService } from '@/services/knowledgeBaseApi';
import { useAuthStore } from '@/stores/authStore';
import { SearchField } from '@/components/ui/PageKit';

interface QADataViewProps {
    fileId: string;
    fileName: string;
    onClose: () => void;
}

interface FileSegment {
    id: string;
    content: string;
    content_type?: string;
    token_count?: number;
    tags?: {
        is_qa?: boolean;
        original_question?: string;
        original_answer?: string;
    } | null;
}

const parseSegment = (seg: FileSegment) => {
    const content = seg.content || '';
    // QA detection: content_type, tags.is_qa, or the "Question:/Answer:" content pattern
    const isQA =
        seg.content_type === 'qa_pair' ||
        seg.content_type === 'qa' ||
        Boolean(seg.tags?.is_qa) ||
        (content.includes('Question:') && content.includes('Answer:'));

    if (!isQA) return { isQA, content, question: '', answer: '' };

    const qPart = content.match(/Question:\s*(.*)\nAnswer:/s);
    const aPart = content.match(/Answer:\s*(.*)/s);
    return {
        isQA,
        content,
        question: qPart ? qPart[1].trim() : (seg.tags?.original_question || ''),
        answer: aPart ? aPart[1].trim() : (seg.tags?.original_answer || content),
    };
};

/**
 * Dialog listing the parsed segments / Q&A pairs of one uploaded file
 */
export const QADataView: React.FC<QADataViewProps> = ({ fileId, fileName, onClose }) => {
    const { t } = useTranslation();
    const [segments, setSegments] = useState<FileSegment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const projectId = useAuthStore(state => state.user?.project_id);

    const loadSegments = useCallback(async () => {
        if (!fileId || !projectId) return;
        setIsLoading(true);
        try {
            const response = await KnowledgeBaseApiService.getFileDocuments(fileId, { project_id: projectId, limit: 100 }) as { data?: FileSegment[] };
            setSegments(response.data || []);
        } catch (error) {
            console.error('Failed to load segments:', error);
        } finally {
            setIsLoading(false);
        }
    }, [fileId, projectId]);

    useEffect(() => {
        loadSegments();
    }, [loadSegments]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const filteredSegments = segments.filter(seg => (seg.content || '').toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div aria-hidden="true" className="absolute inset-0 bg-gray-900/45 backdrop-blur-[6px] dark:bg-black/60" onClick={onClose} />
            <div role="dialog" aria-modal="true" className="tgo-modal relative h-[86vh] max-w-4xl">
                {/* Header */}
                <div className="flex items-start gap-4 px-7 pb-5 pt-7">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900">
                        <MessageSquare className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                        <h2 className="truncate text-xl font-medium tracking-tight text-gray-900 dark:text-white" title={fileName}>
                            {fileName}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {t('knowledge.qa.results', 'Q&A Pairs')} · {t('knowledge.qa.segmentCount', '{{count}} Q&A pairs in total', { count: segments.length })}
                        </p>
                    </div>
                    <button onClick={onClose} aria-label={t('common.close', 'Close')} className="tgo-icon-btn">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="px-7 pb-4">
                    <SearchField
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder={t('knowledge.qa.searchSegments', 'Search segment content...')}
                        wide
                    />
                </div>

                {/* Content */}
                <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto border-t border-gray-100 bg-gray-50/70 px-7 py-5 dark:border-gray-800 dark:bg-gray-950/40">
                    {isLoading ? (
                        <div className="flex h-full flex-col items-center justify-center py-12">
                            <Loader2 className="mb-4 h-7 w-7 animate-spin text-gray-400" />
                            <p className="text-sm text-gray-500">{t('knowledge.qa.loadingSegments', 'Loading segment results...')}</p>
                        </div>
                    ) : filteredSegments.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm dark:bg-gray-800">
                                <FileText className="h-6 w-6" />
                            </span>
                            <p className="font-medium text-gray-900 dark:text-white">
                                {searchTerm ? t('knowledge.qa.noResults', 'No matching segments found') : t('knowledge.qa.noSegments', 'This file has no Q&A segment results yet')}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                                {searchTerm ? t('knowledge.qa.tryDifferentSearch', 'Try a different keyword') : t('knowledge.qa.ensureQaMode', 'Make sure Q&A split mode was enabled when uploading')}
                            </p>
                        </div>
                    ) : (
                        filteredSegments.map((seg, idx) => {
                            const { isQA, content, question, answer } = parseSegment(seg);
                            const isExpanded = expandedId === seg.id;

                            return (
                                <div
                                    key={seg.id}
                                    className={`overflow-hidden rounded-3xl bg-white transition-shadow dark:bg-gray-900 ${
                                        isExpanded
                                            ? 'shadow-[inset_0_0_0_1.5px_var(--color-ink-900),0_16px_32px_-20px_rgb(15_16_18/0.35)] dark:shadow-[inset_0_0_0_1.5px_var(--color-acid-400)]'
                                            : 'shadow-[inset_0_0_0_1px_var(--color-gray-200)] hover:shadow-[inset_0_0_0_1px_var(--color-gray-300)] dark:shadow-[inset_0_0_0_1px_var(--color-gray-800)]'
                                    }`}
                                >
                                    <button
                                        type="button"
                                        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                                        onClick={() => setExpandedId(isExpanded ? null : seg.id)}
                                        aria-expanded={isExpanded}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2 flex items-center gap-2">
                                                <span className="tgo-chip h-5 px-2 text-[10px] font-semibold tabular-nums">#{idx + 1}</span>
                                                <span className={`tgo-chip h-5 px-2 text-[10px] font-semibold uppercase tracking-wider ${isQA ? 'bg-acid-200 text-ink-900 dark:bg-acid-400/20 dark:text-acid-300' : ''}`}>
                                                    {isQA ? t('knowledge.qa.qaPair', 'QA pair') : t('knowledge.qa.textSegment', 'Text segment')}
                                                </span>
                                            </div>
                                            <h3 className={`text-sm font-medium text-gray-900 dark:text-white ${!isExpanded ? 'truncate' : ''}`}>
                                                {isQA ? question : `${content.slice(0, 100)}${content.length > 100 ? '…' : ''}`}
                                            </h3>
                                        </div>
                                        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isExpanded && (
                                        <div className="animate-in fade-in slide-in-from-top-2 space-y-3 px-5 pb-5">
                                            {isQA ? (
                                                <>
                                                    <div>
                                                        <p className="tgo-eyebrow mb-1.5 flex items-center gap-1.5">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-ink-900 dark:bg-white" />
                                                            {t('knowledge.qa.form.question', 'Question')}
                                                        </p>
                                                        <div className="rounded-2xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-800 dark:bg-gray-800/60 dark:text-gray-200">{question}</div>
                                                    </div>
                                                    <div>
                                                        <p className="tgo-eyebrow mb-1.5 flex items-center gap-1.5">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-acid-500" />
                                                            {t('knowledge.qa.form.answer', 'Answer')}
                                                        </p>
                                                        <div className="rounded-2xl bg-acid-50 p-4 text-sm leading-relaxed text-gray-800 dark:bg-acid-400/5 dark:text-gray-200">{answer}</div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="whitespace-pre-wrap rounded-2xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-800 dark:bg-gray-800/60 dark:text-gray-200">{content}</div>
                                            )}

                                            <div className="flex items-center gap-2 pt-1">
                                                <span className="tgo-chip">{seg.token_count || 0} tokens</span>
                                                <span className="tgo-chip">{content.length} {t('knowledge.qa.chars', 'characters')}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="flex justify-end border-t border-gray-100 px-7 py-5 dark:border-gray-800">
                    <button onClick={onClose} className="tgo-pill h-11 px-6 text-sm">
                        {t('common.close', 'Close')}
                    </button>
                </div>
            </div>
        </div>
    );
};
