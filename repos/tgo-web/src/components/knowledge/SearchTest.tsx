import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, FileText, Search, HelpCircle, Zap, Type, Layers, Timer, Hash, ArrowRight, type LucideIcon } from 'lucide-react';
import { KnowledgeBaseApiService, type SearchResultDoc } from '@/services/knowledgeBaseApi';
import { useToast } from '@/hooks/useToast';
import { useAuthStore } from '@/stores/authStore';

interface SearchTestProps {
    collectionId: string;
}

type SearchMode = 'hybrid' | 'embedding' | 'fulltext';

type ContentType = 'qa_pair' | 'paragraph' | 'heading' | 'table' | 'list' | 'code';

const CONTENT_TYPES: { value: ContentType; name: string }[] = [
    { value: 'qa_pair', name: 'Q&A Pairs' },
    { value: 'paragraph', name: 'Paragraph' },
    { value: 'heading', name: 'Heading' },
    { value: 'table', name: 'Table' },
    { value: 'list', name: 'List' },
    { value: 'code', name: 'Code Block' },
];

const SEARCH_MODES: { value: SearchMode; name: string; description: string; icon: LucideIcon }[] = [
    { value: 'hybrid', name: 'Hybrid Search', description: 'Combines semantic understanding with keyword matching (recommended)', icon: Layers },
    { value: 'embedding', name: 'Semantic Search', description: 'Based on vector similarity; understands semantic meaning', icon: Zap },
    { value: 'fulltext', name: 'Full-text Search', description: 'Based on keyword matching for exact lookup', icon: Type },
];

const metaString = (value: unknown): string | undefined =>
    typeof value === 'string' && value ? value : undefined;

