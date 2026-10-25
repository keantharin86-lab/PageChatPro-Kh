import React, { useState, useMemo, useRef } from 'react';
import {
  Smartphone,
  QrCode,
  Download,
  Share2,
  CheckCircle2,
  Copy,
  MessageSquare,
  ShoppingBag,
  BarChart3,
  Package,
  Plus,
  Send,
  ArrowLeft,
  Wifi,
  WifiOff,
  Phone,
  MapPin,
  Receipt,
  Check,
  ExternalLink,
  Maximize2,
  Minimize2,
  Mic,
  Square,
  Volume2,
  Play,
  Pause,
} from 'lucide-react';
import {
  Order,
  OrderStatus,
  ChatThread,
  ProductItem,
  PageAccount,
} from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { resolveOrderDate } from './AnalyticsView';
import {
  resolveCustomerOriginalPageAvatar,
  resolvePageOriginalAvatar,
  buildClientFallbackAvatarDataUrl,
} from '../utils/avatarUtils';

function createMobilePlayableWavDataUrl(durationSec = 3): string {
  try {
    const sampleRate = 8000;
    const numSamples = Math.max(1, Math.floor(sampleRate * durationSec));
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples * 2, true);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const env = Math.sin(Math.min(1, t * 6) * (Math.PI / 2)) * Math.max(0, 1 - t / durationSec);
      const freq = 230 + 40 * Math.sin(2 * Math.PI * 2 * t);
      const s = Math.sin(2 * Math.PI * freq * t) * env * 0.6;
      view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 12000, true);
    }
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return `data:audio/wav;base64,${btoa(binary)}`;
  } catch {
    return '';
  }
}

interface MobileAppViewProps {
  pages: PageAccount[];
  selectedPage: PageAccount;
  threads: ChatThread[];
  orders: Order[];
  products: ProductItem[];
  isOnline: boolean;
  onSendMessage: (text: string, attachments?: any[]) => void;
  onSimulateCustomerReply?: (threadId: string, replyText?: string, attachments?: any[]) => void;
  onSelectThread: (threadId: string) => void;
  selectedThreadId: string;
  onOpenCreateOrder: () => void;
  onViewOrderInvoice: (orderId: string) => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  isGlobalMobileFrame: boolean;
  onToggleGlobalMobileFrame: () => void;
  language: 'kh' | 'en';
}

