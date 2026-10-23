import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  MessageCircle, 
  CheckCheck, 
  Menu,
  RefreshCw,
  Archive,
  ArchiveRestore,
  Trash2,
  X
} from 'lucide-react';
import { ChatThread, ThreadStatus, PlatformType, PageAccount } from '../types';

interface ConversationListProps {
  threads: ChatThread[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  language: 'kh' | 'en';
  onSimulateCustomerChat: () => void;
  onSyncPageMessages?: () => void;
  selectedPage?: PageAccount;
  pages?: PageAccount[];
  onOpenMobileMenu?: () => void;
  onOpenLiveOnlineModal?: () => void;
  onBulkMarkAsRead?: (threadIds: string[]) => void;
  onBulkArchive?: (threadIds: string[], archive?: boolean) => void;
  onBulkDelete?: (threadIds: string[]) => void;
  onDeleteAllThreads?: () => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  threads,
  selectedThreadId,
  onSelectThread,
  language,
  onSimulateCustomerChat,
  onSyncPageMessages,
  selectedPage,
  pages = [],
  onOpenMobileMenu,
  onOpenLiveOnlineModal,
  onBulkMarkAsRead,
  onBulkArchive,
  onBulkDelete,
  onDeleteAllThreads,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ThreadStatus>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformType | 'all'>('all');
  const [pageScope, setPageScope] = useState<'current' | 'all'>('all');
  const [isSyncingPage, setIsSyncingPage] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);

  const handleSyncClick = () => {
    setIsSyncingPage(true);
    if (onSyncPageMessages) {
      onSyncPageMessages();
    } else {
      onSimulateCustomerChat();
    }
    setTimeout(() => setIsSyncingPage(false), 600);
  };

  const statusTabs: { id: ThreadStatus; labelKh: string; labelEn: string }[] = [
    { id: 'all', labelKh: 'ទាំងអស់', labelEn: 'All' },
    { id: 'unread', labelKh: 'មិនទាន់អាន', labelEn: 'Unread' },
    { id: 'needs_reply', labelKh: 'រង់ចាំឆ្លើយ', labelEn: 'Pending' },
    { id: 'ordered', labelKh: 'បានកុម្ម៉ង់', labelEn: 'Ordered' },
    { id: 'completed', labelKh: 'រួចរាល់', labelEn: 'Done' },
    { id: 'archived', labelKh: 'បណ្ណសារ', labelEn: 'Archived' },
  ];

  const isThreadArchived = (thread: ChatThread) =>
    Boolean(thread.archived || thread.status === 'archived');

  const tabCounts = useMemo(() => {
    const scoped = threads.filter((t) =>
      pageScope === 'current' && selectedPage ? t.pageId === selectedPage.id : true
    );
    const activeThreads = scoped.filter((t) => !isThreadArchived(t));
    const archivedThreads = scoped.filter((t) => isThreadArchived(t));

    return {
      all: activeThreads.length,
      unread: activeThreads.filter((t) => t.unreadCount > 0).length,
      needs_reply: activeThreads.filter((t) => t.status === 'needs_reply').length,
      ordered: activeThreads.filter((t) => t.status === 'ordered').length,
      completed: activeThreads.filter((t) => t.status === 'completed').length,
      archived: archivedThreads.length,
    };
  }, [threads, pageScope, selectedPage]);

