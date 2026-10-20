import React, { useState } from 'react';
import { 
  Zap, 
  Bot, 
  Plus, 
  Trash2, 
  Check, 
  Sparkles, 
  ToggleLeft, 
  ToggleRight,
  Search,
  MessageSquare,
  Edit3,
  Save,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Tag,
  SlidersHorizontal,
  CloudCheck
} from 'lucide-react';
import { QuickReplyTemplate, AutoReplyRule } from '../types';

interface QuickRepliesViewProps {
  quickReplies: QuickReplyTemplate[];
  autoReplies: AutoReplyRule[];
  onAddQuickReply: (qr: Omit<QuickReplyTemplate, 'id'>) => Promise<void> | void;
  onEditQuickReply?: (qr: QuickReplyTemplate) => Promise<void> | void;
  onDeleteQuickReply: (id: string) => Promise<void> | void;
  onSyncAllQuickReplies?: () => Promise<boolean> | boolean;
  onAddAutoReply: (rule: Omit<AutoReplyRule, 'id'>) => Promise<void> | void;
  onEditAutoReply?: (rule: AutoReplyRule) => Promise<void> | void;
  onToggleAutoReply: (id: string) => Promise<void> | void;
  onDeleteAutoReply?: (id: string) => Promise<void> | void;
  onSyncAllAutoReplies?: () => Promise<boolean> | boolean;
  isSyncing?: boolean;
  language: 'kh' | 'en';
}