export const MobileAppView: React.FC<MobileAppViewProps> = ({
  selectedPage,
  threads,
  orders,
  products,
  isOnline,
  onSendMessage,
  onSelectThread,
  selectedThreadId,
  onOpenCreateOrder,
  onViewOrderInvoice,
  onUpdateOrderStatus,
  isGlobalMobileFrame,
  onToggleGlobalMobileFrame,
  language,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [phoneTab, setPhoneTab] = useState<'inbox' | 'chat' | 'orders' | 'sales' | 'products'>('inbox');
  const [quickMsgText, setQuickMsgText] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [installNotice, setInstallNotice] = useState<string | null>(null);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const activeThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) || threads[0] || null,
    [threads, selectedThreadId]
  );

  // Calculate 1-Day (Today) and 1-Month (Current Month) sales for the mobile dashboard
  const mobileSalesStats = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const monthStr = todayStr.slice(0, 7);

    let todayUsd = 0;
    let todayKhr = 0;
    let todayCount = 0;

    let monthUsd = 0;
    let monthKhr = 0;
    let monthCount = 0;

    orders.forEach((o) => {
      if (o.status === 'cancelled') return;
      const d = resolveOrderDate(o);
      if (d === todayStr) {
        todayUsd += o.total || 0;
        todayKhr += o.totalKhr || 0;
        todayCount += 1;
      }
      if (d.slice(0, 7) === monthStr) {
        monthUsd += o.total || 0;
        monthKhr += o.totalKhr || 0;
        monthCount += 1;
      }
    });

    return {
      todayUsd,
      todayKhr,
      todayCount,
      monthUsd,
      monthKhr,
      monthCount,
    };
  }, [orders]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PageChat Pro Mobile App',
          text: 'កម្មវិធីគ្រប់គ្រងឆាតផេក លក់ទំនិញ និងវិក្កយបត្រលើទូរស័ព្ទដៃ',
          url: appUrl,
        });
      } catch {
        // user cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  const handleMobileInstall = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setInstallNotice(
        language === 'kh'
          ? 'សម្រាប់ iPhone/iPad៖ សូមចុចប៊ូតុង Share ក្នុង Safari រួចជ្រើសរើស "Add to Home Screen"'
          : 'On iPhone/iPad: Tap the Share button in Safari and select "Add to Home Screen"'
      );
    } else {
      setInstallNotice(
        language === 'kh'
          ? 'សូមបើកតំណភ្ជាប់នេះក្នុងកម្មវិធី Chrome ឬ Safari លើទូរស័ព្ទ រួចចុច "Install App" ឬ "Add to Home Screen"'
          : 'Open this link in Chrome or Safari on your phone and tap "Install App" or "Add to Home Screen"'
      );
    }
  };

  const [isRecordingMobileVoice, setIsRecordingMobileVoice] = useState(false);
  const [mobileRecSeconds, setMobileRecSeconds] = useState(0);
  const [playingMobileAudioId, setPlayingMobileAudioId] = useState<string | null>(null);
  const mobileMediaRecRef = useRef<MediaRecorder | null>(null);
  const mobileChunksRef = useRef<Blob[]>([]);
  const mobileTimerRef = useRef<number | null>(null);
  const mobileSpeechRecRef = useRef<any>(null);
  const mobileLiveTranscriptRef = useRef<string>('');
  const mobileAudioElRef = useRef<HTMLAudioElement | null>(null);

  const handleSendMobileTextAsVoice = () => {
    const voiceText =
      quickMsgText.trim() ||
      'ចាស៎បង! ម៉ូដនេះមានក្នុងស្តុក អាចកម្ម៉ង់បានបងចា៎!';
    const durSec = Math.max(2, Math.min(25, Math.ceil(voiceText.length / 12)));
    const durationFormatted = `0:${String(durSec).padStart(2, '0')}`;
    const wavUrl = createMobilePlayableWavDataUrl(durSec);
    onSendMessage(`🎤 សារសម្លេង (${durationFormatted}): ${voiceText}`, [
      {
        type: 'audio',
        data: {
          url: wavUrl,
          duration: durationFormatted,
          transcript: voiceText,
        },
      },
    ]);
    setQuickMsgText('');
  };

  const handleToggleMobileVoiceRecord = async () => {
    if (isRecordingMobileVoice) {
      if (mobileTimerRef.current) {
        window.clearInterval(mobileTimerRef.current);
        mobileTimerRef.current = null;
      }
      if (mobileSpeechRecRef.current) {
        try {
          mobileSpeechRecRef.current.stop();
        } catch {}
      }
      if (mobileMediaRecRef.current && mobileMediaRecRef.current.state !== 'inactive') {
        mobileMediaRecRef.current.stop();
      } else {
        const durSec = Math.max(2, mobileRecSeconds || 3);
        const durationFormatted = `0:${String(durSec).padStart(2, '0')}`;
        const text =
          mobileLiveTranscriptRef.current.trim() ||
          quickMsgText.trim() ||
          'ចាស៎បង! សារសម្លេងឆ្លើយតប';
        const wavUrl = createMobilePlayableWavDataUrl(durSec);
        onSendMessage(`🎤 សារសម្លេង (${durationFormatted}): ${text}`, [
          {
            type: 'audio',
            data: {
              url: wavUrl,
              duration: durationFormatted,
              transcript: text,
            },
          },
        ]);
        setQuickMsgText('');
        mobileLiveTranscriptRef.current = '';
      }
      setIsRecordingMobileVoice(false);
      setMobileRecSeconds(0);
      return;
    }

    mobileLiveTranscriptRef.current = '';
    setMobileRecSeconds(0);
    setIsRecordingMobileVoice(true);

    const startTime = Date.now();
    mobileTimerRef.current = window.setInterval(() => {
      setMobileRecSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 500);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = language === 'kh' ? 'km-KH' : 'en-US';
        rec.onresult = (event: any) => {
          const t = Array.from(event.results)
            .map((r: any) => r[0].transcript)
            .join('')
            .trim();
          if (t) mobileLiveTranscriptRef.current = t;
        };
        mobileSpeechRecRef.current = rec;
        rec.start();
      } catch {}
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mobileChunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) mobileChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const durSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
          const durationFormatted = `0:${String(Math.min(59, durSec)).padStart(2, '0')}`;
          const blob = new Blob(mobileChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = (reader.result as string) || createMobilePlayableWavDataUrl(durSec);
            const browserCaptured = mobileLiveTranscriptRef.current.trim();
            const recognizedText =
              quickMsgText.trim() || browserCaptured || 'ចាស៎បង! សារសម្លេងឆ្លើយតប';

            onSendMessage(`🎤 សារសម្លេង (${durationFormatted}): ${recognizedText}`, [
              {
                type: 'audio',
                data: {
                  url: base64Audio,
                  duration: durationFormatted,
                  transcript: recognizedText,
                },
              },
            ]);
            setQuickMsgText('');
            mobileLiveTranscriptRef.current = '';
          };
          reader.readAsDataURL(blob);
        };
        mobileMediaRecRef.current = recorder;
        recorder.start();
      } catch {}
    }
  };

  const handlePlayMobileAudio = (msgId: string, audioUrl?: string, transcript?: string) => {
    if (playingMobileAudioId === msgId) {
      if (mobileAudioElRef.current) {
        mobileAudioElRef.current.pause();
      }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setPlayingMobileAudioId(null);
      return;
    }
    if (mobileAudioElRef.current) {
      mobileAudioElRef.current.pause();
    }
    setPlayingMobileAudioId(msgId);
    const effectiveUrl = audioUrl || createMobilePlayableWavDataUrl(3);
    const audio = new Audio(effectiveUrl);
    mobileAudioElRef.current = audio;
    audio.onended = () => setPlayingMobileAudioId(null);
    audio.onerror = () => {
      if ('speechSynthesis' in window && transcript) {
        const u = new SpeechSynthesisUtterance(transcript);
        u.lang = 'km-KH';
        u.onend = () => setPlayingMobileAudioId(null);
        window.speechSynthesis.speak(u);
      } else {
        setPlayingMobileAudioId(null);
      }
    };
    audio.play().catch(() => {
      if ('speechSynthesis' in window && transcript) {
        const u = new SpeechSynthesisUtterance(transcript);
        u.lang = 'km-KH';
        u.onend = () => setPlayingMobileAudioId(null);
        window.speechSynthesis.speak(u);
      } else {
        setPlayingMobileAudioId(null);
      }
    });
  };

  const handleSendQuickMobileMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMsgText.trim()) return;
    onSendMessage(quickMsgText.trim());
    setQuickMsgText('');
  };

  const qrCodeSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
    appUrl || 'https://pagechat.pro'
  )}`;

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-200 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {language === 'kh'
                ? 'កម្មវិធីសម្រាប់ទូរស័ព្ទដៃ (PageChat Pro Mobile App)'
                : 'PageChat Pro Mobile App (iOS & Android)'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'kh'
                ? 'ប្រើប្រាស់កម្មវិធីលើទូរស័ព្ទដៃ iPhone និង Android ដើម្បីឆ្លើយឆាត បង្កើតវិក្កយបត្រ និងមើលរបាយការណ៍លក់ ១ថ្ងៃ/១ខែ បានគ្រប់ទីកន្លែង'
                : 'Manage chats, create invoices, and track daily/monthly sales from your iPhone or Android smartphone'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={onToggleGlobalMobileFrame}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isGlobalMobileFrame
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isGlobalMobileFrame ? (
                <>
                  <Maximize2 className="w-4 h-4" />
                  <span>
                    {language === 'kh'
                      ? 'ត្រឡប់ទៅអេក្រង់ធំ (Desktop)'
                      : 'Switch to Full Screen'}
                  </span>
                </>
              ) : (
                <>
                  <Minimize2 className="w-4 h-4" />
                  <span>
                    {language === 'kh'
                      ? 'ប្តូរអេក្រង់ទៅជាទម្រង់ទូរស័ព្ទដៃ'
                      : 'Switch Workspace to Phone View'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Interactive Live Smartphone App Simulator (5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="mb-3 flex items-center justify-between w-full max-w-[380px]">
            <span className="text-xs font-bold text-slate-700">
              {language === 'kh'
                ? 'ទូរស័ព្ទដៃផ្ទាល់ (អាចចុចប្រើប្រាស់បានភ្លាមៗ)'
                : 'Interactive Mobile App Preview'}
            </span>
            <span className="text-xs text-slate-500">
              {isOnline ? 'Online' : 'Offline Editable'}
            </span>
          </div>

          {/* Realistic Smartphone Shell (375x740) */}
          <div className="w-full max-w-[380px] h-[720px] bg-slate-900 rounded-[44px] p-3 shadow-xl border-4 border-slate-800 flex flex-col relative overflow-hidden">
            {/* Top Speaker Notch */}
            <div className="w-28 h-5 bg-slate-950 rounded-full mx-auto mb-1.5 flex items-center justify-center shrink-0">
              <div className="w-10 h-1 bg-slate-800 rounded-full" />
            </div>

            {/* Inner Mobile Screen */}
            <div className="flex-1 bg-slate-50 rounded-[32px] overflow-hidden flex flex-col border border-slate-800/20">
              {/* Mobile App Top Bar */}
              <div className="h-13 px-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  {phoneTab === 'chat' ? (
                    <button
                      type="button"
                      onClick={() => setPhoneTab('inbox')}
                      className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      title="ត្រឡប់មកប្រអប់ដើមវិញ (Back to Main Inbox)"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{language === 'kh' ? 'មកប្រអប់ដើមវិញ' : 'Main Inbox'}</span>
                    </button>
                  ) : (
                    <img
                      src={resolvePageOriginalAvatar(selectedPage)}
                      alt={selectedPage.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = buildClientFallbackAvatarDataUrl(
                          selectedPage.name,
                          'FB Page'
                        );
                      }}
                      className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">
                      {phoneTab === 'chat' && activeThread
                        ? activeThread.customer.name
                        : selectedPage.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {phoneTab === 'chat' && activeThread
                        ? `${activeThread.customer.phone} · រូបដើមពីផេក`
                        : language === 'kh'
                        ? 'កម្មវិធីទូរស័ព្ទដៃ PageChat Pro'
                        : 'PageChat Pro Mobile'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenCreateOrder}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === 'kh' ? 'បុងថ្មី' : 'Order'}</span>
                </button>
              </div>

              {/* Mobile Screen Body */}
              <div className="flex-1 overflow-y-auto">
                {/* 1. MOBILE INBOX TAB */}
                {phoneTab === 'inbox' && (
                  <div className="divide-y divide-slate-100 bg-white">
                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        {language === 'kh'
                          ? `ប្រអប់សារអតិថិជន (${threads.length})`
                          : `Customer Chats (${threads.length})`}
                      </span>
                      <span className="text-[11px] text-blue-600 font-semibold">
                        {language === 'kh' ? 'ចុចដើម្បីឆ្លើយតប' : 'Tap to reply'}
                      </span>
                    </div>
                    {threads.map((th) => (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => {
                          onSelectThread(th.id);
                          setPhoneTab('chat');
                        }}
                        className="w-full p-3.5 flex items-center gap-3 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left cursor-pointer"
                      >
                        <div className="relative shrink-0">
                          <img
                            src={resolveCustomerOriginalPageAvatar(th.customer, selectedPage)}
                            alt={th.customer.name}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.src = buildClientFallbackAvatarDataUrl(
                                th.customer.name,
                                selectedPage?.name
                              );
                            }}
                            className="w-11 h-11 rounded-full object-cover border-2 border-blue-500/30 bg-slate-100"
                          />
                          <img
                            src={resolvePageOriginalAvatar(selectedPage)}
                            alt={selectedPage.name}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.src = buildClientFallbackAvatarDataUrl(
                                selectedPage?.name,
                                'FB Page'
                              );
                            }}
                            className="w-4.5 h-4.5 rounded-full object-cover border border-white absolute -bottom-0.5 -right-0.5 bg-white shadow-2xs"
                          />
                          {th.unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                              {th.unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {th.customer.name}
                            </p>
                            <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                              {th.lastMessageTime}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 truncate mt-0.5">
                            {th.lastMessage}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                            <span>{th.customer.province}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{th.customer.phone}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* 2. MOBILE ACTIVE CHAT TAB */}
                {phoneTab === 'chat' && activeThread && (
                  <div className="flex flex-col h-full bg-slate-100">
                    {/* Customer Quick Strip */}
                    <div className="px-3 py-1.5 bg-white border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600 shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPhoneTab('inbox')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10px] shrink-0 cursor-pointer"
                      >
                        <ArrowLeft className="w-3 h-3 text-blue-600" />
                        <span>{language === 'kh' ? 'មកប្រអប់ដើមវិញ' : 'Main Inbox'}</span>
                      </button>
                      <span className="flex items-center gap-1 truncate">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span className="tabular-nums font-medium">
                          {activeThread.customer.phone}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={onOpenCreateOrder}
                        className="text-blue-600 font-bold hover:underline shrink-0 cursor-pointer"
                      >
                        {language === 'kh' ? '+ កត់បុងទំនិញ' : '+ Create Order'}
                      </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
                      {activeThread.messages.map((m) => {
                        const isCustomer = m.sender === 'customer';
                        const orderAtt = m.attachments?.find((a) => a.type === 'order_invoice');
                        const audioAtt = m.attachments?.find((a) => a.type === 'audio');
                        const custAvatar = resolveCustomerOriginalPageAvatar(
                          activeThread.customer,
                          selectedPage
                        );
                        const pageAvatar = resolvePageOriginalAvatar(selectedPage);
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${
                              isCustomer ? 'items-start' : 'items-end'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-0.5 px-1">
                              {isCustomer ? (
                                <div className="relative flex items-center shrink-0">
                                  <img
                                    src={custAvatar}
                                    alt={activeThread.customer.name}
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      e.currentTarget.src = buildClientFallbackAvatarDataUrl(
                                        activeThread.customer.name,
                                        selectedPage?.name
                                      );
                                    }}
                                    className="w-5 h-5 rounded-full object-cover border border-blue-400"
                                  />
                                  <img
                                    src={pageAvatar}
                                    alt={selectedPage.name}
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      e.currentTarget.src = buildClientFallbackAvatarDataUrl(
                                        selectedPage?.name,
                                        'FB Page'
                                      );
                                    }}
                                    className="w-3 h-3 rounded-full object-cover border border-white -ml-1.5 mt-1.5 bg-white"
                                  />
                                </div>
                              ) : (
                                <img
                                  src={pageAvatar}
                                  alt={selectedPage.name}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    e.currentTarget.src = buildClientFallbackAvatarDataUrl(
                                      selectedPage?.name,
                                      'FB Page'
                                    );
                                  }}
                                  className="w-4.5 h-4.5 rounded-full object-cover border border-blue-300"
                                />
                              )}
                              <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[140px]">
                                {isCustomer ? activeThread.customer.name : selectedPage.name.split(' - ')[0]}
                              </span>
                            </div>
                            <div
                              className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                                isCustomer
                                  ? 'bg-white text-slate-900 border border-slate-200 rounded-tl-xs'
                                  : 'bg-blue-600 text-white rounded-tr-xs'
                              }`}
                            >
                              <p className="break-words">{m.text}</p>
                              {audioAtt && (
                                <div className="mt-1.5 pt-1.5 border-t border-current/15 flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handlePlayMobileAudio(
                                        m.id,
                                        audioAtt.data?.url,
                                        audioAtt.data?.transcript
                                      )
                                    }
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                                      isCustomer
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-white text-blue-700'
                                    }`}
                                  >
                                    {playingMobileAudioId === m.id ? (
                                      <Pause className="w-3 h-3" />
                                    ) : (
                                      <Play className="w-3 h-3" />
                                    )}
                                    <span>{audioAtt.data?.duration || '0:04'}</span>
                                  </button>
                                  {audioAtt.data?.transcript && (
                                    <span className="text-[10px] italic truncate">
                                      "{audioAtt.data.transcript}"
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {orderAtt && orderAtt.data && (
                              <div className="mt-1.5 w-60 bg-white border-2 border-emerald-500 rounded-xl p-2.5 shadow-xs text-slate-900">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                                  <span className="text-[11px] font-bold text-emerald-700">
                                    បុង #{orderAtt.data.orderNumber}
                                  </span>
                                  <span className="text-xs font-extrabold text-slate-900 tabular-nums">
                                    ${Number(orderAtt.data.total || 0).toFixed(2)}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-600 truncate mb-2">
                                  {orderAtt.data.customerName} · {orderAtt.data.customerPhone}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => onViewOrderInvoice(orderAtt.data.id)}
                                  className="w-full py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Receipt className="w-3 h-3" />
                                  <span>{language === 'kh' ? 'មើលវិក្កយបត្រក្នុងការបញ្ជាទិញ' : 'View Order Invoice'}</span>
                                </button>
                              </div>
                            )}
                            <span className="text-[9px] text-slate-400 mt-0.5 px-1 tabular-nums">
                              {m.timestamp}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mobile Message Composer */}
                    <form
                      onSubmit={handleSendQuickMobileMessage}
                      className="p-2 bg-white border-t border-slate-200 flex items-center gap-1.5 shrink-0"
                    >
                      <button
                        type="button"
                        onClick={onOpenCreateOrder}
                        className="px-2.5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                        title="បង្កើតការបញ្ជាទិញ (Create Order)"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>{language === 'kh' ? '+ បុង' : '+ Order'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleMobileVoiceRecord}
                        className={`px-2 py-2 rounded-full text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer transition-colors ${
                          isRecordingMobileVoice
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                        title="ថតផ្ញើសារសម្លេងទៅវិញក្នុងប្រអប់សារ"
                      >
                        {isRecordingMobileVoice ? (
                          <Square className="w-3 h-3" />
                        ) : (
                          <Mic className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isRecordingMobileVoice
                            ? `${mobileRecSeconds}s`
                            : '🎙️'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSendMobileTextAsVoice}
                        className="px-2 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                        title="ផ្ញើអក្សរជាសម្លេង (Send Voice Reply)"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Voice</span>
                      </button>
                      <input
                        type="text"
                        value={quickMsgText}
                        onChange={(e) => setQuickMsgText(e.target.value)}
                        placeholder={
                          isRecordingMobileVoice
                            ? 'កំពុងថតសម្លេង...'
                            : language === 'kh'
                            ? 'វាយសារ ឬចុច Voice ទៅវិញ...'
                            : 'Type reply or tap Voice...'
                        }
                        className="flex-1 px-2.5 py-2 text-xs bg-slate-100 rounded-full focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 min-w-0"
                      />
                      <button
                        type="submit"
                        className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 hover:bg-blue-700 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                )}

                {/* 3. MOBILE ORDERS TAB */}
                {phoneTab === 'orders' && (
                  <div className="p-3 space-y-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-800">
                        {language === 'kh'
                          ? `បញ្ជីការកុម្ម៉ង់ (${orders.length})`
                          : `Orders (${orders.length})`}
                      </span>
                      <button
                        type="button"
                        onClick={onOpenCreateOrder}
                        className="text-xs font-bold text-blue-600 cursor-pointer"
                      >
                        {language === 'kh' ? '+ បង្កើតបុងថ្មី' : '+ New Order'}
                      </button>
                    </div>

                    {orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3 bg-white border border-slate-200 rounded-2xl space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-blue-600 tabular-nums">
                              #{ord.orderNumber}
                            </span>
                            <span className="mx-1.5 text-slate-300">·</span>
                            <span className="text-xs font-bold text-slate-900">
                              {ord.customerName}
                            </span>
                          </div>
                          <span className="text-xs font-extrabold text-slate-900 tabular-nums">
                            ${ord.total.toFixed(2)}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 truncate">
                          {(ord.items || [])
                            .map((i) => `${i.name} ×${i.quantity}`)
                            .join(', ')}
                        </p>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                          <select
                            value={ord.status}
                            onChange={(e) =>
                              onUpdateOrderStatus(
                                ord.id,
                                e.target.value as OrderStatus
                              )
                            }
                            className="text-[11px] font-semibold bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:outline-none cursor-pointer"
                          >
                            <option value="pending">
                              {language === 'kh' ? 'រង់ចាំ (Pending)' : 'Pending'}
                            </option>
                            <option value="packaging">
                              {language === 'kh' ? 'កំពុងខ្ចប់' : 'Packaging'}
                            </option>
                            <option value="shipped">
                              {language === 'kh' ? 'កំពុងដឹក' : 'Shipping'}
                            </option>
                            <option value="delivered">
                              {language === 'kh' ? 'ដឹកជោគជ័យ' : 'Delivered'}
                            </option>
                            <option value="cancelled">
                              {language === 'kh' ? 'បោះបង់' : 'Cancelled'}
                            </option>
                          </select>

                          <button
                            type="button"
                            onClick={() => onViewOrderInvoice(ord.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Receipt className="w-3 h-3" />
                            <span>
                              {language === 'kh' ? 'មើលវិក្កយបត្រ' : 'Invoice'}
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 4. MOBILE SALES REPORT (1 DAY & 1 MONTH) TAB */}
                {phoneTab === 'sales' && (
                  <div className="p-3 space-y-3">
                    <div className="p-3.5 rounded-2xl bg-slate-900 text-white space-y-1">
                      <span className="text-[11px] text-slate-400">
                        {language === 'kh'
                          ? 'ចំណូលលក់សរុបថ្ងៃនេះ (១ ថ្ងៃ)'
                          : "Today's Sales (1 Day)"}
                      </span>
                      <p className="text-2xl font-extrabold tabular-nums">
                        ${mobileSalesStats.todayUsd.toFixed(2)}
                      </p>
                      <p className="text-xs text-emerald-400 font-semibold tabular-nums">
                        {mobileSalesStats.todayKhr.toLocaleString()} រៀល ·{' '}
                        {mobileSalesStats.todayCount}{' '}
                        {language === 'kh' ? 'បុង' : 'orders'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1">
                      <span className="text-[11px] text-slate-500">
                        {language === 'kh'
                          ? 'ចំណូលលក់សរុបខែនេះ (១ ខែ)'
                          : 'This Month Sales (1 Month)'}
                      </span>
                      <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
                        ${mobileSalesStats.monthUsd.toFixed(2)}
                      </p>
                      <p className="text-xs text-emerald-700 font-semibold tabular-nums">
                        {mobileSalesStats.monthKhr.toLocaleString()} រៀល ·{' '}
                        {mobileSalesStats.monthCount}{' '}
                        {language === 'kh' ? 'បុងក្នុងខែនេះ' : 'orders'}
                      </p>
                    </div>
                  </div>
                )}

                {/* 5. MOBILE PRODUCTS TAB */}
                {phoneTab === 'products' && (
                  <div className="p-3 space-y-2.5">
                    {products.map((prod) => (
                      <div
                        key={prod.id}
                        className="p-2.5 bg-white border border-slate-200 rounded-2xl flex items-center gap-3"
                      >
                        <img
                          src={prod.imageUrl}
                          alt={prod.nameKh}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-xl object-cover border border-slate-100 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {prod.nameKh}
                          </p>
                          <p className="text-xs font-extrabold text-blue-600 tabular-nums mt-0.5">
                            ${prod.price.toFixed(2)} ·{' '}
                            {prod.priceKhr.toLocaleString()} ៛
                          </p>
                          <p className="text-[10px] text-slate-500 tabular-nums">
                            {language === 'kh' ? 'ស្តុកនៅសល់៖ ' : 'Stock: '}
                            {prod.stock}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile Simulator Bottom Navigation Bar */}
              <div className="h-14 bg-white border-t border-slate-200 grid grid-cols-4 items-center px-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setPhoneTab('inbox')}
                  className={`flex flex-col items-center justify-center py-1 rounded-xl cursor-pointer ${
                    phoneTab === 'inbox' || phoneTab === 'chat'
                      ? 'text-blue-600'
                      : 'text-slate-500'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-[10px] font-semibold mt-0.5">
                    {language === 'kh' ? 'ឆាត' : 'Chat'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPhoneTab('orders')}
                  className={`flex flex-col items-center justify-center py-1 rounded-xl cursor-pointer ${
                    phoneTab === 'orders' ? 'text-blue-600' : 'text-slate-500'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span className="text-[10px] font-semibold mt-0.5">
                    {language === 'kh' ? 'ការកុម្ម៉ង់' : 'Orders'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPhoneTab('sales')}
                  className={`flex flex-col items-center justify-center py-1 rounded-xl cursor-pointer ${
                    phoneTab === 'sales' ? 'text-blue-600' : 'text-slate-500'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="text-[10px] font-semibold mt-0.5">
                    {language === 'kh' ? 'ចំណូល' : 'Sales'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPhoneTab('products')}
                  className={`flex flex-col items-center justify-center py-1 rounded-xl cursor-pointer ${
                    phoneTab === 'products' ? 'text-blue-600' : 'text-slate-500'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span className="text-[10px] font-semibold mt-0.5">
                    {language === 'kh' ? 'ទំនិញ' : 'Items'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Install on Real Smartphone (QR Code, Android & iPhone Guides) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Scan QR or One-Click Install on Smartphone */}
          <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {language === 'kh'
                    ? '០១. ស្កេន QR Code ដើម្បីដាក់កម្មវិធីលើទូរស័ព្ទដៃ (iPhone & Android)'
                    : '01. Scan QR Code to Install on Your Phone'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {language === 'kh'
                    ? 'បើកកាមេរ៉ាទូរស័ព្ទ iPhone ឬ Android ស្កេនកូដ QR ខាងក្រោម ដើម្បីបើកកម្មវិធី PageChat Pro លើទូរស័ព្ទដៃរបស់អ្នក និងដាក់លើអេក្រង់ Home Screen។'
                    : 'Point your iPhone or Android camera at the QR code below to launch and install PageChat Pro on your smartphone.'}
                </p>
              </div>
            </div>

            {installNotice && (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-medium text-blue-900 flex items-center justify-between gap-2">
                <span>{installNotice}</span>
                <button
                  type="button"
                  onClick={() => setInstallNotice(null)}
                  className="text-blue-700 font-bold px-2 py-0.5 cursor-pointer"
                >
                  OK
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center pt-2">
              {/* QR Code Container */}
              <div className="sm:col-span-5 flex flex-col items-center p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="w-44 h-44 bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-center relative">
                  <img
                    src={qrCodeSvgUrl}
                    alt="QR Code for Mobile App"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <QrCode className="w-10 h-10 text-slate-300 absolute -z-10" />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 mt-2.5">
                  {language === 'kh'
                    ? 'ស្កេនតាមកាមេរ៉ាទូរស័ព្ទដៃ'
                    : 'Scan with Phone Camera'}
                </span>
              </div>

              {/* Action Buttons & URL Copy */}
              <div className="sm:col-span-7 space-y-3">
                <button
                  type="button"
                  onClick={handleMobileInstall}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {isInstalled
                      ? language === 'kh'
                        ? 'បានតម្លើងកម្មវិធីរួចរាល់'
                        : 'App Installed on Device'
                      : language === 'kh'
                      ? 'តម្លើងកម្មវិធីលើទូរស័ព្ទឥឡូវនេះ (Install Mobile App)'
                      : 'Install Mobile App Now'}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">
                          {language === 'kh' ? 'បានចម្លងតំណភ្ជាប់!' : 'Copied Link!'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>
                          {language === 'kh' ? 'ចម្លងតំណភ្ជាប់ទៅទូរស័ព្ទ' : 'Copy App Link'}
                        </span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleShareLink}
                    className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{language === 'kh' ? 'ចែករំលែក' : 'Share'}</span>
                  </button>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">
                    {language === 'kh'
                      ? 'ដំណើរការទាំង Online និង Offline លើទូរស័ព្ទដៃ៖'
                      : 'Works Online & Offline on Mobile:'}
                  </p>
                  <p>
                    {language === 'kh'
                      ? 'ទិន្នន័យការកុម្ម៉ង់ វិក្កយបត្រ និងសារឆាត ត្រូវបានរក្សាទុកក្នុងទូរស័ព្ទ និង Sync ជាមួយកុំព្យូទ័រដោយស្វ័យប្រវត្តិ។'
                      : 'Orders, invoices, and messages are stored on your phone and sync automatically.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Step-by-Step Guide for Android & iPhone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3">
              <h4 className="text-sm font-bold text-slate-900">
                {language === 'kh'
                  ? '០២. សម្រាប់ទូរស័ព្ទ Android (Samsung, Oppo, Vivo, Xiaomi)'
                  : '02. For Android Smartphones'}
              </h4>
              <ol className="space-y-2 text-xs text-slate-600 list-decimal list-inside leading-relaxed">
                <li>
                  {language === 'kh'
                    ? 'បើកកម្មវិធី Chrome លើទូរស័ព្ទ Android រួចស្កេន QR Code ខាងលើ។'
                    : 'Open Chrome on your Android phone and scan the QR code.'}
                </li>
                <li>
                  {language === 'kh'
                    ? 'ចុចប៊ូតុង "តម្លើងកម្មវិធី (Install App)" ឬចុចសញ្ញាចុចបីគ្រាប់ (⋮) នៅជ្រុងខាងលើ។'
                    : 'Tap "Install App" or tap the 3-dot menu (⋮) in the top right.'}
                </li>
                <li>
                  {language === 'kh'
                    ? 'ជ្រើសរើស "Install App" ឬ "Add to Home screen" ដើម្បីទទួលបាន App ពេញអេក្រង់លើទូរស័ព្ទ។'
                    : 'Select "Install App" to add the full-screen icon to your phone.'}
                </li>
              </ol>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3">
              <h4 className="text-sm font-bold text-slate-900">
                {language === 'kh'
                  ? '០៣. សម្រាប់ទូរស័ព្ទ iPhone & iPad (iOS Safari)'
                  : '03. For iPhone & iPad (iOS Safari)'}
              </h4>
              <ol className="space-y-2 text-xs text-slate-600 list-decimal list-inside leading-relaxed">
                <li>
                  {language === 'kh'
                    ? 'បើកកម្មវិធី Safari លើ iPhone រួចស្កេន QR Code ឬបើកតំណភ្ជាប់។'
                    : 'Open Safari on your iPhone and scan the QR code.'}
                </li>
                <li>
                  {language === 'kh'
                    ? 'ចុចប៊ូតុង Share (សញ្ញាប្រអប់មានព្រួញឡើងលើ) នៅរបារខាងក្រោម។'
                    : 'Tap the Share button at the bottom of Safari.'}
                </li>
                <li>
                  {language === 'kh'
                    ? 'អូសចុះក្រោម រួចចុច "Add to Home Screen" រួចចុច "Add" ជាការស្រេច។'
                    : 'Scroll down and tap "Add to Home Screen", then tap "Add".'}
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