export const SearchTest: React.FC<SearchTestProps> = ({ collectionId }) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const projectId = useAuthStore(state => state.user?.project_id);

    // Search Parameters
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(10);
    const [searchMode, setSearchMode] = useState<SearchMode>('hybrid');
    const [contentTypes, setContentTypes] = useState<ContentType[]>(CONTENT_TYPES.map(ct => ct.value));

    // States
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [results, setResults] = useState<SearchResultDoc[]>([]);
    const [searchInfo, setSearchInfo] = useState<{ time: number; total: number; mode: string } | null>(null);

    const allSelected = contentTypes.length === CONTENT_TYPES.length;

    const handleSearch = async () => {
        if (!query.trim() || !projectId) return;

        setIsLoading(true);
        try {
            const response = await KnowledgeBaseApiService.searchDocuments(
                collectionId,
                {
                    query: query.trim(),
                    limit,
                    search_mode: searchMode,
                    filters: allSelected ? undefined : { content_type: contentTypes }
                },
                projectId
            );

            setResults(response.results);
            setSearchInfo({
                time: response.search_metadata.search_time_ms,
                total: response.search_metadata.total_results,
                mode: response.search_metadata.search_type,
            });
            setHasSearched(true);
        } catch (error) {
            console.error('Search failed:', error);
            showToast('error', t('knowledge.search.failed', 'Search failed'), error instanceof Error ? error.message : String(error));
        } finally {
            setIsLoading(false);
        }
    };

    const toggleContentType = (value: ContentType) => {
        if (!contentTypes.includes(value)) {
            setContentTypes([...contentTypes, value]);
        } else if (contentTypes.length > 1) {
            setContentTypes(contentTypes.filter(ct => ct !== value));
        } else {
            showToast('warning', t('knowledge.searchTest.selectAtLeastOne', 'Please select at least one content type'));
        }
    };

    const scoreTone = (score: number) => {
        if (score >= 0.8) return { bar: 'bg-acid-500', text: 'text-acid-700 dark:text-acid-300' };
        if (score >= 0.5) return { bar: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-300' };
        return { bar: 'bg-gray-300 dark:bg-gray-600', text: 'text-gray-500 dark:text-gray-400' };
    };

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left column: query + configuration */}
            <div className="space-y-5 lg:col-span-4">
                <div className="tgo-surface p-6">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900">
                            <Search className="h-4 w-4" />
                        </span>
                        <div>
                            <h3 className="text-lg font-medium tracking-tight text-gray-900 dark:text-white">{t('knowledge.search.title', 'Search Test')}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{t('knowledge.searchTest.subtitle', 'Test knowledge base retrieval and simulate the search behavior used when the AI replies')}</p>
                        </div>
                    </div>

                    <label htmlFor="kb-search-query" className="tgo-label mt-6">{t('knowledge.search.query', 'Test text')}</label>
                    <textarea
                        id="kb-search-query"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('knowledge.search.placeholder', 'Enter a question to test...')}
                        className="tgo-input h-32 resize-none"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSearch();
                            }
                        }}
                    />

                    <div className="mt-4 flex items-center gap-3">
                        <button
                            onClick={() => handleSearch()}
                            disabled={isLoading || !query.trim()}
                            className="tgo-btn-ink flex-1 justify-center"
                            data-icon-motion="nudge"
                        >
                            <span className="tgo-btn-icon">
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                            </span>
                            {isLoading ? t('knowledge.searchTest.searching', 'Searching...') : t('knowledge.searchTest.startSearch', 'Start search')}
                        </button>
                        <label className="flex h-11 items-center gap-2 rounded-full bg-gray-50 pl-4 pr-1.5 text-xs text-gray-500 shadow-[inset_0_0_0_1px_var(--color-gray-200)] dark:bg-gray-800 dark:shadow-[inset_0_0_0_1px_var(--color-gray-700)]" title={t('knowledge.searchTest.resultCount', 'Result count')}>
                            <Hash className="h-3.5 w-3.5" />
                            <input
                                type="number"
                                value={limit}
                                onChange={(e) => setLimit(Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 10)))}
                                min={1}
                                max={50}
                                aria-label={t('knowledge.searchTest.resultCount', 'Result count')}
                                className="h-8 w-14 rounded-full bg-white text-center text-sm font-medium text-gray-900 outline-none dark:bg-gray-900 dark:text-gray-100"
                            />
                        </label>
                    </div>
                </div>

                <div className="tgo-surface p-6">
                    <h3 className="tgo-eyebrow mb-3">{t('knowledge.search.mode', 'Search mode')}</h3>
                    <div className="space-y-2" role="radiogroup">
                        {SEARCH_MODES.map(mode => {
                            const active = searchMode === mode.value;
                            const Icon = mode.icon;
                            return (
                                <button
                                    key={mode.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    data-active={active}
                                    onClick={() => setSearchMode(mode.value)}
                                    className="tgo-option w-full !items-start"
                                >
                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${active ? 'bg-ink-900 text-acid-400 dark:bg-acid-400 dark:text-ink-900' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {t(`knowledge.searchTest.modes.${mode.value}.name`, mode.name)}
                                            {mode.value === 'hybrid' && (
                                                <span className="rounded-full bg-acid-300 px-1.5 text-[10px] font-semibold leading-4 text-ink-900">
                                                    {t('knowledge.searchTest.recommended', 'Recommended')}
                                                </span>
                                            )}
                                        </span>
                                        <span className="mt-0.5 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                            {t(`knowledge.searchTest.modes.${mode.value}.description`, mode.description)}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="tgo-surface p-6">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="tgo-eyebrow">{t('knowledge.searchTest.contentTypes', 'Content types')}</h3>
                        <button
                            onClick={() => setContentTypes(allSelected ? ['qa_pair'] : CONTENT_TYPES.map(ct => ct.value))}
                            className="text-xs font-medium text-gray-500 underline-offset-4 hover:text-gray-900 hover:underline dark:hover:text-white"
                        >
                            {allSelected ? t('knowledge.searchTest.deselectAll', 'Deselect all') : t('knowledge.searchTest.selectAll', 'Select all')}
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {CONTENT_TYPES.map(type => (
                            <button
                                key={type.value}
                                type="button"
                                data-active={contentTypes.includes(type.value)}
                                aria-pressed={contentTypes.includes(type.value)}
                                onClick={() => toggleContentType(type.value)}
                                className="tgo-pill h-8 px-3 text-xs"
                            >
                                {t(`knowledge.searchTest.types.${type.value}`, type.name)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right column: results */}
            <div className="tgo-surface flex min-h-[520px] flex-col overflow-hidden lg:col-span-8">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-light tracking-tight text-gray-900 dark:text-white">
                            {t('knowledge.search.results', 'Search Results')}
                        </h3>
                        <div className="group relative">
                            <HelpCircle className="h-4 w-4 cursor-help text-gray-400" />
                            <div className="invisible absolute left-0 top-6 z-50 w-72 rounded-2xl bg-ink-900 p-4 text-xs text-white opacity-0 shadow-xl transition-all group-hover:visible group-hover:opacity-100">
                                <div className="mb-2 font-semibold">{t('knowledge.searchTest.aboutScore', 'About the Score')}</div>
                                <ul className="space-y-1.5 text-gray-300">
                                    <li><span className="text-acid-400">1.0</span>: {t('knowledge.searchTest.scoreHigh', 'most relevant, ranked first')}</li>
                                    <li><span className="text-amber-300">0.5-1.0</span>: {t('knowledge.searchTest.scoreMid', 'highly relevant')}</li>
                                    <li><span className="text-gray-400">&lt;0.5</span>: {t('knowledge.searchTest.scoreLow', 'moderately relevant')}</li>
                                </ul>
                                <div className="mt-2 border-t border-white/10 pt-2 text-gray-400">
                                    {t('knowledge.searchTest.scoreNote', 'Scores are normalized to the 0-1 range. Hybrid search combines semantic similarity and keyword matching, fused and ranked with the RRF algorithm.')}
                                </div>
                            </div>
                        </div>
                    </div>
                    {searchInfo && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="tgo-chip"><Timer className="h-3 w-3" />{searchInfo.time}ms</span>
                            <span className="tgo-chip">{t('knowledge.searchTest.total', 'Total')} <b className="text-gray-900 dark:text-white">{searchInfo.total}</b> {t('knowledge.searchTest.items', 'items')}</span>
                            <span className="tgo-chip bg-acid-200 text-ink-900 dark:bg-acid-400/20 dark:text-acid-300">{searchInfo.mode}</span>
                        </div>
                    )}
                </div>

                <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="space-y-3">
                            {[0, 1, 2].map(i => (
                                <div key={i} className="tgo-skeleton h-32 rounded-3xl" style={{ opacity: 1 - i * 0.2 }} />
                            ))}
                        </div>
                    ) : results.length === 0 ? (
                        <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
                            <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
                                <span className="absolute inset-0 rounded-full bg-acid-200/60 dark:bg-acid-400/10" />
                                <span className="absolute inset-4 rounded-full bg-acid-300/70 dark:bg-acid-400/20" />
                                <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-acid-400 shadow-lg">
                                    <Search className="h-5 w-5" />
                                </span>
                            </div>
                            <h4 className="mb-1.5 text-lg font-medium tracking-tight text-gray-900 dark:text-gray-100">
                                {hasSearched ? t('knowledge.searchTest.noMatches', 'No matching results found') : t('knowledge.searchTest.ready', 'Ready')}
                            </h4>
                            <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
                                {hasSearched ? t('knowledge.searchTest.tryOtherKeywords', 'Try different keywords or adjust the search mode') : t('knowledge.searchTest.startHint', 'Enter a question on the left to start testing')}
                            </p>
                        </div>
                    ) : (
                        <ol className="tgo-stagger space-y-3">
                            {results.map((result, idx) => {
                                const score = result.relevance_score ?? result.score;
                                const scoreNum = typeof score === 'number' ? score : 0;
                                const tone = scoreTone(scoreNum);
                                const isQA = result.content_type === 'qa_pair';
                                const source = metaString(result.metadata?.filename) || metaString(result.metadata?.source);
                                const semanticRank = result.metadata?.semantic_rank as number | undefined;
                                const keywordRank = result.metadata?.keyword_rank as number | undefined;
                                const rrfScore = result.metadata?.rrf_score as number | string | undefined;
                                return (
                                    <li key={result.id || idx} className="rounded-3xl bg-white p-5 shadow-[inset_0_0_0_1px_var(--color-gray-100)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--color-gray-200),0_12px_28px_-18px_rgb(15_16_18/0.3)] dark:bg-gray-800/60 dark:shadow-[inset_0_0_0_1px_var(--color-gray-800)]">
                                        <div className="mb-3 flex items-start justify-between gap-4">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-acid-400 dark:bg-acid-400 dark:text-ink-900">
                                                    {idx + 1}
                                                </span>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`tgo-chip h-5 px-2 text-[10px] ${isQA ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : ''}`}>
                                                            {isQA ? 'QA' : t('knowledge.searchTest.document', 'Document')}
                                                        </span>
                                                        <span className="truncate text-xs text-gray-400">
                                                            {source || t('knowledge.searchTest.unknownSource', 'Unknown source')}
                                                        </span>
                                                    </div>
                                                    <h4 className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                                        <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                                        {result.document_title || source || t('knowledge.searchTest.untitled', 'Untitled')}
                                                    </h4>
                                                </div>
                                            </div>
                                            <div className="w-24 shrink-0 text-right">
                                                <span className={`font-mono text-sm font-semibold tabular-nums ${tone.text}`}>{scoreNum.toFixed(4)}</span>
                                                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                                                    <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(4, scoreNum * 100))}%` }} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className={`rounded-2xl p-4 text-sm leading-relaxed ${isQA ? 'bg-violet-50/60 text-gray-700 dark:bg-violet-900/10 dark:text-gray-200' : 'bg-gray-50 text-gray-600 dark:bg-gray-900/60 dark:text-gray-300'}`}>
                                            <div className="line-clamp-4 whitespace-pre-wrap">{result.content_preview || result.content}</div>
                                        </div>

                                        {(semanticRank || keywordRank) && (
                                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                                                {semanticRank && <span>{t('knowledge.searchTest.semanticRank', 'Semantic rank')} #{semanticRank}</span>}
                                                {keywordRank && <span>· {t('knowledge.searchTest.keywordRank', 'Keyword rank')} #{keywordRank}</span>}
                                                {rrfScore && <span>· RRF {rrfScore}</span>}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </div>
            </div>
        </div>
    );
};
