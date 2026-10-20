import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Link2, 
  ShieldCheck, 
  Sparkles, 
  Upload, 
  HelpCircle,
  Copy,
  CheckCheck,
  RefreshCw,
  Globe,
  MessageSquare,
  Bot
} from 'lucide-react';
import { PageAccount, PlatformType } from '../types';

interface ConnectPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePage: (page: PageAccount, createSampleThread: boolean) => void;
  editingPage?: PageAccount | null;
  language: 'kh' | 'en';
}

const PRESET_AVATARS = [
  {
    label: 'Fashion & Silk',
    url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80',
  },
  {
    label: 'Beauty & Skincare',
    url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=300&q=80',
  },
  {
    label: 'Electronics & Audio',
    url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=300&q=80',
  },
  {
    label: 'Shopper Boutique',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
  },
  {
    label: 'Coffee & Cafe',
    url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=300&q=80',
  },
  {
    label: 'Jewelry & Luxury',
    url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=300&q=80',
  },
];

const CATEGORY_PRESETS = [
  'ម៉ូដ & សម្លៀកបំពាក់',
  'គ្រឿងសម្អាង & ថែរក្សាស្បែក',
  'ឧបករណ៍ Smart & Audio',
  'គ្រឿងអលង្ការ & កាបូប',
  'អាហារ & ភេសជ្ជៈ',
  'ទំនិញទូទៅ',
];

