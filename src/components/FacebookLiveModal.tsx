import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Radio, 
  ShieldCheck, 
  ExternalLink, 
  RefreshCw, 
  Key, 
  Sparkles,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Zap,
  MessageSquare,
  ShoppingBag,
  QrCode,
  Truck,
  Send,
  Power
} from 'lucide-react';
import { PageAccount } from '../types';

interface FacebookLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  page: PageAccount;
  onUpdatePage: (updated: PageAccount) => void;
  onSyncRealConversations?: () => void;
  language: 'kh' | 'en';
}

export const FacebookLiveModal: React.FC<FacebookLiveModalProps> = ({
  isOpen,
  onClose,
  page,
  onUpdatePage,
  onSyncRealConversations,
  language,
}) => {
  const [tokenInput, setTokenInput] = useState(page.accessToken || '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [verifiedPageData, setVerifiedPageData] = useState<any>(null);
  const [showAdvancedToken, setShowAdvancedToken] = useState(false);
  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState(false);
  const [simulateSuccessMsg, setSimulateSuccessMsg] = useState('');
  const [isConnectingFacebook, setIsConnectingFacebook] = useState(false);

  const isLive = Boolean(page.isLiveOnline || page.accessToken);

  // 1-Click Continue with Facebook (Auto Connect)
  const handleContinueWithFacebookAuto = async () => {
    setIsConnectingFacebook(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/auth/facebook/auto-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageName: page.name,
          category: page.category,
        }),
      });
      const data = await res.json();
      if (data.success && data.page) {
        onUpdatePage({
          ...page,
          isLiveOnline: true,
          webhookStatus: 'connected',
          accessToken: data.page.accessToken,
        });
        setSuccessMsg(
          language === 'kh'
            ? 'ការតភ្ជាប់ Continue with Facebook (Auto) បានជោគជ័យ! Live Online Messenger ដំណើរការហើយ'
            : 'Connected with Facebook (Auto) successfully! Live Online is now active.'
        );
        if (onSyncRealConversations) {
          onSyncRealConversations();
        }
      } else {
        setErrorMsg(data.error || 'Auto-connect failed');
      }
    } catch (err: any) {
      console.warn('Auto-connect error:', err);
      setErrorMsg(err.message || 'Auto-connect error');
    } finally {
      setIsConnectingFacebook(false);
    }
  };

  // 1-Click Toggle Live Online
  const handleToggleLiveOnline = () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (isLive) {
      const updated: PageAccount = {
        ...page,
        isLiveOnline: false,
        accessToken: undefined,
        webhookStatus: 'disconnected',
      };
      onUpdatePage(updated);
      setTokenInput('');
      setSuccessMsg(
        language === 'kh'
          ? 'បានបិទ Live Online សម្រាប់ទំព័រនេះ (Offline Mode)'
          : 'Live Online turned off. Page is now in offline mode.'
      );
    } else {
      const updated: PageAccount = {
        ...page,
        isLiveOnline: true,
        webhookStatus: 'connected',
      };
      onUpdatePage(updated);
      setSuccessMsg(
        language === 'kh'
          ? 'ស្ថានភាព Live Online លើ Messenger បានបើកដំណើរការជោគជ័យ! ប្រព័ន្ធកំពុងទទួលសារ Realtime'
          : 'Live Online on Messenger is now ACTIVE! System is listening for real-time customer chats.'
      );
    }
  };

  const handleVerifyAndConnect = async () => {
    if (!tokenInput.trim()) {
      setErrorMsg(language === 'kh' ? 'សូមបញ្ចូល Page Access Token!' : 'Please enter Page Access Token!');
      return;
    }
    setIsVerifying(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/facebook/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const data = await res.json();
      if (data.success && data.page) {
        setVerifiedPageData(data.page);
        setSuccessMsg(
          language === 'kh' 
            ? 'បានតភ្ជាប់ Live Online ជាមួយ Facebook Graph API ដោយជោគជ័យ!'
            : 'Successfully connected Live Online with official Facebook Graph API!'
        );
        
        const updatedPage: PageAccount = {
          ...page,
          name: data.page.name || page.name,
          accessToken: data.resolvedToken || tokenInput.trim(),
          isLiveOnline: true,
          webhookStatus: 'connected',
          avatar: data.page.avatar || page.avatar,
          followerCount: data.page.followerCount || page.followerCount,
        };
        onUpdatePage(updatedPage);
        if (onSyncRealConversations) {
          onSyncRealConversations();
        }
      } else {
        setErrorMsg(data.error || (language === 'kh' ? 'Token មិនត្រឹមត្រូវ ឬផុតកំណត់!' : 'Invalid or expired Token.'));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTriggerScenario = async (scenario: string, customText?: string) => {
    setIsSimulatingWebhook(true);
    setSimulateSuccessMsg('');
    setErrorMsg('');
    try {
      // Ensure page is set to Live Online when triggering test
      if (!isLive) {
        onUpdatePage({
          ...page,
          isLiveOnline: true,
          webhookStatus: 'connected',
        });
      }

      const res = await fetch('/api/facebook/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: page.id,
          scenario,
          text: customText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSimulateSuccessMsg(
          language === 'kh'
            ? `អតិថិជន "${data.event.senderName}" បានផ្ញើសារចូល Messenger! សូមពិនិត្យ Inbox ដើម្បីឆ្លើយតប។`
            : `Simulated customer "${data.event.senderName}" sent message to Messenger! Check Inbox to reply.`
        );
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error simulating live chat');
    } finally {
      setIsSimulatingWebhook(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs transition-colors ${
              isLive ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'
            }`}>
              <Radio className={`w-5 h-5 ${isLive ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">
                  {language === 'kh' ? 'ស្ថានភាព Live Online លើ Messenger' : 'Live Online on Messenger'}
                </h2>
                {isLive ? (
                  <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>ONLINE</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                    OFFLINE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {page.name} ({page.activeStaff})
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

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {simulateSuccessMsg && (
            <div className="p-3 text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600" />
              <span className="font-medium">{simulateSuccessMsg}</span>
            </div>
          )}

          {/* 1-Click Continue with Facebook (Auto) Banner */}
          <div className="p-4 bg-gradient-to-r from-[#1877F2] to-[#0d62d1] text-white rounded-2xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 relative overflow-hidden border border-blue-400/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white text-[#1877F2] flex items-center justify-center font-black text-xl shadow-xs shrink-0">
                f
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {language === 'kh' ? 'Continue with Facebook (Auto)' : 'Continue with Facebook (Auto)'}
                  </span>
                  <span className="text-[10px] font-black bg-amber-300 text-slate-900 px-2 py-0.5 rounded-full uppercase">
                    1-ចុច Auto
                  </span>
                </div>
                <p className="text-xs text-blue-100 mt-0.5">
                  {language === 'kh'
                    ? 'ភ្ជាប់ Facebook Page និងទទួលសារ Messenger ផ្ទាល់'
                    : 'Auto-connect Facebook Page & receive real-time Messenger chats'}
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
                  <span className="w-3.5 h-3.5 rounded-full bg-[#1877F2] text-white font-black flex items-center justify-center text-[10px]">f</span>
                  <span>{language === 'kh' ? 'ភ្ជាប់ Facebook' : 'Continue with Facebook'}</span>
                </>
              )}
            </button>
          </div>

          {/* Primary Quick Toggle Switch */}
          <div className="p-4 rounded-2xl border transition-colors bg-gradient-to-r from-slate-50 to-blue-50/40 border-slate-200">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    {language === 'kh' ? 'ស្ថានភាព Live Online លើ Messenger' : 'Live Online Status'}
                  </span>
                  {isLive && (
                    <span className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                      ដំណើរការ (ACTIVE)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {isLive
                    ? (language === 'kh' ? 'ទំព័រនេះកំពុង Live Online លើ Messenger ហើយកំពុងស្តាប់សារចូលជាប្រចាំ។' : 'Page is live online on Messenger. Real-time messages are actively received.')
                    : (language === 'kh' ? 'ចុចកុងតាក់ដើម្បីបើក Live Online លើ Messenger ភ្លាមៗ!' : 'Click switch to activate Live Online on Messenger instantly!')}
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleLiveOnline}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isLive ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={isLive}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    isLive ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Live Online Features & Instant Test Scenarios */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>{language === 'kh' ? 'សាកល្បងសារចូល (Live Test Scenarios) ៖' : 'Live Test Scenarios:'}</span>
              </span>
              <span className="text-[10px] text-slate-400">1-Click Dispatch</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTriggerScenario('inquiry')}
                disabled={isSimulatingWebhook}
                className="p-3 text-left bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl transition-all shadow-2xs group flex items-start gap-2.5 cursor-pointer"
              >
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                    {language === 'kh' ? 'សួរតម្លៃ & ស្តុក' : 'Price & Stock Inquiry'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    "ជំរាបសួរបង! រ៉ូបនេះមានស្តុកអត់?..."
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTriggerScenario('order')}
                disabled={isSimulatingWebhook}
                className="p-3 text-left bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all shadow-2xs group flex items-start gap-2.5 cursor-pointer"
              >
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                    {language === 'kh' ? 'កុម្ម៉ង់ Size M ភ្លាម' : 'Instant Order Request'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    "បងសុំកុម្ម៉ង់ Size M មួយណា៎បង..."
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTriggerScenario('khqr')}
                disabled={isSimulatingWebhook}
                className="p-3 text-left bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all shadow-2xs group flex items-start gap-2.5 cursor-pointer"
              >
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                  <QrCode className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">
                    {language === 'kh' ? 'សុំកូដ ABA KHQR' : 'Ask for ABA KHQR'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    "បងសុំ QR Code ABA ឬ KHQR មក..."
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTriggerScenario('delivery')}
                disabled={isSimulatingWebhook}
                className="p-3 text-left bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl transition-all shadow-2xs group flex items-start gap-2.5 cursor-pointer"
              >
                <div className="p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0 group-hover:scale-105 transition-transform">
                  <Truck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 group-hover:text-amber-700">
                    {language === 'kh' ? 'សួរថ្លៃដឹកជញ្ជូន' : 'Delivery Details'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    "ផ្ញើតាម J&T បានអត់?..."
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Sync Real Messages Action */}
          {onSyncRealConversations && isLive && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  onSyncRealConversations();
                  onClose();
                }}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{language === 'kh' ? 'ទាញយកសារពិតពី Facebook ចូលប្រអប់សារ (Sync)' : 'Sync Real Facebook Messages'}</span>
              </button>
            </div>
          )}

          {/* Advanced Official Meta Token Settings Toggle */}
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowAdvancedToken(!showAdvancedToken)}
              className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 hover:text-slate-900 py-1 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-blue-600" />
                <span>{language === 'kh' ? 'កំណត់ Meta Page Access Token (ជម្រើសបន្ថែម)' : 'Official Meta Graph API Token (Optional)'}</span>
              </span>
              <span className="text-[11px] text-blue-600 underline">
                {showAdvancedToken ? (language === 'kh' ? 'លាក់' : 'Hide') : (language === 'kh' ? 'បង្ហាញការកំណត់' : 'Show Settings')}
              </span>
            </button>

            {showAdvancedToken && (
              <div className="mt-3 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in fade-in">
                <div className="space-y-1 text-xs text-slate-600">
                  <span className="font-bold text-slate-800 block text-xs">
                    {language === 'kh' ? 'របៀបយក Token ពី Meta Developer Tools:' : 'Get Token from Meta Developer:'}
                  </span>
                  <ol className="list-decimal pl-5 space-y-1 text-[11px]">
                    <li>
                      <a 
                        href="https://developers.facebook.com/tools/explorer/" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-blue-600 hover:underline font-semibold inline-flex items-center gap-0.5"
                      >
                        <span>Graph API Explorer</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li>{language === 'kh' ? 'ជ្រើសរើស Facebook Page របស់អ្នក' : 'Select your Facebook Page'}</li>
                    <li>{language === 'kh' ? 'ថែម Permissions: pages_messaging, pages_manage_metadata' : 'Add permissions: pages_messaging, pages_manage_metadata'}</li>
                    <li>{language === 'kh' ? 'ចុច Generate Access Token ហើយចម្លងមកដាក់ខាងក្រោម' : 'Click Generate Access Token and paste below'}</li>
                  </ol>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {language === 'kh' ? 'Page Access Token (Meta) ៖' : 'Paste Page Access Token (Meta):'}
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="EAABw..."
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleVerifyAndConnect}
                  disabled={isVerifying}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{language === 'kh' ? 'កំពុងផ្ទៀងផ្ទាត់...' : 'Verifying...'}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{language === 'kh' ? 'ផ្ទៀងផ្ទាត់ & រក្សាទុក Token' : 'Verify & Save Token'}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Webhook Connection Information */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
            <span className="font-bold text-slate-800 block">
              {language === 'kh' ? 'ព័ត៌មាន Meta Webhook Endpoint ៖' : 'Meta Webhook Details:'}
            </span>
            <div className="space-y-1 font-mono text-[11px] text-slate-600">
              <p className="break-all bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-slate-400 select-none">Callback URL: </span>
                <span className="text-blue-600 font-semibold">{window.location.origin}/api/webhook/meta</span>
              </p>
              <p className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-slate-400 select-none">Verify Token: </span>
                <span className="text-slate-800 font-semibold">pagechat_kh_secret</span>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
            <span>{isLive ? (language === 'kh' ? 'កំពុង Live Online' : 'Live Online Active') : 'Offline'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            {language === 'kh' ? 'រួចរាល់' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
