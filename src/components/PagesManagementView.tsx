import React, { useState, useRef } from 'react';
import { 
  Store, 
  PlusCircle, 
  Radio, 
  Check, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  MessageSquare, 
  ShoppingBag, 
  Users, 
  ShieldCheck, 
  AlertCircle,
  Copy,
  CheckCheck,
  Sparkles,
  HelpCircle,
  Layers,
  ArrowRight,
  QrCode,
  Upload,
  RotateCcw,
  Save
} from 'lucide-react';
import { PageAccount, PlatformType, ChatThread, Order } from '../types';
import { useKhqrConfig, DEFAULT_KHQR_IMAGE, FALLBACK_KHQR_IMAGE } from '../utils/khqrSettings';

interface PagesManagementViewProps {
  pages: PageAccount[];
  selectedPage: PageAccount;
  threads: ChatThread[];
  orders: Order[];
  onSelectPage: (page: PageAccount) => void;
  onOpenConnectModal: () => void;
  onEditPage: (page: PageAccount) => void;
  onDeletePage: (pageId: string) => void;
  onSimulatePageChat: (pageId: string) => void;
  language: 'kh' | 'en';
}

export const PagesManagementView: React.FC<PagesManagementViewProps> = ({
  pages,
  selectedPage,
  threads,
  orders,
  onSelectPage,
  onOpenConnectModal,
  onEditPage,
  onDeletePage,
  onSimulatePageChat,
  language,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | PlatformType>('all');
  const [guideTab, setGuideTab] = useState<'meta' | 'telegram' | 'tiktok' | 'instagram'>('meta');
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

  // KHQR payment configuration
  const { config: khqrConfig, updateKhqr, resetKhqr } = useKhqrConfig();
  const khqrPageFileInputRef = useRef<HTMLInputElement>(null);
  const [pageKhqrUploadSuccess, setPageKhqrUploadSuccess] = useState(false);
  const [isEditingBankDetails, setIsEditingBankDetails] = useState(false);
  const [editMerchant, setEditMerchant] = useState(khqrConfig.merchantName);
  const [editAccount, setEditAccount] = useState(khqrConfig.accountNumber);

  const handlePageKhqrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        updateKhqr({ qrImage: base64 });
        setPageKhqrUploadSuccess(true);
        setTimeout(() => setPageKhqrUploadSuccess(false), 3000);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveBankDetails = () => {
    updateKhqr({
      merchantName: editMerchant.trim() || 'Sok Chea CHHAI',
      accountNumber: editAccount.trim() || '005 452 334',
    });
    setIsEditingBankDetails(false);
    setPageKhqrUploadSuccess(true);
    setTimeout(() => setPageKhqrUploadSuccess(false), 2500);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://api.pagechatpro.kh';
  const webhookUrl = `${origin}/api/webhook/meta`;
  const verifyToken = 'pagechat_kh_secret';

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(verifyToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleTestWebhookHandshake = async () => {
    setTestStatus('testing');
    try {
      const challengeTest = 'meta_test_challenge_9988';
      const res = await fetch(`/api/webhook/meta?hub.mode=subscribe&hub.challenge=${challengeTest}&hub.verify_token=${verifyToken}`);
      const text = await res.text();
      if (res.ok && text.trim() === challengeTest) {
        setTestStatus('success');
      } else {
        setTestStatus('failed');
      }
    } catch (e) {
      setTestStatus('failed');
    }
  };

  const filteredPages = pages.filter((p) => {
    if (activeTab === 'all') return true;
    return p.platform === activeTab;
  });

  const getPlatformIcon = (platform: PlatformType) => {
    switch (platform) {
      case 'messenger':
        return <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">f</span>;
      case 'telegram':
        return <span className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-bold">✈</span>;
      case 'tiktok':
        return <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">🎵</span>;
      case 'instagram':
        return <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-rose-600 text-white flex items-center justify-center text-xs font-bold">ig</span>;
    }
  };

  const getPlatformLabel = (platform: PlatformType) => {
    switch (platform) {
      case 'messenger':
        return 'Facebook Page';
      case 'telegram':
        return 'Telegram Bot';
      case 'tiktok':
        return 'TikTok Shop';
      case 'instagram':
        return 'Instagram';
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-y-auto">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 sticky top-0 z-10 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Store className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-800">
                {language === 'kh' ? 'គ្រប់គ្រងទំព័រ & ឆានែលទាំងអស់' : 'Page & Channel Management'}
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {language === 'kh'
                ? 'ភ្ជាប់ និងគ្រប់គ្រង Facebook Pages, Telegram, TikTok និង Instagram ក្នុងផ្ទាំងតែមួយ'
                : 'Connect and manage multiple Facebook Pages, Telegram Bots, TikTok & Instagram in one place'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenConnectModal}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{language === 'kh' ? '+ ភ្ជាប់ទំព័រថ្មី' : '+ Connect New Page'}</span>
            </button>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              {language === 'kh' ? 'ទំព័រដែលបានភ្ជាប់' : 'Connected Pages'}
            </span>
            <div className="text-xl font-bold text-slate-800 mt-0.5 flex items-center gap-2">
              <span>{pages.length}</span>
              <span className="text-xs font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                {language === 'kh' ? 'កំពុងដំណើរការ' : 'Active'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              {language === 'kh' ? 'ការសន្ទនាសរុប' : 'Total Chat Threads'}
            </span>
            <div className="text-xl font-bold text-blue-600 mt-0.5 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              <span>{threads.length}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              {language === 'kh' ? 'ការកុម្ម៉ង់សរុប' : 'Total Orders'}
            </span>
            <div className="text-xl font-bold text-indigo-600 mt-0.5 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4" />
              <span>{orders.length}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              {language === 'kh' ? 'ទំព័រកំពុងជ្រើសរើស' : 'Active Working Page'}
            </span>
            <div className="text-sm font-bold text-slate-800 mt-1 truncate">
              {selectedPage.name}
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mt-5 border-t border-slate-100 pt-3">
          {[
            { id: 'all', labelKh: 'ទាំងអស់', labelEn: 'All', count: pages.length },
            { id: 'messenger', labelKh: 'Facebook Pages', labelEn: 'Facebook', count: pages.filter(p => p.platform === 'messenger').length },
            { id: 'telegram', labelKh: 'Telegram', labelEn: 'Telegram', count: pages.filter(p => p.platform === 'telegram').length },
            { id: 'tiktok', labelKh: 'TikTok Shop', labelEn: 'TikTok', count: pages.filter(p => p.platform === 'tiktok').length },
            { id: 'instagram', labelKh: 'Instagram', labelEn: 'Instagram', count: pages.filter(p => p.platform === 'instagram').length },
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{language === 'kh' ? tab.labelKh : tab.labelEn}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pages Cards Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredPages.map((page) => {
            const isCurrent = page.id === selectedPage.id;
            const pageThreads = threads.filter((t) => t.pageId === page.id);
            const pageOrders = orders.filter((o) => o.pageId === page.id);

            return (
              <div
                key={page.id}
                className={`bg-white rounded-2xl border transition-all flex flex-col overflow-hidden relative shadow-xs hover:shadow-md ${
                  isCurrent 
                    ? 'border-blue-500 ring-2 ring-blue-500/20' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Top Status Bar */}
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {getPlatformIcon(page.platform)}
                    <span className="text-xs font-semibold text-slate-700">
                      {getPlatformLabel(page.platform)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[11px] font-medium text-emerald-700">
                      {language === 'kh' ? 'Webhook សកម្ម' : 'Webhook Active'}
                    </span>
                  </div>
                </div>

                {/* Main Body */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start gap-3.5 mb-4">
                    <div className="relative shrink-0">
                      <img
                        src={page.avatar}
                        alt={page.name}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-xs"
                      />
                      {isCurrent && (
                        <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1 shadow-xs" title="Currently Active Page">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {page.name}
                        </h3>
                        {isCurrent && (
                          <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                            {language === 'kh' ? 'កំពុងជ្រើសរើស' : 'Current'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {page.category}
                      </p>
                      <p className="text-[11px] text-blue-600 font-medium font-mono mt-0.5 truncate">
                        {page.pageIdOrUsername || `@${page.id}`}
                      </p>
                    </div>
                  </div>

                  {/* Info stats pill list */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center mb-4">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-medium block">
                        {language === 'kh' ? 'ការជជែក' : 'Chats'}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {pageThreads.length}
                      </span>
                    </div>
                    <div className="border-x border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase font-medium block">
                        {language === 'kh' ? 'កុម្ម៉ង់' : 'Orders'}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {pageOrders.length}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-medium block">
                        Followers
                      </span>
                      <span className="text-xs font-bold text-slate-800 truncate block">
                        {page.followerCount}
                      </span>
                    </div>
                  </div>

                  {/* Staff Info */}
                  <div className="text-xs text-slate-500 flex items-center justify-between mb-4">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{language === 'kh' ? 'បុគ្គលិកទទួលបន្ទុក:' : 'Staff:'}</span>
                    </span>
                    <span className="font-semibold text-slate-700">{page.activeStaff}</span>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onEditPage(page)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title={language === 'kh' ? 'កែប្រែព័ត៌មានទំព័រ' : 'Edit Page'}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onSimulatePageChat(page.id)}
                        className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium cursor-pointer"
                        title={language === 'kh' ? 'សាកល្បងទទួលសារអតិថិជនថ្មីលើទំព័រនេះ' : 'Simulate incoming customer chat'}
                      >
                        <Sparkles className="w-4 h-4" />
                        <span className="text-[11px] hidden sm:inline">{language === 'kh' ? 'តេស្តសារ' : 'Test Chat'}</span>
                      </button>
                      {pages.length > 1 && (
                        <button
                          onClick={() => onDeletePage(page.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title={language === 'kh' ? 'ផ្តាច់ទំព័រ' : 'Disconnect page'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {!isCurrent ? (
                      <button
                        onClick={() => onSelectPage(page)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                        title={language === 'kh' ? 'ប្តូរទៅកាន់ទំព័រនេះ' : 'Switch to this page and open inbox'}
                      >
                        <span>{language === 'kh' ? 'ប្តូរ & បើកឆាត' : 'Switch & Open Chat'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onSelectPage(page)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                        title={language === 'kh' ? 'បើកប្រអប់សារទំព័រនេះ' : 'Open Inbox for this active page'}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{language === 'kh' ? 'កំពុងប្រើ • បើកឆាត' : 'Active • Open Inbox'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* KHQR & Payment Configuration Section */}
        <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <input
            type="file"
            ref={khqrPageFileInputRef}
            onChange={handlePageKhqrUpload}
            accept="image/*"
            className="hidden"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>{language === 'kh' ? 'ការកំណត់គណនីធនាគារ & Bakong KHQR' : 'Bakong KHQR & Payment Settings'}</span>
                  <span className="text-[10px] font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    ABA Pay
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'kh'
                    ? 'កំណត់រូបភាពកូដ KHQR និងលេខកុងធនាគារដែលត្រូវផ្ញើទៅអតិថិជន និងបោះពុម្ពលើវិក្កយបត្រ'
                    : 'Configure KHQR image and account info sent to customers and printed on invoices'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => khqrPageFileInputRef.current?.click()}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{language === 'kh' ? 'ប្តូររូប KHQR ថ្មី' : 'Upload New KHQR'}</span>
              </button>
              {khqrConfig.qrImage !== DEFAULT_KHQR_IMAGE && (
                <button
                  type="button"
                  onClick={resetKhqr}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                  title="ត្រឡប់ទៅរូបដើម"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{language === 'kh' ? 'ដើម' : 'Reset'}</span>
                </button>
              )}
            </div>
          </div>

          {pageKhqrUploadSuccess && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">
                {language === 'kh'
                  ? 'បានធ្វើបច្ចុប្បន្នភាពរូបភាព KHQR ថ្មីសម្រាប់កម្មវិធីទាំងមូលដោយជោគជ័យ!'
                  : 'New KHQR image uploaded and updated across the app successfully!'}
              </span>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* QR Code Graphic Box */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-4">
              <div 
                onClick={() => khqrPageFileInputRef.current?.click()}
                title="ចុចដើម្បីប្តូររូប KHQR ថ្មី"
                className="w-24 h-24 bg-white p-1 rounded-xl border-2 border-red-200 shrink-0 overflow-hidden shadow-2xs relative group cursor-pointer hover:border-red-500 transition-colors"
              >
                <img
                  src={khqrConfig.qrImage || DEFAULT_KHQR_IMAGE}
                  alt="KHQR Sok Chea CHHAI"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = FALLBACK_KHQR_IMAGE;
                  }}
                  className="w-full h-full object-contain"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg text-white">
                  <Upload className="w-5 h-5" />
                </div>
              </div>
              <div className="text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-red-600 tracking-wider block">
                  Bakong / ABA KHQR
                </span>
                <p className="font-bold text-slate-800 text-sm">{khqrConfig.merchantName}</p>
                <p className="font-mono text-slate-600 text-xs">ABA: {khqrConfig.accountNumber}</p>
                <p className="text-[11px] text-emerald-600 font-semibold">
                  ✓ {language === 'kh' ? 'រួចរាល់សម្រាប់ស្កេន' : 'Ready for scan'}
                </p>
              </div>
            </div>

            {/* Account Details & Edit Form */}
            <div className="md:col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">
                  {language === 'kh' ? 'ព័ត៌មានគណនី (Account Information)' : 'Bank Account Details'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditMerchant(khqrConfig.merchantName);
                    setEditAccount(khqrConfig.accountNumber);
                    setIsEditingBankDetails(!isEditingBankDetails);
                  }}
                  className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                >
                  {isEditingBankDetails ? (language === 'kh' ? 'បោះបង់' : 'Cancel') : (language === 'kh' ? 'កែប្រែព័ត៌មាន' : 'Edit Details')}
                </button>
              </div>

              {isEditingBankDetails ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      {language === 'kh' ? 'ឈ្មោះម្ចាស់គណនី (Merchant Name)' : 'Account Name'}
                    </label>
                    <input
                      type="text"
                      value={editMerchant}
                      onChange={(e) => setEditMerchant(e.target.value)}
                      placeholder="Sok Chea CHHAI"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-red-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      {language === 'kh' ? 'លេខកុង ABA (Account Number)' : 'ABA Account Number'}
                    </label>
                    <input
                      type="text"
                      value={editAccount}
                      onChange={(e) => setEditAccount(e.target.value)}
                      placeholder="005 452 334"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-red-500 font-mono font-medium"
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingBankDetails(false)}
                      className="px-3 py-1 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      {language === 'kh' ? 'បោះបង់' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveBankDetails}
                      className="px-4 py-1 bg-slate-900 hover:bg-black text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{language === 'kh' ? 'រក្សាទុក' : 'Save Details'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">ឈ្មោះគណនី</span>
                    <span className="font-bold text-slate-800 text-sm">{khqrConfig.merchantName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">លេខគណនី ABA Bank</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">{khqrConfig.accountNumber}</span>
                  </div>
                  <div className="col-span-2 text-slate-500 text-[11px]">
                    {language === 'kh'
                      ? 'គណនីនេះនឹងត្រូវភ្ជាប់ជាមួយ Quick Reply /aba, ការផ្ញើកូដ KHQR ក្នុងប្រអប់សារ និងការបោះពុម្ពលើវិក្កយបត្រទាំងអស់។'
                      : 'This account is automatically linked to Quick Reply /aba, KHQR sending in chat, and all printed invoices.'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Integration Guide Section */}
        <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-800">
              {language === 'kh' ? 'សេចក្តីណែនាំអំពីការតភ្ជាប់ Webhook (Integration Guide)' : 'Page & Webhook Integration Guide'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mb-5">
            {language === 'kh'
              ? 'អនុវត្តតាមជំហានងាយៗដើម្បីភ្ជាប់ Facebook Pages, Telegram Bot, TikTok Shop និង Instagram ជាមួយ PageChat Pro'
              : 'Follow simple steps to connect Facebook Pages, Telegram Bot, TikTok Shop and Instagram'}
          </p>

          {/* Guide Platform Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            {[
              { id: 'meta', label: '1. Facebook Meta Business Suite' },
              { id: 'telegram', label: '2. Telegram Bot (@BotFather)' },
              { id: 'tiktok', label: '3. TikTok Shop Open API' },
              { id: 'instagram', label: '4. Instagram Professional' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setGuideTab(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  guideTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Guide Content */}
          <div className="mt-4 text-xs text-slate-600 leading-relaxed space-y-3">
            {guideTab === 'meta' && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-blue-900">
                  <p className="font-semibold mb-1">
                    {language === 'kh' ? 'ជំហានតភ្ជាប់ Facebook Page (developers.facebook.com):' : 'Facebook Page Setup Steps:'}
                  </p>
                  <ol className="list-decimal pl-5 space-y-1 text-blue-800">
                    <li>{language === 'kh' ? 'ចូលទៅកាន់ developers.facebook.com -> ជ្រើសរើស App របស់អ្នក' : 'Visit developers.facebook.com and select your App.'}</li>
                    <li>{language === 'kh' ? 'ចូលទៅកាន់ Messenger -> Webhooks -> ចុច "Add Callback URL" ឬ "Edit Callback URL"' : 'Go to Messenger -> Webhooks -> Click "Add Callback URL" or "Edit".'}</li>
                    <li>{language === 'kh' ? 'ចម្លង "Callback URL" និង "Verify Token" ខាងក្រោមដាក់ក្នុង Meta' : 'Copy the Callback URL and Verify Token below into Meta.'}</li>
                    <li>{language === 'kh' ? 'ចុច "Verify and Save" លើ Meta (ប្រព័ន្ធនឹងឆ្លើយតប Challenge ភ្លាម)' : 'Click "Verify and Save" in Meta.'}</li>
                    <li>{language === 'kh' ? 'ចុច "Add Subscriptions" លើវាល: messages, messaging_postbacks' : 'Click "Add Subscriptions" and select: messages, messaging_postbacks.'}</li>
                  </ol>
                </div>

                {/* 1. Callback URL Box */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="font-semibold text-slate-700 shrink-0 w-24">1. Callback URL:</span>
                    <code className="bg-white px-2 py-1 rounded border border-slate-200 text-blue-600 font-mono text-[11px] flex-1 truncate select-all">
                      {webhookUrl}
                    </code>
                    <button
                      onClick={handleCopyWebhook}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 shadow-xs cursor-pointer"
                    >
                      {copiedWebhook ? <CheckCheck className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedWebhook ? (language === 'kh' ? 'បានចម្លង!' : 'Copied!') : (language === 'kh' ? 'ចម្លង URL' : 'Copy URL')}</span>
                    </button>
                  </div>

                  {/* 2. Verify Token Box */}
                  <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="font-semibold text-slate-700 shrink-0 w-24">2. Verify Token:</span>
                    <code className="bg-white px-2 py-1 rounded border border-slate-200 text-slate-800 font-mono text-xs flex-1 select-all font-bold">
                      {verifyToken}
                    </code>
                    <button
                      onClick={handleCopyToken}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                    >
                      {copiedToken ? <CheckCheck className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedToken ? (language === 'kh' ? 'បានចម្លង!' : 'Copied!') : (language === 'kh' ? 'ចម្លង Token' : 'Copy Token')}</span>
                    </button>
                  </div>

                  {/* 3. Live Handshake Test */}
                  <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">
                        {language === 'kh' ? 'តេស្តដំណើរការ Endpoint លើ Server:' : 'Test server handshake endpoint:'}
                      </span>
                      {testStatus === 'success' && (
                        <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>{language === 'kh' ? 'ឆ្លើយតប 200 OK ជោគជ័យ!' : 'Responded 200 OK successfully!'}</span>
                        </span>
                      )}
                      {testStatus === 'failed' && (
                        <span className="text-xs text-rose-600 font-bold">
                          {language === 'kh' ? 'បរាជ័យក្នុងការតភ្ជាប់' : 'Test failed'}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleTestWebhookHandshake}
                      disabled={testStatus === 'testing'}
                      className="px-3 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-300 cursor-pointer"
                    >
                      {testStatus === 'testing' ? (language === 'kh' ? 'កំពុងតេស្ត...' : 'Testing...') : (language === 'kh' ? 'តេស្ត Endpoint' : 'Test Handshake')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {guideTab === 'telegram' && (
              <div className="p-3 bg-sky-50/70 border border-sky-100 rounded-xl text-sky-900 space-y-2">
                <p className="font-semibold">
                  {language === 'kh' ? 'ការបង្កើត Telegram Bot ក្នុងរយៈពេល ១ នាទី:' : 'Create & Connect Telegram Bot in 1 minute:'}
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-sky-800">
                  <li>{language === 'kh' ? 'បើក Telegram រួចស្វែងរក @BotFather' : 'Open Telegram and search for @BotFather.'}</li>
                  <li>{language === 'kh' ? 'ផ្ញើសារ /newbot រួចដាក់ឈ្មោះ Bot និង username បញ្ចប់ដោយ bot' : 'Send /newbot and provide bot name and username ending in bot.'}</li>
                  <li>{language === 'kh' ? 'BotFather នឹងផ្តល់ជូន HTTP API Token (ឧ. 71928374:AAH...) មកអ្នក' : 'BotFather gives you HTTP API Token.'}</li>
                  <li>{language === 'kh' ? 'ចុចប៊ូតុង "+ ភ្ជាប់ទំព័រថ្មី" ជ្រើសរើស Telegram រួចបិទភ្ជាប់ Token ជាការស្រេច!' : 'Click "+ Connect New Page", choose Telegram and paste Token.'}</li>
                </ol>
              </div>
            )}

            {guideTab === 'tiktok' && (
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 space-y-2">
                <p className="font-semibold">
                  {language === 'kh' ? 'ការតភ្ជាប់ TikTok Shop Chat & Live Orders:' : 'Connect TikTok Shop Chat & Live Orders:'}
                </p>
                <p>
                  {language === 'kh'
                    ? 'ចូលទៅកាន់ TikTok Shop Seller Center -> Apps & Services -> Authorize App ដើម្បីឱ្យសារឆាត និងការកុម្ម៉ង់ពេល TikTok Live ហូរចូលមកកាន់ PageChat Pro ដោយស្វ័យប្រវត្ត។'
                    : 'Visit TikTok Shop Seller Center -> Apps & Services to authorize PageChat Pro for automatic synchronization of live chats and store orders.'}
                </p>
              </div>
            )}

            {guideTab === 'instagram' && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-900 space-y-2">
                <p className="font-semibold">
                  {language === 'kh' ? 'ការតភ្ជាប់ Instagram Direct Message:' : 'Connect Instagram Direct Messaging:'}
                </p>
                <p>
                  {language === 'kh'
                    ? 'ប្តូរគណនី Instagram របស់អ្នកទៅជា "Professional / Business Account" រួចភ្ជាប់ជាមួយ Facebook Page នោះសារ IG Direct នឹងបង្ហាញក្នុងប្រអប់សារនេះភ្លាមៗ។'
                    : 'Switch your Instagram account to Professional / Business Account and link it to your Facebook Page. Direct messages will stream into PageChat Pro instantly.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