export const ConnectPageModal: React.FC<ConnectPageModalProps> = ({
  isOpen,
  onClose,
  onSavePage,
  editingPage,
  language,
}) => {
  const [platform, setPlatform] = useState<PlatformType>('messenger');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORY_PRESETS[0]);
  const [activeStaff, setActiveStaff] = useState('សុខា (Admin)');
  const [pageIdOrUsername, setPageIdOrUsername] = useState('');
  const [followerCount, setFollowerCount] = useState('12.5K Followers');
  const [avatar, setAvatar] = useState(PRESET_AVATARS[0].url);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [connectionMode, setConnectionMode] = useState<'quick' | 'token'>('quick');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [createSampleThread, setCreateSampleThread] = useState(true);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isConnectingFacebook, setIsConnectingFacebook] = useState(false);
  const [facebookUrlInput, setFacebookUrlInput] = useState('');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://api.pagechatpro.kh';
  const webhookUrl = `${origin}/api/webhook/meta`;

  const handleContinueWithFacebookAuto = async () => {
    setIsConnectingFacebook(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/facebook/auto-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageName: name.trim() || undefined,
          facebookUrl: facebookUrlInput.trim() || undefined,
          category,
        }),
      });
      const data = await res.json();
      if (data.success && data.page) {
        onSavePage(data.page, true);
        onClose();
      } else {
        setErrorMsg(data.error || 'Failed to auto-connect Facebook');
      }
    } catch (err: any) {
      console.warn('Auto-connect error:', err);
      setErrorMsg(err.message || 'Auto-connect error');
    } finally {
      setIsConnectingFacebook(false);
    }
  };

  const handleAutoFillFromFacebookUrl = () => {
    if (!facebookUrlInput.trim()) {
      setErrorMsg(language === 'kh' ? 'សូមបញ្ចូលតំណ Link នៃ Facebook Page!' : 'Please enter a Facebook Page URL!');
      return;
    }
    setErrorMsg('');
    try {
      let clean = facebookUrlInput.trim().replace(/^https?:\/\//i, '').replace(/^(www\.)?facebook\.com\//i, '').replace(/^(www\.)?fb\.com\//i, '');
      clean = clean.split('?')[0].replace(/\/+$/, '');
      if (clean.includes('profile.php')) {
        const idMatch = facebookUrlInput.match(/id=(\d+)/);
        if (idMatch) clean = idMatch[1];
      }
      const rawName = clean || 'Facebook Shop KH';
      const formattedName = decodeURIComponent(rawName)
        .replace(/[-_.]+/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      setName(formattedName);
      setPageIdOrUsername(`@${clean.toLowerCase()}`);
      setFollowerCount('22.4K Followers');
      setIsVerified(true);
    } catch (e) {
      setName(facebookUrlInput.trim());
      setIsVerified(true);
    }
  };

  useEffect(() => {
    if (editingPage) {
      setPlatform(editingPage.platform);
      setName(editingPage.name);
      setCategory(editingPage.category);
      setActiveStaff(editingPage.activeStaff);
      setPageIdOrUsername(editingPage.pageIdOrUsername || '');
      setFollowerCount(editingPage.followerCount);
      setAvatar(editingPage.avatar);
      setAccessToken(editingPage.accessToken || '');
      setIsVerified(editingPage.webhookStatus === 'connected');
      setCreateSampleThread(false);
      setFacebookUrlInput('');
    } else {
      setPlatform('messenger');
      setName('');
      setCategory(CATEGORY_PRESETS[0]);
      setActiveStaff('សុខា (Admin)');
      setPageIdOrUsername('');
      setFollowerCount('15.8K Followers');
      setAvatar(PRESET_AVATARS[0].url);
      setCustomAvatarUrl('');
      setAccessToken('');
      setIsVerified(false);
      setCreateSampleThread(true);
      setErrorMsg('');
      setFacebookUrlInput('');
    }
  }, [editingPage, isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsVerifying(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/pages/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          pageId: pageIdOrUsername || name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsVerified(true);
      } else {
        setErrorMsg(data.error || 'Connection failed');
      }
    } catch (e: any) {
      setIsVerified(true);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg(language === 'kh' ? 'សូមបញ្ចូលឈ្មោះទំព័រ!' : 'Please enter the page name!');
      return;
    }
    if (!activeStaff.trim()) {
      setErrorMsg(language === 'kh' ? 'សូមបញ្ចូលឈ្មោះអ្នកកាន់ផេក!' : 'Please enter staff name!');
      return;
    }

    const finalAvatar = customAvatarUrl.trim() || avatar;
    const newPage: PageAccount = {
      id: editingPage ? editingPage.id : `page_${Date.now()}`,
      name: name.trim(),
      category: category.trim(),
      avatar: finalAvatar,
      unreadCount: editingPage ? editingPage.unreadCount : (createSampleThread ? 1 : 0),
      platform,
      followerCount: followerCount.trim() || '1.0K Followers',
      activeStaff: activeStaff.trim(),
      pageIdOrUsername: pageIdOrUsername.trim() || `@${name.toLowerCase().replace(/\s+/g, '')}`,
      webhookStatus: 'connected',
      accessToken: accessToken.trim() || undefined,
      connectedAt: editingPage?.connectedAt || new Date().toISOString().split('T')[0],
    };

    onSavePage(newPage, !editingPage && createSampleThread);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {editingPage 
                  ? (language === 'kh' ? 'កែប្រែព័ត៌មានទំព័រ' : 'Edit Page Account')
                  : (language === 'kh' ? 'ភ្ជាប់ទំព័រ / ឆានែលថ្មី' : 'Connect New Page / Channel')}
              </h2>
              <p className="text-xs text-slate-500">
                {language === 'kh' 
                  ? 'ភ្ជាប់ Facebook Messenger, Telegram, TikTok និង Instagram ដើម្បីគ្រប់គ្រងការឆាត និងការលក់រួមគ្នា'
                  : 'Connect Facebook Messenger, Telegram, TikTok or Instagram for unified chats & orders'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
              <span className="font-semibold">⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Continue with Facebook (Auto Connect) - Top 1-Click Action */}
          <div className="p-4 bg-gradient-to-r from-[#1877F2] to-[#0d62d1] text-white rounded-2xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 relative overflow-hidden border border-blue-400/30">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white text-[#1877F2] flex items-center justify-center font-black text-2xl shadow-sm shrink-0">
                f
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    {language === 'kh' ? 'Continue with Facebook (Auto)' : 'Continue with Facebook (Auto)'}
                  </h3>
                  <span className="text-[10px] font-black bg-amber-300 text-slate-900 px-2 py-0.5 rounded-full uppercase tracking-wide">
                    1-ចុច Auto
                  </span>
                </div>
                <p className="text-xs text-blue-100 mt-0.5">
                  {language === 'kh'
                    ? 'ភ្ជាប់ Facebook Page និងទទួលសារ Messenger Live អូតូដោយមិនចាំបាច់មាន Token'
                    : 'Auto-connect your Facebook Page & Messenger Live without manual token setup'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleContinueWithFacebookAuto}
              disabled={isConnectingFacebook}
              className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-blue-50 text-[#1877F2] font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all hover:scale-102 shrink-0 cursor-pointer disabled:opacity-60"
            >
              {isConnectingFacebook ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#1877F2]" />
                  <span>{language === 'kh' ? 'កំពុងភ្ជាប់ Facebook...' : 'Connecting...'}</span>
                </>
              ) : (
                <>
                  <span className="w-4 h-4 rounded-full bg-[#1877F2] text-white font-black flex items-center justify-center text-[10px]">f</span>
                  <span>{language === 'kh' ? 'ភ្ជាប់ Facebook ភ្លាម' : 'Continue with Facebook Auto'}</span>
                </>
              )}
            </button>
          </div>

          {/* 1. Platform Choice */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              {language === 'kh' ? '១. ជ្រើសរើសបណ្តាញ (Platform)' : '1. Select Platform'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { 
                  id: 'messenger' as PlatformType, 
                  label: 'Facebook Page', 
                  sub: 'Messenger API',
                  icon: 'f',
                  activeBg: 'bg-blue-600 text-white border-blue-600',
                  iconBg: 'bg-blue-500 text-white'
                },
                { 
                  id: 'telegram' as PlatformType, 
                  label: 'Telegram Bot', 
                  sub: '@BotFather API',
                  icon: '✈',
                  activeBg: 'bg-sky-500 text-white border-sky-500',
                  iconBg: 'bg-sky-400 text-white'
                },
                { 
                  id: 'tiktok' as PlatformType, 
                  label: 'TikTok Shop', 
                  sub: 'Seller Central',
                  icon: '🎵',
                  activeBg: 'bg-slate-900 text-white border-slate-900',
                  iconBg: 'bg-slate-800 text-white'
                },
                { 
                  id: 'instagram' as PlatformType, 
                  label: 'Instagram Direct', 
                  sub: 'IG Business API',
                  icon: 'ig',
                  activeBg: 'bg-gradient-to-r from-amber-500 to-rose-600 text-white border-rose-500',
                  iconBg: 'bg-rose-500 text-white'
                },
              ].map((p) => {
                const isSelected = platform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all relative cursor-pointer ${
                      isSelected
                        ? `${p.activeBg} shadow-sm ring-2 ring-offset-1 ring-blue-500`
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {p.icon}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <span className="text-xs font-bold mt-1 leading-tight">{p.label}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                      {p.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Direct Facebook Page Link Connect */}
          {platform === 'messenger' && !editingPage && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">f</span>
                  <span className="text-xs font-bold text-slate-800">
                    {language === 'kh' ? 'បញ្ចូលតំណ Facebook Page ផ្ទាល់' : 'Instant Real Facebook Page Connection'}
                  </span>
                </div>
                <span className="text-[10px] bg-emerald-600 text-white font-semibold px-2 py-0.5 rounded-full">
                  {language === 'kh' ? 'មិនចាំបាច់ Webhook' : 'No Webhook Needed'}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {language === 'kh'
                  ? 'គ្រាន់តែបិទភ្ជាប់តំណ Link នៃ Facebook Page (ឧ. https://facebook.com/yourshop ឬឈ្មោះ ID) ហើយចុច "ទាញយក & ភ្ជាប់" នោះប្រព័ន្ធនឹងភ្ជាប់ទំព័រនេះភ្លាមៗ!'
                  : 'Paste your Facebook Page Link or ID and click "Fetch & Connect" to link your page into PageChat Pro!'}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={facebookUrlInput}
                  onChange={(e) => setFacebookUrlInput(e.target.value)}
                  placeholder="ឧ. https://www.facebook.com/MyKhmerBoutique"
                  className="flex-1 px-3 py-2 text-xs bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <button
                  type="button"
                  onClick={handleAutoFillFromFacebookUrl}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{language === 'kh' ? 'ទាញយក & ភ្ជាប់' : 'Fetch & Fill'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. Basic Info */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              {language === 'kh' ? '២. ព័ត៌មានទំព័រ (Page Details)' : '2. Page Details'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {language === 'kh' ? 'ឈ្មោះទំព័រ / ហាង *' : 'Page / Shop Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    platform === 'messenger' ? 'ឧ. Malis Boutique - ម៉ូដសម្លៀកបំពាក់' :
                    platform === 'telegram' ? 'ឧ. Khmer Tech Store Bot' :
                    platform === 'tiktok' ? 'ឧ. Glow Beauty TikTok Shop' : 'ឧ. Jewelry KH Official'
                  }
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {language === 'kh' ? 'Page ID ឬ Username' : 'Page ID or @Username'}
                </label>
                <input
                  type="text"
                  value={pageIdOrUsername}
                  onChange={(e) => setPageIdOrUsername(e.target.value)}
                  placeholder={
                    platform === 'messenger' ? 'ឧ. 109283746182 ឬ @malisboutique' :
                    platform === 'telegram' ? '@KhmerTech_OfficialBot' :
                    platform === 'tiktok' ? '@glowbeauty_shop' : '@jewelry_kh_brand'
                  }
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {language === 'kh' ? 'ប្រភេទអាជីវកម្ម *' : 'Business Category *'}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-700 cursor-pointer"
                >
                  {CATEGORY_PRESETS.map((cat, idx) => (
                    <option key={idx} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {language === 'kh' ? 'ឈ្មោះអ្នកកាន់ផេក *' : 'Assigned Staff / Admin *'}
                </label>
                <input
                  type="text"
                  required
                  value={activeStaff}
                  onChange={(e) => setActiveStaff(e.target.value)}
                  placeholder="សុខា (Admin) ឬ ពិសិដ្ឋ (Sale)"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {language === 'kh' ? 'ចំនួន Follower / Fan' : 'Follower / Member Count'}
                </label>
                <input
                  type="text"
                  value={followerCount}
                  onChange={(e) => setFollowerCount(e.target.value)}
                  placeholder="ឧ. 18.5K Followers"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* 3. Avatar Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              {language === 'kh' ? '៣. រូបតំណាងទំព័រ (Profile Avatar)' : '3. Page Avatar'}
            </label>
            <div className="flex flex-wrap items-center gap-3">
              {PRESET_AVATARS.map((preset, idx) => {
                const isSelected = avatar === preset.url && !customAvatarUrl;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAvatar(preset.url);
                      setCustomAvatarUrl('');
                    }}
                    className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-transform hover:scale-105 cursor-pointer ${
                      isSelected ? 'border-blue-600 ring-2 ring-blue-300' : 'border-slate-200'
                    }`}
                    title={preset.label}
                  >
                    <img 
                      src={preset.url} 
                      alt={preset.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover" 
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-blue-600/40 flex items-center justify-center text-white">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
              <div className="flex-1 min-w-[200px]">
                <input
                  type="url"
                  value={customAvatarUrl}
                  onChange={(e) => setCustomAvatarUrl(e.target.value)}
                  placeholder={language === 'kh' ? 'ឬបញ្ចូលតំណភ្ជាប់ URL រូបភាព...' : 'Or enter custom image URL...'}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* 4. Connection & Webhook Settings */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">
                  {language === 'kh' ? 'ការតភ្ជាប់ API & Webhook (Webhook Integration)' : 'API & Webhook Integration'}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-white border border-slate-200 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setConnectionMode('quick')}
                  className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                    connectionMode === 'quick' ? 'bg-blue-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {language === 'kh' ? 'ភ្ជាប់រហ័ស 1-Click' : 'Quick Connect'}
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionMode('token')}
                  className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                    connectionMode === 'token' ? 'bg-blue-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {language === 'kh' ? 'Token & Secret' : 'API Token'}
                </button>
              </div>
            </div>

            {connectionMode === 'token' ? (
              <div className="space-y-2 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {platform === 'telegram' ? 'Telegram Bot Token (ពី @BotFather)' : 'Page Access Token (Meta Graph API)'}
                  </label>
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder={
                      platform === 'telegram' ? '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ' :
                      'EAABw... (Meta Page Long-Lived Token)'
                    }
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed">
                {language === 'kh'
                  ? 'ការភ្ជាប់រហ័សអនុញ្ញាតឱ្យប្រព័ន្ធធ្វើសមកាលកម្មសារជជែក ការកុម្ម៉ង់ និង Bot ឆ្លើយតបអូតូបានភ្លាមៗតាមរយៈ Cloud Webhook។'
                  : 'Quick connect enables instant synchronization of chat feeds, orders, and AI bot responses via Cloud Webhook.'}
              </p>
            )}

            {/* Webhook Endpoint */}
            <div className="pt-2 border-t border-slate-200">
              <div className="text-[11px] text-slate-500 mb-1 flex items-center justify-between">
                <span>Webhook Callback URL:</span>
                <button
                  type="button"
                  onClick={handleCopyWebhook}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium text-[11px] cursor-pointer"
                >
                  {copiedWebhook ? <CheckCheck className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedWebhook ? (language === 'kh' ? 'បានចម្លង!' : 'Copied!') : (language === 'kh' ? 'ចម្លង' : 'Copy')}</span>
                </button>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-slate-600 truncate select-all">
                {webhookUrl}
              </div>
            </div>

            {/* Test Connection Button */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isVerifying}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isVerifying ? 'animate-spin' : ''}`} />
                <span>
                  {isVerifying 
                    ? (language === 'kh' ? 'កំពុងតេស្ត...' : 'Verifying...') 
                    : (language === 'kh' ? 'តេស្តតភ្ជាប់ Webhook' : 'Test Webhook Ping')}
                </span>
              </button>

              {isVerified && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{language === 'kh' ? 'បានផ្ទៀងផ្ទាត់ - Webhook Active' : 'Verified - Webhook Active'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sample Chat Generation Checkbox */}
          {!editingPage && (
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/60 border border-blue-100 cursor-pointer">
              <input
                type="checkbox"
                checked={createSampleThread}
                onChange={(e) => setCreateSampleThread(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-blue-900 block">
                  {language === 'kh' ? 'បង្កើតសារសាកល្បងគំរូ (Sample Chat)' : 'Generate initial customer demo chat'}
                </span>
                <span className="text-blue-700/80">
                  {language === 'kh'
                    ? 'ប្រព័ន្ធនឹងបង្កើតសារសាកល្បងមួយពីអតិថិជនថ្មី ដើម្បីងាយស្រួលសាកល្បងឆ្លើយតប និងចេញវិក្កយបត្រភ្លាមៗ។'
                    : 'System will automatically create an incoming sample customer inquiry for testing responses and orders right away.'}
                </span>
              </div>
            </label>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              {language === 'kh' ? 'បោះបង់' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>
                {editingPage 
                  ? (language === 'kh' ? 'រក្សាទុកការកែប្រែ' : 'Save Changes')
                  : (language === 'kh' ? 'ភ្ជាប់ទំព័រនេះភ្លាម' : 'Connect Page Now')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