  const filteredThreads = useMemo(() => {
    const matching = threads.filter((thread) => {
      // Page scope filter
      if (pageScope === 'current' && selectedPage && thread.pageId !== selectedPage.id) {
        return false;
      }

      const archived = isThreadArchived(thread);
      if (statusFilter === 'archived') {
        if (!archived) return false;
      } else {
        // Hide archived threads from standard inbox tabs
        if (archived) return false;
        if (statusFilter === 'unread' && thread.unreadCount === 0) return false;
        if (statusFilter === 'needs_reply' && thread.status !== 'needs_reply') return false;
        if (statusFilter === 'ordered' && thread.status !== 'ordered') return false;
        if (statusFilter === 'completed' && thread.status !== 'completed') return false;
        if (statusFilter === 'vip' && !thread.customer.tags.includes('VIP')) return false;
      }

      // Platform filter
      if (platformFilter !== 'all' && thread.customer.platform !== platformFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = thread.customer.name.toLowerCase().includes(q);
        const matchPhone = thread.customer.phone.includes(q);
        const matchTag = thread.customer.tags.some((t) => t.toLowerCase().includes(q));
        const matchMsg = thread.lastMessage.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchTag && !matchMsg) return false;
      }

      return true;
    });

    // Prioritize threads belonging to the currently selected page so newly connected pages appear at the top
    if (selectedPage) {
      return [...matching].sort((a, b) => {
        const aIsCurrent = a.pageId === selectedPage.id ? 1 : 0;
        const bIsCurrent = b.pageId === selectedPage.id ? 1 : 0;
        return bIsCurrent - aIsCurrent;
      });
    }
    return matching;
  }, [threads, statusFilter, platformFilter, searchQuery, pageScope, selectedPage]);

  // Keep selectedThreadIds pruned to existing threads
  useEffect(() => {
    const validIds = new Set(threads.map((t) => t.id));
    setSelectedThreadIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [threads]);

  const visibleThreadIds = useMemo(() => filteredThreads.map((t) => t.id), [filteredThreads]);
  const allVisibleSelected =
    visibleThreadIds.length > 0 &&
    visibleThreadIds.every((id) => selectedThreadIds.includes(id));
  const someVisibleSelected =
    visibleThreadIds.some((id) => selectedThreadIds.includes(id)) && !allVisibleSelected;

  const toggleSelectThread = (threadId: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    setSelectedThreadIds((prev) =>
      prev.includes(threadId) ? prev.filter((id) => id !== threadId) : [...prev, threadId]
    );
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(visibleThreadIds);
      setSelectedThreadIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedThreadIds((prev) => Array.from(new Set([...prev, ...visibleThreadIds])));
    }
  };

  const showTemporaryFeedback = (msg: string) => {
    setBulkFeedback(msg);
    setTimeout(() => {
      setBulkFeedback((current) => (current === msg ? null : current));
    }, 2800);
  };

  const handleBulkMarkReadClick = () => {
    if (selectedThreadIds.length === 0) return;
    const count = selectedThreadIds.length;
    if (onBulkMarkAsRead) {
      onBulkMarkAsRead(selectedThreadIds);
    }
    setSelectedThreadIds([]);
    showTemporaryFeedback(
      language === 'kh'
        ? `បានដាក់សម្គាល់ថាអានរួចចំនួន ${count} ការជជែក`
        : `Marked ${count} thread${count > 1 ? 's' : ''} as read`
    );
  };

  const handleBulkArchiveClick = () => {
    if (selectedThreadIds.length === 0) return;
    const count = selectedThreadIds.length;
    const shouldArchive = statusFilter !== 'archived';
    if (onBulkArchive) {
      onBulkArchive(selectedThreadIds, shouldArchive);
    }
    setSelectedThreadIds([]);
    showTemporaryFeedback(
      shouldArchive
        ? language === 'kh'
          ? `បានទុកក្នុងបណ្ណសារចំនួន ${count} ការជជែក`
          : `Archived ${count} thread${count > 1 ? 's' : ''}`
        : language === 'kh'
        ? `បានស្ដារចេញពីបណ្ណសារចំនួន ${count} ការជជែក`
        : `Unarchived ${count} thread${count > 1 ? 's' : ''}`
    );
  };

  const handleBulkDeleteClick = () => {
    if (selectedThreadIds.length === 0) return;
    const count = selectedThreadIds.length;
    if (onBulkDelete) {
      onBulkDelete(selectedThreadIds);
    }
    setSelectedThreadIds([]);
    showTemporaryFeedback(
      language === 'kh'
        ? `បានលុបសារចំនួន ${count} ចេញពីប្រអប់សារ`
        : `Deleted ${count} thread${count > 1 ? 's' : ''}`
    );
  };

  const handleDeleteAllClick = () => {
    if (threads.length === 0) return;
    if (onDeleteAllThreads) {
      onDeleteAllThreads();
    }
    setSelectedThreadIds([]);
    showTemporaryFeedback(
      language === 'kh'
        ? 'បានលុបសារទាំងអស់ក្នុងគ្រប់ទំព័ររួចរាល់'
        : 'Deleted all messages across all pages'
    );
  };

  const getPlatformBadge = (platform: PlatformType) => {
    switch (platform) {
      case 'messenger':
        return <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold" title="Facebook Messenger">f</span>;
      case 'telegram':
        return <span className="w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px] font-bold" title="Telegram">✈</span>;
      case 'tiktok':
        return <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-bold" title="TikTok Shop">🎵</span>;
      default:
        return <span className="w-4 h-4 rounded-full bg-pink-500 text-white flex items-center justify-center text-[10px] font-bold">ig</span>;
    }
  };

  return (
    <div className="w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 h-full">
      {/* Header & Search */}
      <div className="p-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {onOpenMobileMenu && (
              <button
                onClick={onOpenMobileMenu}
                className="p-1 -ml-1 rounded-lg text-slate-700 hover:bg-slate-100 md:hidden"
                aria-label="Open menu"
                title="បើកមឺនុយ"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-base font-semibold text-slate-800">
              {language === 'kh' ? 'សារអតិថិជន' : 'Chat Inbox'}
            </h2>
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium tabular-nums">
              {filteredThreads.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Live Online Modal Trigger Button */}
            {onOpenLiveOnlineModal && (
              <button
                type="button"
                onClick={onOpenLiveOnlineModal}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-md border transition-all cursor-pointer ${
                  (selectedPage?.isLiveOnline || selectedPage?.accessToken)
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                }`}
                title={language === 'kh' ? 'ស្ថានភាព Live Online លើ Messenger' : 'Open Live Online on Messenger settings'}
              >
                <span className={`w-2 h-2 rounded-full ${(selectedPage?.isLiveOnline || selectedPage?.accessToken) ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className="hidden sm:inline">Live</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSyncClick}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors shadow-2xs cursor-pointer"
              title={language === 'kh' ? 'ទាញយកសារថ្មីពីផេក (Sync Page Messages)' : 'Sync messages from page'}
            >
              <RefreshCw className={`w-3 h-3 ${isSyncingPage ? 'animate-spin' : ''}`} />
              <span>{language === 'kh' ? 'ទាញសារផេក' : 'Sync'}</span>
            </button>

            <button
              type="button"
              onClick={() => onSimulateCustomerChat()}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-md transition-colors shadow-2xs cursor-pointer"
              title={language === 'kh' ? 'សាកល្បងទទួលសារ Messenger Live ថ្មី' : 'Simulate incoming customer message on Messenger Live'}
            >
              <span>+ សារថ្មី</span>
            </button>

            {threads.length > 0 && onDeleteAllThreads && (
              <button
                type="button"
                onClick={handleDeleteAllClick}
                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors shadow-2xs cursor-pointer"
                title={language === 'kh' ? 'លុបសារទាំងអស់ក្នុងគ្រប់ទំព័រ' : 'Delete all messages in all pages'}
              >
                <Trash2 className="w-3 h-3" />
                <span>{language === 'kh' ? 'លុបទាំងអស់' : 'Clear All'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Page Scope Switcher (Current Page vs All Pages) */}
        {selectedPage && (
          <div className="flex items-center gap-1 mb-2.5 bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
            <button
              onClick={() => setPageScope('all')}
              className={`flex-1 py-1 px-2 rounded-md transition-all text-center truncate cursor-pointer ${
                pageScope === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              {language === 'kh' ? 'គ្រប់ទំព័រ' : 'All Pages'}
            </button>
            <button
              onClick={() => setPageScope('current')}
              className={`flex-1 py-1 px-2 rounded-md transition-all text-center truncate flex items-center justify-center gap-1.5 cursor-pointer ${
                pageScope === 'current'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
              title={`${selectedPage.name} (Messenger Live Online)`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span className="truncate">{selectedPage.name.split(' - ')[0] || selectedPage.name}</span>
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'kh' ? 'ស្វែងរកឈ្មោះ ឬលេខទូរស័ព្ទ...' : 'Search customer or phone...'}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
          {statusTabs.map((tab) => {
            const isActive = statusFilter === tab.id;
            const count = (tabCounts as any)[tab.id] || 0;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors font-medium cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{language === 'kh' ? tab.labelKh : tab.labelEn}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : tab.id === 'needs_reply'
                        ? 'bg-rose-100 text-rose-700'
                        : tab.id === 'unread'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk Selection & Action Bar */}
      {filteredThreads.length > 0 && (
        <div
          className={`px-3 py-2 border-b transition-colors flex items-center justify-between gap-2 ${
            selectedThreadIds.length > 0
              ? 'bg-blue-50/90 border-blue-200'
              : 'bg-slate-50/70 border-slate-200/80'
          }`}
        >
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              ref={(el) => {
                if (el) el.indeterminate = someVisibleSelected;
              }}
              onChange={toggleSelectAllVisible}
              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
            />
            <span>
              {selectedThreadIds.length > 0
                ? language === 'kh'
                  ? `បានជ្រើសរើស ${selectedThreadIds.length}`
                  : `${selectedThreadIds.length} selected`
                : language === 'kh'
                ? 'ជ្រើសរើសទាំងអស់'
                : 'Select all'}
            </span>
          </label>

          {selectedThreadIds.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleBulkMarkReadClick}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-700 bg-white hover:bg-blue-100 border border-blue-200 rounded-md shadow-2xs transition-colors cursor-pointer"
                title={language === 'kh' ? 'ដាក់សម្គាល់ថាអានរួច' : 'Mark selected as read'}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{language === 'kh' ? 'អានរួច' : 'Mark Read'}</span>
              </button>

              <button
                type="button"
                onClick={handleBulkArchiveClick}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md shadow-2xs transition-colors cursor-pointer"
                title={
                  statusFilter === 'archived'
                    ? language === 'kh'
                      ? 'ស្ដារចេញពីបណ្ណសារ'
                      : 'Unarchive selected'
                    : language === 'kh'
                    ? 'ទុកក្នុងបណ្ណសារ'
                    : 'Archive selected'
                }
              >
                {statusFilter === 'archived' ? (
                  <>
                    <ArchiveRestore className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{language === 'kh' ? 'ស្ដារវិញ' : 'Unarchive'}</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-3.5 h-3.5 text-amber-600" />
                    <span>{language === 'kh' ? 'ទុកបណ្ណសារ' : 'Archive'}</span>
                  </>
                )}
              </button>

              {onBulkDelete && (
                <button
                  type="button"
                  onClick={handleBulkDeleteClick}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-md shadow-2xs transition-colors cursor-pointer"
                  title={language === 'kh' ? 'លុបសារដែលបានជ្រើសរើស' : 'Delete selected'}
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>{language === 'kh' ? 'លុប' : 'Delete'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedThreadIds([])}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-white rounded-md transition-colors cursor-pointer"
                title={language === 'kh' ? 'បោះបង់ការជ្រើសរើស' : 'Clear selection'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            bulkFeedback && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md truncate">
                {bulkFeedback}
              </span>
            )
          )}
        </div>
      )}

      {/* Conversation Item List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {filteredThreads.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <MessageCircle className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
            <p className="text-sm font-medium text-slate-600">
              {statusFilter === 'archived'
                ? language === 'kh'
                  ? 'មិនមានការជជែកក្នុងបណ្ណសារទេ'
                  : 'No archived conversations'
                : language === 'kh'
                ? 'មិនមានសារជជែកក្នុងតម្រងនេះទេ'
                : 'No conversations found'}
            </p>
            {statusFilter !== 'archived' && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setSearchQuery('');
                  onSimulateCustomerChat();
                }}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <span>+ {language === 'kh' ? 'ទទួលសារ Messenger Live ថ្មី' : 'New Messenger Live Chat'}</span>
              </button>
            )}
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const isSelected = thread.id === selectedThreadId;
            const isChecked = selectedThreadIds.includes(thread.id);
            const archived = isThreadArchived(thread);
            return (
              <div
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={`p-3 cursor-pointer transition-colors relative flex items-start gap-2.5 ${
                  isChecked
                    ? 'bg-blue-50/90 border-l-3 border-blue-600'
                    : isSelected
                    ? 'bg-blue-50/60 border-l-3 border-blue-600'
                    : 'hover:bg-slate-50'
                }`}
              >
                {/* Bulk Action Checkbox */}
                <div
                  onClick={(e) => toggleSelectThread(thread.id, e)}
                  className="pt-2.5 shrink-0 flex items-center justify-center"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => toggleSelectThread(thread.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select conversation with ${thread.customer.name}`}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Customer Avatar & Platform badge */}
                <div className="relative shrink-0">
                  <img
                    src={thread.customer.avatarUrl}
                    alt={thread.customer.name}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full object-cover border border-slate-200"
                  />
                  <div className="absolute -bottom-1 -right-1">
                    {getPlatformBadge(thread.customer.platform)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className={`text-sm truncate ${thread.unreadCount > 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>
                      {thread.customer.name}
                    </h3>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap ml-2 tabular-nums">
                      {thread.lastMessageTime}
                    </span>
                  </div>

                  {/* Customer Province / Tag metadata */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1 flex-wrap">
                    <span>{thread.customer.province}</span>
                    {thread.customer.tags.length > 0 && (
                      <>
                        <span aria-hidden="true">•</span>
                        <span className="truncate text-blue-600">{thread.customer.tags[0]}</span>
                      </>
                    )}
                    {pageScope === 'all' && (
                      <>
                        <span aria-hidden="true">•</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium truncate max-w-[110px]" title={pages.find(p => p.id === thread.pageId)?.name || thread.pageId}>
                          {pages.find(p => p.id === thread.pageId)?.name.split(' - ')[0] || 'Page'}
                        </span>
                      </>
                    )}
                    {archived && (
                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                        {language === 'kh' ? 'បណ្ណសារ' : 'Archived'}
                      </span>
                    )}
                  </div>

                  {/* Last message preview */}
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs truncate ${thread.unreadCount > 0 ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                      {thread.lastMessage}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {thread.unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center tabular-nums">
                          {thread.unreadCount}
                        </span>
                      )}
                      {onBulkDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onBulkDelete([thread.id]);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title={language === 'kh' ? 'លុបការជជែកនេះ' : 'Delete conversation'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
