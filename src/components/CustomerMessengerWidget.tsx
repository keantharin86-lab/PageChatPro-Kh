import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  Send,
  X,
  Minimize2,
  Maximize2,
  Bot,
  Radio,
  UserPlus,
  CheckCheck,
  KeyRound,
  CheckCircle2,
  Image as ImageIcon,
  Volume2,
  Play,
  Pause,
} from 'lucide-react';
import { ChatThread, PageAccount } from '../types';

const WIDGET_FALLBACK_IMAGE_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="260" viewBox="0 0 360 260">
      <rect width="360" height="260" rx="18" fill="#eff6ff"/>
      <circle cx="115" cy="88" r="24" fill="#93c5fd"/>
      <path d="M40 215 L130 125 L205 190 L260 140 L320 215 Z" fill="#60a5fa"/>
      <text x="180" y="242" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="bold" fill="#1e40af">រូបភាពក្នុងឆាត (Messenger Image)</text>
    </svg>`
  );

function createWidgetWavDataUrl(durationSec = 3): string {
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
      const freq = 220 + 40 * Math.sin(2 * Math.PI * 2 * t);
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

interface CustomerMessengerWidgetProps {
  selectedPage: PageAccount;
  activeThread?: ChatThread;
  isAutoPilot: boolean;
  isAiAutoReplying: boolean;
  autoIncomingStream: boolean;
  onToggleAutoIncomingStream: () => void;
  onSendCustomerMessageToPage: (
    text: string,
    asNewCustomer?: boolean,
    customerName?: string,
    attachments?: any[]
  ) => void;
  onConnectRealToken?: (token: string) => Promise<boolean>;
  language: 'kh' | 'en';
}

export const CustomerMessengerWidget: React.FC<CustomerMessengerWidgetProps> = ({
  selectedPage,
  activeThread,
  isAutoPilot,
  isAiAutoReplying,
  autoIncomingStream,
  onToggleAutoIncomingStream,
  onSendCustomerMessageToPage,
  onConnectRealToken,
  language,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [customerInput, setCustomerInput] = useState<string>('');
  const [customSenderName, setCustomSenderName] = useState<string>('');
  const [sendAsNewCustomer, setSendAsNewCustomer] = useState<boolean>(false);
  const [showTokenBox, setShowTokenBox] = useState<boolean>(false);
  const [tokenValue, setTokenValue] = useState<string>('');
  const [isConnectingToken, setIsConnectingToken] = useState<boolean>(false);
  const [tokenSuccess, setTokenSuccess] = useState<boolean>(false);
  const [playingWidgetAudioId, setPlayingWidgetAudioId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const widgetImageInputRef = useRef<HTMLInputElement>(null);

  const isRealGraphToken = Boolean(
    selectedPage.accessToken &&
      selectedPage.accessToken.startsWith('EAA') &&
      !selectedPage.accessToken.startsWith('EAABw_')
  );

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeThread?.messages, isOpen, isMinimized, isAiAutoReplying]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerInput.trim()) return;
    onSendCustomerMessageToPage(
      customerInput.trim(),
      sendAsNewCustomer,
      customSenderName.trim() || undefined
    );
    setCustomerInput('');
    if (sendAsNewCustomer) {
      setSendAsNewCustomer(false);
    }
  };

  // Customer uploads an image in the Messenger Widget
  const handleCustomerImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawUrl = ev.target?.result as string;
      if (!rawUrl) return;
      const img = new Image();
      img.onload = () => {
        let finalUrl = rawUrl;
        try {
          const MAX_DIM = 900;
          let w = img.width || 600;
          let h = img.height || 600;
          if (w > MAX_DIM || h > MAX_DIM) {
            if (w > h) {
              h = Math.round((h * MAX_DIM) / w);
              w = MAX_DIM;
            } else {
              w = Math.round((w * MAX_DIM) / h);
              h = MAX_DIM;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            finalUrl = canvas.toDataURL('image/jpeg', 0.85);
          }
        } catch {}

        const caption = customerInput.trim() || 'បង ម៉ូដក្នុងរូបភាពនេះតម្លៃប៉ុន្មានដែរ?';
        onSendCustomerMessageToPage(
          `📷 [រូបភាពពីអតិថិជន]: ${caption}`,
          sendAsNewCustomer,
          customSenderName.trim() || undefined,
          [{ type: 'image', data: { url: finalUrl, caption } }]
        );
        setCustomerInput('');
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Customer sends a Voice Sound message into the Page
  const handleSendCustomerVoiceSound = () => {
    const voiceText =
      customerInput.trim() || 'សួស្តីបង ម៉ូដនេះមានក្នុងស្តុកអត់? ហើយតម្លៃប៉ុន្មានដែរចា៎?';
    const wavUrl = createWidgetWavDataUrl(3.5);
    onSendCustomerMessageToPage(
      `🎤 [សារសម្លេង Voice]: "${voiceText}"`,
      sendAsNewCustomer,
      customSenderName.trim() || undefined,
      [
        {
          type: 'audio',
          data: {
            url: wavUrl,
            duration: '0:04',
            transcript: voiceText,
          },
        },
      ]
    );
    setCustomerInput('');
  };

  const quickCustomerQuestions = [
    'សួស្តីបង! ម៉ូដថ្មីនេះនៅមានស្តុកអត់បង? តម្លៃប៉ុន្មានដែរ?',
    'បងសុំកុម្ម៉ង់ ១ ឈុត ដឹកមកភ្នំពេញ លេខទូរស័ព្ទ 012 889 977',
    'បងសុំលេខកុង ABA ឬ KHQR មកខ្ញុំវេលុយជូនឥឡូវនេះ',
    'ផ្ញើតាម J&T ទៅខេត្តសៀមរាប គិតថ្លៃដឹកប៉ុន្មានដែរចា៎?',
  ];

  const handleSaveToken = async () => {
    if (!tokenValue.trim() || !onConnectRealToken) return;
    setIsConnectingToken(true);
    try {
      const ok = await onConnectRealToken(tokenValue.trim());
      if (ok) {
        setTokenSuccess(true);
        setTokenValue('');
        setTimeout(() => {
          setTokenSuccess(false);
          setShowTokenBox(false);
        }, 2000);
      }
    } finally {
      setIsConnectingToken(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setIsMinimized(false);
        }}
        className="fixed bottom-4 right-4 z-40 px-4 py-2.5 rounded-full bg-gradient-to-r from-[#0084FF] to-[#00C6FF] hover:from-[#0073E6] hover:to-[#00B2E6] text-white font-bold text-xs shadow-xl flex items-center gap-2 cursor-pointer border-2 border-white transition-transform hover:scale-105"
      >
        <MessageCircle className="w-4 h-4 fill-white" />
        <span>📱 បើកផ្ទាំងភ្ញៀវឆាតចូលផេក Messenger ({selectedPage.name.split(' - ')[0]})</span>
        <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
      </button>
    );
  }

  return (
    <div
      className={`fixed right-3 bottom-3 z-40 bg-white rounded-2xl shadow-2xl border-2 border-[#0084FF]/40 flex flex-col overflow-hidden transition-all duration-200 ${
        isMinimized ? 'w-80 h-14' : 'w-84 sm:w-92 h-[490px] max-h-[84vh]'
      }`}
    >
      {/* Hidden Image Input for Customer Messenger Widget */}
      <input
        type="file"
        ref={widgetImageInputRef}
        onChange={handleCustomerImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Messenger Blue Header */}
      <div className="bg-gradient-to-r from-[#0084FF] to-[#0099FF] text-white px-3.5 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <img
              src={
                selectedPage.avatar ||
                'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=200&q=80'
              }
              alt={selectedPage.name}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-cover border-2 border-white"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0084FF]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-extrabold truncate">
                📱 Messenger: {selectedPage.name.split(' - ')[0]}
              </p>
              <span className="text-[9px] font-black bg-white/20 px-1.5 py-0.2 rounded-full uppercase">
                Live
              </span>
            </div>
            <p className="text-[10px] text-blue-100 truncate">
              {language === 'kh'
                ? 'គាំទ្រសារអក្សរ, រូបភាព និងសារសម្លេង (Voice Sound)'
                : 'Supports Text, Photos & Voice Sound'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
            title={isMinimized ? 'ពង្រីក' : 'បង្រួម'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="បិទផ្ទាំងនេះ"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Auto-Stream & Mode Controls Bar */}
          <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 space-y-1.5 shrink-0">
            <div className="flex items-center justify-between gap-1.5">
              <button
                type="button"
                onClick={onToggleAutoIncomingStream}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  autoIncomingStream
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
                title="ឱ្យមានសារអតិថិជនឆាតចូលផេកដោយស្វ័យប្រវត្តិ (Auto) រៀងរាល់ ១៥ វិនាទី"
              >
                <Radio className={`w-3 h-3 ${autoIncomingStream ? 'animate-spin' : 'text-emerald-600'}`} />
                <span>
                  {autoIncomingStream
                    ? 'សារភ្ញៀវចូល Auto: កំពុងបើក (ON)'
                    : 'បើកសារភ្ញៀវចូល Auto'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSendAsNewCustomer(!sendAsNewCustomer)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  sendAsNewCustomer
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
                title="ផ្ញើសារក្នុងនាមអតិថិជនថ្មីចូលផេក"
              >
                <UserPlus className="w-3 h-3" />
                <span>{sendAsNewCustomer ? 'ភ្ញៀវថ្មី' : 'ភ្ញៀវបច្ចុប្បន្ន'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTokenBox(!showTokenBox)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  isRealGraphToken
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
                title="ភ្ជាប់ Facebook Page Access Token ពិត (EAA...)"
              >
                <KeyRound className="w-3 h-3" />
                <span>{isRealGraphToken ? 'FB Token ពិត ✓' : 'Token ផេកពិត'}</span>
              </button>
            </div>

            {sendAsNewCustomer && (
              <input
                type="text"
                value={customSenderName}
                onChange={(e) => setCustomSenderName(e.target.value)}
                placeholder="ឈ្មោះភ្ញៀវថ្មីលើ Messenger (ឧ. សុខ មាលា)..."
                className="w-full px-2.5 py-1 text-[11px] bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            )}

            {showTokenBox && (
              <div className="p-2 bg-white border border-blue-200 rounded-xl space-y-1.5 text-[11px]">
                <p className="text-slate-600 leading-snug">
                  ដើម្បីទាញសារពិតពីកម្មវិធី Facebook Messenger ក្រៅរៀងរាល់ ៣ វិនាទី សូមបិទភ្ជាប់{' '}
                  <span className="font-bold text-slate-800">Page Access Token (EAA...)</span>៖
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tokenValue}
                    onChange={(e) => setTokenValue(e.target.value)}
                    placeholder="បិទភ្ជាប់ EAA... Token ទីនេះ"
                    className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveToken}
                    disabled={isConnectingToken || !tokenValue.trim()}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-lg cursor-pointer shrink-0"
                  >
                    {isConnectingToken ? '...' : 'ភ្ជាប់'}
                  </button>
                </div>
                {tokenSuccess && (
                  <p className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>បានភ្ជាប់ Token ផេកពិត និងបើក Auto-Sync រៀងរាល់ ៣ វិនាទី!</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Customer's Messenger Chat Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-100/70">
            <div className="text-center py-1">
              <span className="text-[10px] bg-blue-100/80 text-blue-800 px-2.5 py-0.5 rounded-full font-semibold">
                កំពុងឆាតជាមួយផេក «{selectedPage.name.split(' - ')[0]}» ក្នុងនាមអតិថិជន{' '}
                {sendAsNewCustomer
                  ? customSenderName || 'ភ្ញៀវថ្មី'
                  : activeThread?.customer.name || 'អតិថិជន'}
              </span>
            </div>

            {(activeThread?.messages || []).slice(-10).map((msg) => {
              const isCustomerMe = msg.sender === 'customer';
              const isBot = msg.sender === 'bot';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isCustomerMe ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[9px] text-slate-400 px-1 mb-0.5">
                    {isCustomerMe
                      ? `🙋‍♂️ ${msg.senderName || activeThread?.customer.name || 'ខ្ញុំ (ភ្ញៀវ)'}`
                      : isBot
                      ? '🤖 ផេកឆ្លើយ Auto (AI Gemini)'
                      : `💼 ${selectedPage.name.split(' - ')[0]} (Admin)`}
                  </span>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-2xs space-y-1.5 ${
                      isCustomerMe
                        ? 'bg-[#0084FF] text-white rounded-br-xs'
                        : isBot
                        ? 'bg-white text-slate-800 border border-indigo-200 rounded-bl-xs'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                    {/* Render Image, Audio, Product, and KHQR Attachments inside Customer Messenger Widget */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {msg.attachments.map((att, idx) => {
                          if (att.type === 'image') {
                            const imgUrl = att.data?.url || (att as any).url || WIDGET_FALLBACK_IMAGE_SVG;
                            return (
                              <div key={idx} className="rounded-xl overflow-hidden border border-white/20 bg-white">
                                <img
                                  src={imgUrl}
                                  alt={att.data?.caption || 'Image'}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    const src = target.getAttribute('src') || '';
                                    if (src.startsWith('http') && !src.includes('/api/facebook/proxy-media')) {
                                      target.src = `/api/facebook/proxy-media?url=${encodeURIComponent(src)}`;
                                      return;
                                    }
                                    if (src !== WIDGET_FALLBACK_IMAGE_SVG) {
                                      target.src = WIDGET_FALLBACK_IMAGE_SVG;
                                    }
                                  }}
                                  className="w-full max-h-40 object-cover block"
                                />
                              </div>
                            );
                          }

                          if (att.type === 'audio') {
                            const audUrl = att.data?.url || (att as any).url || createWidgetWavDataUrl(3);
                            const isPlaying = playingWidgetAudioId === msg.id;
                            return (
                              <div
                                key={idx}
                                className={`p-2 rounded-xl flex items-center gap-2 ${
                                  isCustomerMe ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-950 border border-indigo-200'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (playingWidgetAudioId === msg.id) {
                                      setPlayingWidgetAudioId(null);
                                      return;
                                    }
                                    setPlayingWidgetAudioId(msg.id);
                                    const audio = new Audio(audUrl);
                                    audio.onended = () => setPlayingWidgetAudioId(null);
                                    audio.onerror = () => setPlayingWidgetAudioId(null);
                                    audio.play().catch(() => setPlayingWidgetAudioId(null));
                                  }}
                                  className="w-7 h-7 rounded-full bg-white text-[#0084FF] flex items-center justify-center shrink-0 cursor-pointer shadow-2xs"
                                >
                                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                                </button>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] font-bold flex items-center gap-1">
                                    <Volume2 className="w-3 h-3" />
                                    <span>សារសម្លេង ({att.data?.duration || '0:04'})</span>
                                  </div>
                                  {att.data?.transcript && (
                                    <p className="text-[10px] opacity-90 truncate">"{att.data.transcript}"</p>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          if (att.type === 'product' && att.data) {
                            return (
                              <div key={idx} className="p-2 rounded-xl bg-slate-50 text-slate-900 border border-slate-200 flex items-center gap-2">
                                <img
                                  src={att.data.imageUrl || WIDGET_FALLBACK_IMAGE_SVG}
                                  alt={att.data.nameKh}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    e.currentTarget.src = WIDGET_FALLBACK_IMAGE_SVG;
                                  }}
                                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold truncate">{att.data.nameKh}</p>
                                  <p className="text-[10px] text-blue-600 font-extrabold">${Number(att.data.price || 0).toFixed(2)}</p>
                                </div>
                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 px-1 text-[9px] text-slate-400">
                    <span>{msg.timestamp}</span>
                    {isCustomerMe && <CheckCheck className="w-2.5 h-2.5 text-[#0084FF]" />}
                  </div>
                </div>
              );
            })}

            {isAiAutoReplying && (
              <div className="flex items-center gap-1.5 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-2xl w-fit animate-pulse">
                <Bot className="w-3.5 h-3.5 animate-bounce" />
                <span>ផេក ({selectedPage.name.split(' - ')[0]}) កំពុងវាយសារឆ្លើយតប Auto...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 1-Tap Customer Inquiry Chips */}
          <div className="bg-white border-t border-slate-100 px-2.5 py-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0">
            {quickCustomerQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  onSendCustomerMessageToPage(
                    q,
                    sendAsNewCustomer,
                    customSenderName.trim() || undefined
                  )
                }
                className="shrink-0 px-2 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-[#0084FF] border border-blue-200/80 text-[10px] font-bold transition-colors cursor-pointer"
              >
                {q.length > 26 ? `${q.slice(0, 26)}...` : q}
              </button>
            ))}
          </div>

          {/* Customer Messenger Input Form with Photo & Voice Sound buttons */}
          <form
            onSubmit={handleSubmit}
            className="bg-white border-t border-slate-200 p-2 flex items-center gap-1.5 shrink-0"
          >
            <button
              type="button"
              onClick={() => widgetImageInputRef.current?.click()}
              className="w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 text-[#0084FF] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              title="ផ្ញើរូបភាពពីអតិថិជនចូលផេក"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleSendCustomerVoiceSound}
              className="w-8 h-8 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              title="ផ្ញើសារសម្លេង (Voice Sound) ពីអតិថិជនចូលផេក"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={customerInput}
              onChange={(e) => setCustomerInput(e.target.value)}
              placeholder="វាយសារ, ផ្ញើរូប ឬសម្លេងចូលផេក..."
              className="flex-1 bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#0084FF] focus:bg-white"
            />
            <button
              type="submit"
              disabled={!customerInput.trim()}
              className="w-8 h-8 rounded-full bg-[#0084FF] hover:bg-[#0073E6] disabled:bg-slate-300 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              title="ផ្ញើសារចូលផេក"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </>
      )}
    </div>
  );
};