export const QuickRepliesView: React.FC<QuickRepliesViewProps> = ({
  quickReplies,
  autoReplies,
  onAddQuickReply,
  onEditQuickReply,
  onDeleteQuickReply,
  onSyncAllQuickReplies,
  onAddAutoReply,
  onEditAutoReply,
  onToggleAutoReply,
  onDeleteAutoReply,
  onSyncAllAutoReplies,
  isSyncing = false,
  language,
}) => {
  const [activeTab, setActiveTab] = useState<'quick' | 'bot'>('quick');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Quick Reply Modal/State
  const [showAddQr, setShowAddQr] = useState(false);
  const [shortcut, setShortcut] = useState('/');
  const [titleKh, setTitleKh] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<QuickReplyTemplate['category']>('general');
  const [isSubmittingQr, setIsSubmittingQr] = useState(false);

  // Edit Quick Reply Modal/State
  const [editingQr, setEditingQr] = useState<QuickReplyTemplate | null>(null);
  const [editQrShortcut, setEditQrShortcut] = useState('');
  const [editQrTitle, setEditQrTitle] = useState('');
  const [editQrContent, setEditQrContent] = useState('');
  const [editQrCategory, setEditQrCategory] = useState<QuickReplyTemplate['category']>('general');
  const [isSavingQrEdit, setIsSavingQrEdit] = useState(false);

  // New Auto Reply State
  const [showAddBot, setShowAddBot] = useState(false);
  const [botKeywords, setBotKeywords] = useState('');
  const [botReplyKh, setBotReplyKh] = useState('');
  const [isSubmittingBot, setIsSubmittingBot] = useState(false);

  // Edit Auto Reply Modal/State
  const [editingBot, setEditingBot] = useState<AutoReplyRule | null>(null);
  const [editBotKeywords, setEditBotKeywords] = useState('');
  const [editBotReplyKh, setEditBotReplyKh] = useState('');
  const [editBotEnabled, setEditBotEnabled] = useState(true);
  const [isSavingBotEdit, setIsSavingBotEdit] = useState(false);

  // Test Simulator
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<{ matched: boolean; text: string } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleTestBot = () => {
    if (!testInput.trim()) return;
    const input = testInput.toLowerCase();
    const matchedRule = autoReplies.find((rule) => {
      if (!rule.enabled) return false;
      return rule.triggerKeywords.some((k) => input.includes(k.toLowerCase().trim()));
    });

    if (matchedRule) {
      setTestResult({
        matched: true,
        text: `✓ ត្រូវនឹងលក្ខខណ្ឌ Bot: ឆ្លើយតបស្វ័យប្រវត្តិ "${matchedRule.responseKh}"`,
      });
    } else {
      setTestResult({
        matched: false,
        text: 'មិនមានលក្ខខណ្ឌត្រូវគ្នាទេ (នឹងបញ្ជូនទៅកាន់ Gemini AI Auto-Pilot ឬ Admin)',
      });
    }
  };

  // Create Quick Reply
  const handleCreateQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortcut || !titleKh || !content) return;
    setIsSubmittingQr(true);
    try {
      await onAddQuickReply({
        shortcut: shortcut.startsWith('/') ? shortcut : `/${shortcut}`,
        title: titleKh,
        titleKh,
        content,
        category,
      });
      showToast('បានបង្កើតសាររហ័សក្នុង Online រួចរាល់!');
      setShortcut('/');
      setTitleKh('');
      setContent('');
      setShowAddQr(false);
    } catch {
      showToast('ការបង្កើតមិនបានសម្រេច');
    } finally {
      setIsSubmittingQr(false);
    }
  };

  // Open Edit Quick Reply
  const openEditQrModal = (qr: QuickReplyTemplate) => {
    setEditingQr(qr);
    setEditQrShortcut(qr.shortcut);
    setEditQrTitle(qr.titleKh || qr.title);
    setEditQrContent(qr.content);
    setEditQrCategory(qr.category || 'general');
  };

  // Save Edit Quick Reply
  const handleSaveEditQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQr || !onEditQuickReply) return;
    setIsSavingQrEdit(true);
    const updated: QuickReplyTemplate = {
      ...editingQr,
      shortcut: editQrShortcut.startsWith('/') ? editQrShortcut : `/${editQrShortcut}`,
      titleKh: editQrTitle,
      title: editQrTitle,
      content: editQrContent,
      category: editQrCategory,
    };
    try {
      await onEditQuickReply(updated);
      showToast(`បានកែប្រែសារ "${updated.titleKh}" ក្នុង Online រួចរាល់!`);
      setEditingQr(null);
    } catch {
      showToast('ការកែប្រែមិនបានសម្រេច');
    } finally {
      setIsSavingQrEdit(false);
    }
  };

  // Create Bot Rule
  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botKeywords || !botReplyKh) return;
    setIsSubmittingBot(true);
    const keywords = botKeywords.split(',').map((k) => k.trim()).filter(Boolean);
    try {
      await onAddAutoReply({
        enabled: true,
        triggerKeywords: keywords,
        responseKh: botReplyKh,
        matchType: 'contains',
      });
      showToast('បានបង្កើតលក្ខខណ្ឌ Bot ក្នុង Online រួចរាល់!');
      setBotKeywords('');
      setBotReplyKh('');
      setShowAddBot(false);
    } catch {
      showToast('ការបង្កើតមិនបានសម្រេច');
    } finally {
      setIsSubmittingBot(false);
    }
  };

  // Open Edit Bot Rule
  const openEditBotModal = (rule: AutoReplyRule) => {
    setEditingBot(rule);
    setEditBotKeywords(rule.triggerKeywords.join(', '));
    setEditBotReplyKh(rule.responseKh);
    setEditBotEnabled(rule.enabled);
  };

  // Save Edit Bot Rule
  const handleSaveEditBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBot || !onEditAutoReply) return;
    setIsSavingBotEdit(true);
    const keywords = editBotKeywords.split(',').map((k) => k.trim()).filter(Boolean);
    const updated: AutoReplyRule = {
      ...editingBot,
      triggerKeywords: keywords,
      responseKh: editBotReplyKh,
      enabled: editBotEnabled,
    };
    try {
      await onEditAutoReply(updated);
      showToast('បានកែប្រែលក្ខខណ្ឌ Bot ក្នុង Online រួចរាល់!');
      setEditingBot(null);
    } catch {
      showToast('ការកែប្រែមិនបានសម្រេច');
    } finally {
      setIsSavingBotEdit(false);
    }
  };

  // Delete Quick Reply with feedback
  const handleDeleteQr = async (qr: QuickReplyTemplate) => {
    try {
      await onDeleteQuickReply(qr.id);
      showToast(`បានលុបសារ "${qr.titleKh || qr.title}" ពី Online រួចរាល់!`);
    } catch {
      showToast('លុបមិនបានសម្រេច');
    }
  };

  // Delete Bot Rule with feedback
  const handleDeleteBot = async (rule: AutoReplyRule) => {
    try {
      if (onDeleteAutoReply) {
        await onDeleteAutoReply(rule.id);
        showToast('បានលុបលក្ខខណ្ឌ Bot ពី Online រួចរាល់!');
      }
    } catch {
      showToast('លុបមិនបានសម្រេច');
    }
  };

  // Copy quick reply text
  const handleCopyText = (text: string) => {
    navigator.clipboard?.writeText(text);
    showToast('បានចម្លងអត្ថបទរួចរាល់!');
  };

  // Batch sync all online
  const handleSyncOnline = async () => {
    try {
      if (activeTab === 'quick' && onSyncAllQuickReplies) {
        await onSyncAllQuickReplies();
        showToast('បានធ្វើសមកាលកម្មសាររហ័សទៅកាន់ Online Server ១០០%!');
      } else if (activeTab === 'bot' && onSyncAllAutoReplies) {
        await onSyncAllAutoReplies();
        showToast('បានធ្វើសមកាលកម្មលក្ខខណ្ឌ Bot ទៅកាន់ Online Server ១០០%!');
      } else {
        showToast('ទិន្នន័យត្រូវបានរក្សាទុកក្នុង Online Database រួចរាល់!');
      }
    } catch {
      showToast('ការ Sync មិនបានសម្រេច');
    }
  };

  // Filter items by search query
  const filteredQuickReplies = quickReplies.filter((qr) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      qr.shortcut.toLowerCase().includes(q) ||
      (qr.titleKh && qr.titleKh.toLowerCase().includes(q)) ||
      (qr.title && qr.title.toLowerCase().includes(q)) ||
      qr.content.toLowerCase().includes(q)
    );
  });

  const filteredAutoReplies = autoReplies.filter((rule) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const hasKeyword = rule.triggerKeywords.some((k) => k.toLowerCase().includes(q));
    const hasResponse = rule.responseKh.toLowerCase().includes(q);
    return hasKeyword || hasResponse;
  });

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-y-auto relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="p-5 md:p-6 bg-white border-b border-slate-200 shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-5.5 h-5.5 text-amber-500 fill-amber-500/20" />
              <span>
                {language === 'kh' ? 'សាររហ័ស & Bot ឆ្លើយតប (Online Synced)' : 'Quick Replies & Auto Bot'}
              </span>
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Online Synced (រក្សាទុកលើក្លោដ)</span>
            </span>
            {isSyncing && (
              <span className="text-[11px] text-blue-600 flex items-center gap-1 font-medium bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>កំពុង Sync...</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'kh'
              ? 'អាចកែប្រែ និង Save សាររហ័ស (/) និងលក្ខខណ្ឌ Bot ឆ្លើយតបផ្ទាល់លើ Online Database'
              : 'Edit and persistently save quick replies and keyword bot triggers to the online database'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => {
                setActiveTab('quick');
                setSearchQuery('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'quick'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>{language === 'kh' ? 'សាររហ័ស (Quick Replies)' : 'Quick Replies'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
                {quickReplies.length}
              </span>
            </button>
            <button
              onClick={() => {
                setActiveTab('bot');
                setSearchQuery('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'bot'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-blue-600" />
              <span>{language === 'kh' ? 'Bot ឆ្លើយតបអូតូ' : 'Auto Bot'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
                {autoReplies.length}
              </span>
            </button>
          </div>

          {/* Sync Online Button */}
          <button
            onClick={handleSyncOnline}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-2xs hover:border-blue-400 cursor-pointer"
            title="ធ្វើសមកាលកម្មទៅកាន់ Online Server"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sync Online</span>
          </button>

          {/* Add New Button */}
          {activeTab === 'quick' ? (
            <button
              onClick={() => {
                setShortcut('/');
                setTitleKh('');
                setContent('');
                setShowAddQr(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm hover:shadow cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'kh' ? '+ ថែមគំរូសាររហ័ស' : '+ Add Template'}</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setBotKeywords('');
                setBotReplyKh('');
                setShowAddBot(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm hover:shadow cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'kh' ? '+ ថែមលក្ខខណ្ឌ Bot ឆ្លើយតប' : '+ Add Bot Rule'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-5 md:p-6 space-y-6">
        {/* Search Toolbar */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'quick'
                ? (language === 'kh' ? 'ស្វែងរកតាមផ្លូវកាត់ (/aba), ចំណងជើង ឬខ្លឹមសារ...' : 'Search shortcut or message...')
                : (language === 'kh' ? 'ស្វែងរកតាមពាក្យគន្លឹះ (Keywords) ឬសារឆ្លើយតប Bot...' : 'Search trigger keywords...')
            }
            className="w-full pl-9 pr-9 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ========================================================= */}
        {/* TAB 1: QUICK REPLIES (សាររហ័ស) */}
        {/* ========================================================= */}
        {activeTab === 'quick' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {language === 'kh' ? 'គំរូសាររហ័ស (Quick Reply Templates)' : 'Canned Reply Templates'}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === 'kh'
                    ? 'វាយសញ្ញា / នៅក្នុងប្រអប់ជជែក Admin ដើម្បីជ្រើសរើសសារឆ្លើយតបទៅកាន់ Messenger ភ្លាមៗ'
                    : 'Type / in customer chat to quickly insert these canned answers'}
                </p>
              </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredQuickReplies.map((qr) => (
                <div
                  key={qr.id}
                  className="p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                          {qr.shortcut}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">{qr.titleKh || qr.title}</h4>
                      </div>

                      {/* Action buttons (Edit & Delete) */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopyText(qr.content)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="ចម្លងអត្ថបទ (Copy)"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditQrModal(qr)}
                          className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title={language === 'kh' ? 'កែប្រែ (Edit Online)' : 'Edit online'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteQr(qr)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="លុបពី Online"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-100 font-normal">
                      {qr.content}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-300" />
                      <span className="capitalize">{qr.category || 'general'}</span>
                    </span>
                    <button
                      onClick={() => openEditQrModal(qr)}
                      className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>កែប្រែ (Edit Online)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredQuickReplies.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8">
                <Zap className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">មិនមានសាររហ័សទេ</h4>
                <p className="text-xs text-slate-400 mt-1">សូមចុច "+ ថែមគំរូសាររហ័ស" ដើម្បីបង្កើតសារថ្មី</p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: AUTO BOT (BOT ឆ្លើយតប) */}
        {/* ========================================================= */}
        {activeTab === 'bot' && (
          <div className="space-y-6">
            {/* Top Info & Simulator */}
            <div className="p-5 bg-linear-to-r from-blue-50/90 to-indigo-50/90 border border-blue-200 rounded-2xl space-y-3.5 shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-blue-950 flex items-center gap-2">
                    <span>{language === 'kh' ? 'សាកល្បងដំណើរការ Bot ឆ្លើយតប (Bot Simulator)' : 'Test Bot Simulation'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      ឆ្លើយតបអូតូ ២៤/៧
                    </span>
                  </h4>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    {language === 'kh'
                      ? 'វាយសាកល្បងសាររបស់អតិថិជន (ឧទាហរណ៍៖ "តម្លៃប៉ុន្មាន?", "ដឹកជញ្ជូនថ្លៃប៉ុន្មាន?", "សុំកុង ABA") ដើម្បីមើលការឆ្លើយតបអូតូ'
                      : 'Test customer messages to simulate auto keyword match'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTestBot()}
                  placeholder={language === 'kh' ? 'វាយសារសាកល្បង (ឧ. តម្លៃ, ដឹក, aba)...' : 'Type test prompt...'}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  onClick={handleTestBot}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{language === 'kh' ? 'តេស្ត Bot' : 'Test'}</span>
                </button>
              </div>

              {testResult && (
                <div className={`p-3 rounded-xl border text-xs font-medium leading-relaxed ${
                  testResult.matched 
                    ? 'bg-white border-blue-200 text-blue-900 shadow-2xs' 
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  {testResult.text}
                </div>
              )}
            </div>

            {/* Auto reply rules list */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {language === 'kh' ? 'លក្ខខណ្ឌពាក្យគន្លឹះឆ្លើយតប (Keyword Rules)' : 'Keyword Trigger Rules'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'kh' 
                      ? 'នៅពេលអតិថិជនផ្ញើសារតាម Messenger ដែលមានពាក្យគន្លឹះទាំងនេះ Bot នឹងឆ្លើយតបភ្លាមៗ'
                      : 'Auto responds when customer message contains matched keywords'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {filteredAutoReplies.map((rule) => (
                  <div
                    key={rule.id}
                    className={`p-4 bg-white border rounded-2xl transition-all flex flex-col md:flex-row md:items-start justify-between gap-4 group ${
                      rule.enabled ? 'border-slate-200 hover:border-slate-300 hover:shadow-md' : 'border-slate-200/60 opacity-60 bg-slate-50/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-700">
                          {language === 'kh' ? 'ពាក្យគន្លឹះ (Keywords): ' : 'Keywords:'}
                        </span>
                        {rule.triggerKeywords.map((kw, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 shadow-2xs"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-800 leading-relaxed font-normal">
                        🤖 <span className="font-semibold text-blue-900">ការឆ្លើយតប:</span> {rule.responseKh}
                      </div>
                    </div>

                    <div className="flex items-center md:flex-col items-end gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      {/* Active toggle button */}
                      <button
                        onClick={() => onToggleAutoReply(rule.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                        title={rule.enabled ? 'ចុចដើម្បីបិទ' : 'ចុចដើម្បីបើក'}
                      >
                        {rule.enabled ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                            <ToggleRight className="w-5 h-5 text-emerald-500" />
                            <span>{language === 'kh' ? 'កំពុងបើក' : 'Active'}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                            <ToggleLeft className="w-5 h-5 text-slate-400" />
                            <span>{language === 'kh' ? 'បានបិទ' : 'Disabled'}</span>
                          </div>
                        )}
                      </button>

                      {/* Action buttons (Edit & Delete) */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditBotModal(rule)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          title="កែប្រែលក្ខខណ្ឌ Bot (Edit Online)"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>កែប្រែ</span>
                        </button>
                        <button
                          onClick={() => handleDeleteBot(rule)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="លុប"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredAutoReplies.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8">
                  <Bot className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-700">មិនមានលក្ខខណ្ឌ Bot ទេ</h4>
                  <p className="text-xs text-slate-400 mt-1">សូមចុច "+ ថែមលក្ខខណ្ឌ Bot ឆ្លើយតប" ដើម្បីបង្កើត</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: ADD NEW QUICK REPLY */}
      {/* ========================================================= */}
      {showAddQr && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Zap className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {language === 'kh' ? 'បន្ថែមគំរូសាររហ័សថ្មី (Save Online)' : 'Create New Quick Reply'}
                  </h3>
                  <p className="text-[11px] text-slate-500">រក្សាទុកក្នុង Online Database សម្រាប់ក្រុមការងារទាំងអស់</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddQr(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQr} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {language === 'kh' ? 'ផ្លូវកាត់ (Shortcut ឧ. /aba) *' : 'Shortcut (e.g. /aba) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={shortcut}
                    onChange={(e) => setShortcut(e.target.value)}
                    placeholder="/shortcut"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {language === 'kh' ? 'ចំណងជើងសារ *' : 'Template Title *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={titleKh}
                    onChange={(e) => setTitleKh(e.target.value)}
                    placeholder="ឧ. គណនី ABA & KHQR..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ប្រភេទ (Category)
                </label>
                <select
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="general">General (ទូទៅ)</option>
                  <option value="payment">Payment (ទូទាត់ប្រាក់ ABA / KHQR)</option>
                  <option value="delivery">Delivery (សេវាដឹកជញ្ជូន)</option>
                  <option value="greeting">Greeting & Thanks (ស្វាគមន៍ & អរគុណ)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {language === 'kh' ? 'ខ្លឹមសារសារពេញលេញ *' : 'Full Message Content *'}
                </label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="វាយអត្ថបទសារឆ្លើយតប..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddQr(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQr}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingQr ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>កំពុងរក្សាទុក...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>រក្សាទុក Online</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: EDIT EXISTING QUICK REPLY (SAVE ONLINE) */}
      {/* ========================================================= */}
      {editingQr && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Edit3 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>{language === 'kh' ? 'កែប្រែសាររហ័ស (Edit & Save Online)' : 'Edit Quick Reply Online'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Cloud DB
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">កែប្រែរួចនឹងរក្សាទុកក្នុង Online Database ភ្លាមៗ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingQr(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditQr} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {language === 'kh' ? 'ផ្លូវកាត់ (Shortcut) *' : 'Shortcut *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editQrShortcut}
                    onChange={(e) => setEditQrShortcut(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {language === 'kh' ? 'ចំណងជើងសារ *' : 'Template Title *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editQrTitle}
                    onChange={(e) => setEditQrTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ប្រភេទ (Category)
                </label>
                <select
                  value={editQrCategory}
                  onChange={(e: any) => setEditQrCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="general">General (ទូទៅ)</option>
                  <option value="payment">Payment (ទូទាត់ប្រាក់ ABA / KHQR)</option>
                  <option value="delivery">Delivery (សេវាដឹកជញ្ជូន)</option>
                  <option value="greeting">Greeting & Thanks (ស្វាគមន៍ & អរគុណ)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {language === 'kh' ? 'ខ្លឹមសារសារពេញលេញ *' : 'Full Message Content *'}
                </label>
                <textarea
                  required
                  rows={4}
                  value={editQrContent}
                  onChange={(e) => setEditQrContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed font-normal"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const target = editingQr;
                    setEditingQr(null);
                    handleDeleteQr(target);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>លុបសារ</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingQr(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    បោះបង់
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingQrEdit}
                    className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingQrEdit ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>កំពុងរក្សាទុក Online...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>រក្សាទុក Online</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: ADD NEW BOT RULE */}
      {/* ========================================================= */}
      {showAddBot && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Bot className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {language === 'kh' ? 'បន្ថែមលក្ខខណ្ឌ Bot ឆ្លើយតបថ្មី (Save Online)' : 'Add New Bot Rule'}
                  </h3>
                  <p className="text-[11px] text-slate-500">ឆ្លើយតបស្វ័យប្រវត្តិកាលណាអតិថិជនសួរត្រូវពាក្យគន្លឹះ ២៤/៧</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBot(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBot} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {language === 'kh' ? 'ពាក្យគន្លឹះ (Keywords បំបែកដោយសញ្ញាក្បៀស ,) *' : 'Keywords (comma-separated) *'}
                </label>
                <input
                  type="text"
                  required
                  value={botKeywords}
                  onChange={(e) => setBotKeywords(e.target.value)}
                  placeholder="ឧ. តម្លៃ, ថ្លៃ, price, how much"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  នៅពេលសារអតិថិជនមានពាក្យគន្លឹះណាមួយក្នុងចំណោមនេះ Bot នឹងឆ្លើយតបអូតូ
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {language === 'kh' ? 'សារឆ្លើយតបអូតូ *' : 'Auto Response Message *'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={botReplyKh}
                  onChange={(e) => setBotReplyKh(e.target.value)}
                  placeholder="វាយសារដែល Bot ត្រូវឆ្លើយតប..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 leading-relaxed font-normal"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddBot(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBot}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingBot ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>កំពុងរក្សាទុក...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>រក្សាទុក Online</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: EDIT EXISTING BOT RULE (SAVE ONLINE) */}
      {/* ========================================================= */}
      {editingBot && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Edit3 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>{language === 'kh' ? 'កែប្រែលក្ខខណ្ឌ Bot (Edit & Save Online)' : 'Edit Bot Rule Online'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Cloud DB
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">កែប្រែរួចនឹងរក្សាទុកក្នុង Online Database ភ្លាមៗ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingBot(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBot} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {language === 'kh' ? 'ពាក្យគន្លឹះ (Keywords បំបែកដោយសញ្ញាក្បៀស ,) *' : 'Keywords (comma-separated) *'}
                </label>
                <input
                  type="text"
                  required
                  value={editBotKeywords}
                  onChange={(e) => setEditBotKeywords(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {language === 'kh' ? 'សារឆ្លើយតបអូតូ *' : 'Auto Response Message *'}
                </label>
                <textarea
                  required
                  rows={4}
                  value={editBotReplyKh}
                  onChange={(e) => setEditBotReplyKh(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 leading-relaxed font-normal"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="botEnabled"
                  checked={editBotEnabled}
                  onChange={(e) => setEditBotEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                />
                <label htmlFor="botEnabled" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  {language === 'kh' ? 'បើកដំណើរការលក្ខខណ្ឌនេះ (Active)' : 'Enable this bot rule'}
                </label>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const target = editingBot;
                    setEditingBot(null);
                    handleDeleteBot(target);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>លុប</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingBot(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    បោះបង់
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingBotEdit}
                    className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingBotEdit ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>កំពុងរក្សាទុក Online...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>រក្សាទុក Online</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
