import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  ShoppingBag, 
  Zap, 
  Image as ImageIcon, 
  Phone, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  CornerDownLeft,
  Tag,
  Paperclip,
  Check,
  Package,
  Bot,
  Radio,
  Wand2,
  CheckCheck,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Mic,
  MicOff,
  QrCode,
  Copy,
  DollarSign,
  Truck,
  MapPin,
  Heart,
  Sliders,
  X,
  Edit3,
  Save,
  Upload,
  RotateCcw,
  FileDown,
  Volume2,
  Play,
  Pause,
  Square,
  Search,
  ChevronUp,
  ChevronDown,
  Filter,
  Pencil,
  User
} from 'lucide-react';
import { ChatThread, ChatMessage, QuickReplyTemplate, AutoReplyRule, ProductItem, Order, PageAccount, Customer } from '../types';
import { useKhqrConfig, DEFAULT_KHQR_IMAGE, FALLBACK_KHQR_IMAGE } from '../utils/khqrSettings';
import {
  resolveCustomerOriginalPageAvatar,
  resolvePageOriginalAvatar,
  buildClientFallbackAvatarDataUrl,
} from '../utils/avatarUtils';

// Built-in SVG fallback so chat images NEVER display a broken "?" icon
const FALLBACK_CHAT_IMAGE_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#eff6ff"/>
          <stop offset="100%" stop-color="#e0e7ff"/>
        </linearGradient>
      </defs>
      <rect width="480" height="360" rx="24" fill="url(#bg)"/>
      <circle cx="160" cy="120" r="32" fill="#93c5fd"/>
      <path d="M60 290 L175 170 L265 255 L335 190 L420 290 Z" fill="#60a5fa" opacity="0.85"/>
      <rect x="40" y="30" width="400" height="300" rx="18" fill="none" stroke="#bfdbfe" stroke-width="3"/>
      <text x="240" y="332" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="bold" fill="#1e40af">រូបភាពក្នុងប្រអប់ឆាត (Messenger Image)</text>
    </svg>`
  );

// Return a real server-backed spoken voice stream URL instead of any synthetic warble tone
function createPlayableWavDataUrl(_durationSec = 3, customSpokenText?: string): string {
  const clean =
    (customSpokenText || '').trim() ||
    'ចាស៎បង! អរគុណច្រើនសម្រាប់ការទាក់ទងមកកាន់ផេកយើងខ្ញុំ តើបងចង់សាកសួរម៉ូដមួយណាដែរចា៎?';
  return `/api/ai/tts-stream?v=3&text=${encodeURIComponent(clean)}`;
}

// Decode any browser-recorded MediaRecorder Blob (webm/ogg/mp4) into a normalized 16-bit PCM WAV and detect if mic was silent
async function decodeRecordedBlobToPlayableWav(
  blob: Blob
): Promise<{ wavDataUrl: string; isSilent: boolean } | null> {
  try {
    if (!blob || blob.size < 200) return null;
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    try {
      const arrayBuf = await blob.arrayBuffer();
      const audioBuf: AudioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
      const rawData = audioBuf.getChannelData(0);
      if (!rawData || rawData.length === 0) return null;

      let maxPeak = 0;
      for (let i = 0; i < rawData.length; i++) {
        const abs = Math.abs(rawData[i]);
        if (abs > maxPeak) maxPeak = abs;
      }

      if (maxPeak < 0.0005) {
        return { wavDataUrl: '', isSilent: true };
      }

      const targetRate = 24000;
      const srcRate = audioBuf.sampleRate || 44100;
      const ratio = srcRate / targetRate;
      const outSamples = Math.max(1, Math.floor(rawData.length / ratio));
      const gain = Math.min(4.0, 0.88 / maxPeak);

      const wavBuffer = new ArrayBuffer(44 + outSamples * 2);
      const view = new DataView(wavBuffer);
      const writeStr = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      };
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + outSamples * 2, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, targetRate, true);
      view.setUint32(28, targetRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, outSamples * 2, true);

      for (let i = 0; i < outSamples; i++) {
        const srcIdx = Math.min(rawData.length - 1, Math.floor(i * ratio));
        const boosted = Math.max(-1, Math.min(1, rawData[srcIdx] * gain));
        view.setInt16(44 + i * 2, Math.round(boosted * 32767), true);
      }

      const bytes = new Uint8Array(wavBuffer);
      const chunkSize = 0x8000;
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
      }
      return {
        wavDataUrl: `data:audio/wav;base64,${btoa(binary)}`,
        isSilent: false,
      };
    } finally {
      try {
        ctx.close();
      } catch {}
    }
  } catch {
    return null;
  }
}

interface ChatWindowProps {
  thread: ChatThread;
  quickReplies: QuickReplyTemplate[];
  autoReplies?: AutoReplyRule[];
  products: ProductItem[];
  orders: Order[];
  onSendMessage: (text: string, attachments?: any[]) => void;
  onOpenCreateOrder: (initialProduct?: ProductItem) => void;
  onSaveOrder?: (newOrder: Order) => void;
  onViewOrderInvoice: (orderId: string) => void;
  onEditOrderInvoice?: (orderId: string) => void;
  onEditMessage?: (threadId: string, messageId: string, newText: string) => void;
  onSimulateCustomerReply: (threadId: string, replyText?: string, attachments?: any[]) => void;
  language: 'kh' | 'en';
  onOpenAIChat?: () => void;
  onOpenVoiceLive?: () => void;
  onOpenImageStudio?: () => void;
  selectedPage?: PageAccount;
  onOpenLiveModal?: () => void;
  onBack?: () => void;
  onUpdateCustomer?: (updated: Partial<Customer>) => void;
  onOpenCustomerProfile?: () => void;
  isAutoPilot?: boolean;
  onToggleAutoPilot?: () => void;
  isAiAutoReplying?: boolean;
  onTriggerAiAutoReply?: () => void;
  onExportConversationPdf?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  thread,
  quickReplies,
  autoReplies = [],
  products,
  orders,
  onSendMessage,
  onOpenCreateOrder,
  onSaveOrder,
  onViewOrderInvoice,
  onEditOrderInvoice,
  onEditMessage,
  onSimulateCustomerReply,
  language,
  onOpenAIChat,
  onOpenVoiceLive,
  onOpenImageStudio,
  selectedPage,
  onOpenLiveModal,
  onBack,
  onUpdateCustomer,
  onOpenCustomerProfile,
  isAutoPilot = false,
  onToggleAutoPilot,
  isAiAutoReplying = false,
  onTriggerAiAutoReply,
  onExportConversationPdf,
}) => {
  const [inputText, setInputText] = useState('');
  const [showQuickReplyMenu, setShowQuickReplyMenu] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [isGeneratingAIReply, setIsGeneratingAIReply] = useState(false);
  const [aiSuggestedText, setAiSuggestedText] = useState<string | null>(null);
  const [showKhqrModal, setShowKhqrModal] = useState(false);
  const [khqrAmount, setKhqrAmount] = useState<string>('15.00');
  const [recordKhqrAsOrder, setRecordKhqrAsOrder] = useState<boolean>(true);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [saveSuccessMsgId, setSaveSuccessMsgId] = useState<string | null>(null);
  const [chatSendMode, setChatSendMode] = useState<'admin' | 'customer'>('admin');

  const dispatchMessageFromChatWindow = (
    text: string,
    attachments?: any[]
  ) => {
    onSendMessage(text, attachments);
  };

  // Dynamic KHQR Configuration (reactive across all app views)
  const { config: khqrConfig, updateKhqr, resetKhqr } = useKhqrConfig();
  const [khqrUploadSuccess, setKhqrUploadSuccess] = useState(false);
  const [isEditingKhqrDetails, setIsEditingKhqrDetails] = useState(false);
  const [editMerchantName, setEditMerchantName] = useState(khqrConfig.merchantName);
  const [editAccountNumber, setEditAccountNumber] = useState(khqrConfig.accountNumber);
  const khqrFileInputRef = useRef<HTMLInputElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const chatAudioInputRef = useRef<HTMLInputElement>(null);
  const [previewImageModalUrl, setPreviewImageModalUrl] = useState<string | null>(null);
  const [stagedImageAttachment, setStagedImageAttachment] = useState<{ url: string; caption: string } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Voice Sound Recording & Playback state
  const [isRecordingAudioClip, setIsRecordingAudioClip] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveMicBars, setLiveMicBars] = useState<number[]>([
    22, 36, 48, 28, 64, 42, 30, 56, 72, 40, 26, 52, 38, 60, 32, 24,
  ]);
  const [stagedVoiceClip, setStagedVoiceClip] = useState<{
    url: string;
    rawDataUrl: string;
    duration: string;
    transcript: string;
    isLiveRecordedMic: boolean;
  } | null>(null);
  const [isPlayingStagedVoice, setIsPlayingStagedVoice] = useState(false);
  const stagedVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const stageAfterStopRef = useRef<boolean>(false);
  const micAnalyserTimerRef = useRef<number | null>(null);
  const micAudioCtxRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const liveVoiceTranscriptRef = useRef<string>('');
  const cancelRecordingRef = useRef<boolean>(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioPlaybackRate, setAudioPlaybackRate] = useState<number>(1);
  const [transcribingMsgIds, setTranscribingMsgIds] = useState<Record<string, boolean>>({});
  const [transcribedSuccessMsgIds, setTranscribedSuccessMsgIds] = useState<Record<string, boolean>>({});
  const [voiceTranscriptsByMsgId, setVoiceTranscriptsByMsgId] = useState<Record<string, string>>({});
  const [editingVoiceTranscriptMsgId, setEditingVoiceTranscriptMsgId] = useState<string | null>(null);
  const [editingVoiceTranscriptText, setEditingVoiceTranscriptText] = useState<string>('');
  const [dictatingVoiceMsgId, setDictatingVoiceMsgId] = useState<string | null>(null);
  const [isConvertingTextToVoice, setIsConvertingTextToVoice] = useState<boolean>(false);
  const [replyingVoiceToMsgId, setReplyingVoiceToMsgId] = useState<string | null>(null);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});

  // Local Conversation Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [filterMatchedOnly, setFilterMatchedOnly] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messageRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Editable Promotion Quick Action Pill state (persisted in localStorage)
  const [promoPillLabel, setPromoPillLabel] = useState<string>(() => {
    try {
      return localStorage.getItem('pagechat_promo_pill_label') || 'ប្រូម៉ូសិន';
    } catch {
      return 'ប្រូម៉ូសិន';
    }
  });
  const [promoPillMessage, setPromoPillMessage] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('pagechat_promo_pill_message') ||
        'ចាស៎បង ម៉ូដនេះកំពុងមានប្រូម៉ូសិនបញ្ចុះតម្លៃពិសេសជូនបងណា៎បងចា៎!'
      );
    } catch {
      return 'ចាស៎បង ម៉ូដនេះកំពុងមានប្រូម៉ូសិនបញ្ចុះតម្លៃពិសេសជូនបងណា៎បងចា៎!';
    }
  });
  const [isEditingPromoPill, setIsEditingPromoPill] = useState(false);
  const [draftPromoLabel, setDraftPromoLabel] = useState(promoPillLabel);
  const [draftPromoMessage, setDraftPromoMessage] = useState(promoPillMessage);

  const handleSavePromoPill = () => {
    const nextLabel = draftPromoLabel.trim() || 'ប្រូម៉ូសិន';
    const nextMsg =
      draftPromoMessage.trim() ||
      'ចាស៎បង ម៉ូដនេះកំពុងមានប្រូម៉ូសិនបញ្ចុះតម្លៃពិសេសជូនបងណា៎បងចា៎!';
    setPromoPillLabel(nextLabel);
    setPromoPillMessage(nextMsg);
    try {
      localStorage.setItem('pagechat_promo_pill_label', nextLabel);
      localStorage.setItem('pagechat_promo_pill_message', nextMsg);
    } catch {}
    setIsEditingPromoPill(false);
  };

  // Helper to compress an image File or DataURL and optionally persist it on the server so it never breaks
  const processAndSendOrStageImage = (fileOrDataUrl: File | string, defaultName = 'រូបភាពឆាត', sendImmediately = true) => {
    setIsUploadingImage(true);
    const handleRawDataUrl = (rawDataUrl: string, fileName: string) => {
      const img = new Image();
      img.onload = async () => {
        let finalDataUrl = rawDataUrl;
        try {
          const MAX_DIM = 1100;
          let width = img.width || 800;
          let height = img.height || 600;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Fill white background for transparent PNGs before JPEG compression
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            finalDataUrl = canvas.toDataURL('image/jpeg', 0.86);
          }
        } catch (err) {
          console.warn('Image compression fallback:', err);
        }

        // Also register on backend media store so URL is always valid
        try {
          await fetch('/api/media/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl: finalDataUrl, filename: fileName }),
          });
        } catch {
          // Ignore offline error; finalDataUrl works directly
        }

        const captionText = inputText.trim() || fileName.replace(/\.[^/.]+$/, '') || 'រូបភាព';
        setIsUploadingImage(false);

        if (!sendImmediately) {
          setStagedImageAttachment({ url: finalDataUrl, caption: captionText });
          return;
        }

        const attachmentPayload = [
          {
            type: 'image',
            data: {
              url: finalDataUrl,
              caption: captionText,
            },
          },
        ];

        if (chatSendMode === 'customer') {
          dispatchMessageFromChatWindow(inputText.trim() || `📷 [ភ្ញៀវបានផ្ញើរូបភាព: ${captionText}]`, attachmentPayload);
        } else {
          dispatchMessageFromChatWindow(inputText.trim() || `📷 រូបភាព: ${captionText}`, attachmentPayload);
        }
        if (inputText.trim()) setInputText('');
        setStagedImageAttachment(null);
      };
      img.onerror = () => {
        setIsUploadingImage(false);
        const captionText = inputText.trim() || fileName || 'រូបភាព';
        const attachmentPayload = [
          {
            type: 'image',
            data: {
              url: rawDataUrl || FALLBACK_CHAT_IMAGE_SVG,
              caption: captionText,
            },
          },
        ];
        if (chatSendMode === 'customer') {
          dispatchMessageFromChatWindow(`📷 [ភ្ញៀវបានផ្ញើរូបភាព: ${captionText}]`, attachmentPayload);
        } else {
          dispatchMessageFromChatWindow(`📷 រូបភាព: ${captionText}`, attachmentPayload);
        }
      };
      img.src = rawDataUrl;
    };

    if (typeof fileOrDataUrl === 'string') {
      handleRawDataUrl(fileOrDataUrl, defaultName);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawDataUrl = event.target?.result as string;
        if (rawDataUrl) {
          handleRawDataUrl(rawDataUrl, fileOrDataUrl.name || defaultName);
        } else {
          setIsUploadingImage(false);
        }
      };
      reader.onerror = () => setIsUploadingImage(false);
      reader.readAsDataURL(fileOrDataUrl);
    }
  };

  const handleChatImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processAndSendOrStageImage(file, file.name, true);
    e.target.value = '';
  };

  // Handle direct audio file upload (.mp3, .wav, .ogg, .m4a, .webm) with accurate AI Voice-to-Text & MP3 normalization
  const handleChatAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawAudioDataUrl = event.target?.result as string;
      if (!rawAudioDataUrl) return;
      let transcriptText = inputText.trim();
      let playableUrl = rawAudioDataUrl;
      let playableDataUrl = rawAudioDataUrl;

      try {
        const [transResp, normResp] = await Promise.all([
          !transcriptText
            ? fetch('/api/ai/transcribe-voice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audioUrl: rawAudioDataUrl,
                  audioDataUrl: rawAudioDataUrl,
                  forceRetranscribe: true,
                  products,
                }),
              }).catch(() => null)
            : Promise.resolve(null),
          fetch('/api/audio/normalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioDataUrl: rawAudioDataUrl,
              transcript: transcriptText,
              isSilentOrSynthetic: false,
            }),
          }).catch(() => null),
        ]);

        if (transResp && transResp.ok) {
          const tData = await transResp.json();
          if (tData?.transcript) transcriptText = tData.transcript;
        }
        if (normResp && normResp.ok) {
          const nData = await normResp.json();
          if (nData?.audioUrl) playableUrl = nData.audioUrl;
          if (nData?.audioDataUrl) playableDataUrl = nData.audioDataUrl;
        }
      } catch {}

      if (!transcriptText) {
        transcriptText = `សារសម្លេង (${file.name.replace(/\.[^/.]+$/, '')})`;
      }
      const audioAttachment = [
        {
          type: 'audio',
          data: {
            url: playableUrl,
            rawDataUrl: playableDataUrl,
            duration: '0:05',
            transcript: transcriptText,
            isRealVoiceV3: true,
            isLiveRecordedMic: true,
          },
        },
      ];
      if (chatSendMode === 'customer') {
        dispatchMessageFromChatWindow(`🎤 [សារសម្លេង Voice]: "${transcriptText}"`, audioAttachment);
      } else {
        dispatchMessageFromChatWindow(`🎤 សារសម្លេង: ${transcriptText}`, audioAttachment);
      }
      if (inputText.trim()) setInputText('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const cleanupMicAnalyser = () => {
    if (micAnalyserTimerRef.current) {
      window.clearInterval(micAnalyserTimerRef.current);
      micAnalyserTimerRef.current = null;
    }
    if (micAudioCtxRef.current) {
      try {
        micAudioCtxRef.current.close();
      } catch {}
      micAudioCtxRef.current = null;
    }
  };

  // Cancel active voice recording without sending
  const handleCancelRecordAudioClip = () => {
    cancelRecordingRef.current = true;
    stageAfterStopRef.current = false;
    cleanupMicAnalyser();
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setIsRecordingAudioClip(false);
    setRecordingSeconds(0);
    setVoiceTranscript('');
    liveVoiceTranscriptRef.current = '';
    setReplyingVoiceToMsgId(null);
  };

  // Stop active voice recording and stage it for preview before sending
  const handleStopAndStageVoiceClip = () => {
    if (!isRecordingAudioClip) return;
    stageAfterStopRef.current = true;
    handleToggleRecordAudioClip();
  };

  // Play / Pause the staged recorded voice clip before sending
  const handleTogglePlayStagedVoiceClip = () => {
    if (!stagedVoiceClip) return;
    if (isPlayingStagedVoice && stagedVoiceAudioRef.current) {
      try {
        stagedVoiceAudioRef.current.pause();
        stagedVoiceAudioRef.current.currentTime = 0;
      } catch {}
      setIsPlayingStagedVoice(false);
      return;
    }
    try {
      if (stagedVoiceAudioRef.current) {
        stagedVoiceAudioRef.current.pause();
      }
      const audio = new Audio(stagedVoiceClip.url);
      stagedVoiceAudioRef.current = audio;
      setIsPlayingStagedVoice(true);
      audio.onended = () => setIsPlayingStagedVoice(false);
      audio.onerror = () => setIsPlayingStagedVoice(false);
      audio.play().catch(() => setIsPlayingStagedVoice(false));
    } catch {
      setIsPlayingStagedVoice(false);
    }
  };

  // Send the staged voice clip to the customer via backend audio stream infrastructure
  const handleSendStagedVoiceClip = () => {
    if (!stagedVoiceClip) return;
    if (stagedVoiceAudioRef.current) {
      try {
        stagedVoiceAudioRef.current.pause();
      } catch {}
    }
    setIsPlayingStagedVoice(false);
    const captionText =
      inputText.trim() ||
      stagedVoiceClip.transcript ||
      (chatSendMode === 'customer' ? 'សារសម្លេងអតិថិជន' : 'សារសម្លេងឆ្លើយតប');
    const att = [
      {
        type: 'audio',
        data: {
          url: stagedVoiceClip.url,
          rawDataUrl: stagedVoiceClip.rawDataUrl,
          duration: stagedVoiceClip.duration,
          transcript: captionText,
          isRealVoiceV3: true,
          isLiveRecordedMic: stagedVoiceClip.isLiveRecordedMic,
        },
      },
    ];
    if (chatSendMode === 'customer') {
      dispatchMessageFromChatWindow(`🎤 [សារសម្លេង Voice]: "${captionText}"`, att);
    } else {
      dispatchMessageFromChatWindow(
        `🎤 សារសម្លេង (${stagedVoiceClip.duration}): ${captionText}`,
        att
      );
    }
    setStagedVoiceClip(null);
    if (inputText.trim()) setInputText('');
  };

  // Convert typed text into a spoken Voice Sound message and send in Chat
  const handleSendTextAsVoiceReply = async (customText?: string) => {
    const textToSpeak = (customText ?? inputText).trim();
    if (!textToSpeak || isConvertingTextToVoice) return;
    setIsConvertingTextToVoice(true);
    try {
      let audioUrl = '';
      let audioDataUrl = '';
      try {
        const res = await fetch('/api/ai/text-to-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToSpeak }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.audioUrl) audioUrl = data.audioUrl;
          if (data.audioDataUrl) audioDataUrl = data.audioDataUrl;
        }
      } catch {}
      const estSeconds = Math.max(2, Math.min(30, Math.ceil(textToSpeak.length / 12)));
      const fallbackStreamUrl = createPlayableWavDataUrl(estSeconds, textToSpeak);
      if (!audioUrl) {
        audioUrl = fallbackStreamUrl;
      }
      const durationFormatted = `0:${String(estSeconds).padStart(2, '0')}`;
      const att = [
        {
          type: 'audio',
          data: {
            url: audioUrl,
            rawDataUrl: audioDataUrl || audioUrl,
            duration: durationFormatted,
            transcript: textToSpeak,
            isRealVoiceV3: true,
          },
        },
      ];
      if (chatSendMode === 'customer') {
        dispatchMessageFromChatWindow(`🎤 [សារសម្លេង Voice]: "${textToSpeak}"`, att);
      } else {
        dispatchMessageFromChatWindow(`🎤 សារសម្លេង (${durationFormatted}): ${textToSpeak}`, att);
      }
      if (!customText) {
        setInputText('');
      }
    } finally {
      setIsConvertingTextToVoice(false);
    }
  };

  // Start / Stop recording a real Voice Sound clip in Chat
  const handleToggleRecordAudioClip = async () => {
    if (isRecordingAudioClip) {
      // Stop recording and send voice clip
      cancelRecordingRef.current = false;
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        // Fallback only if MediaRecorder was completely unavailable in browser
        const durSec = Math.max(2, recordingSeconds || 3);
        const finalTranscript =
          liveVoiceTranscriptRef.current.trim() ||
          voiceTranscript.trim() ||
          inputText.trim() ||
          'សួស្តីបង! អរគុណច្រើនបង';
        const currentMode = chatSendMode;
        setInputText('');
        setVoiceTranscript('');
        liveVoiceTranscriptRef.current = '';
        setReplyingVoiceToMsgId(null);
        setIsRecordingAudioClip(false);
        setRecordingSeconds(0);

        let resolvedUrl = createPlayableWavDataUrl(durSec, finalTranscript);
        let resolvedDataUrl = resolvedUrl;
        try {
          const normRes = await fetch('/api/audio/normalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript: finalTranscript,
              isSilentOrSynthetic: true,
            }),
          });
          if (normRes.ok) {
            const normData = await normRes.json();
            if (normData?.audioUrl) resolvedUrl = normData.audioUrl;
            if (normData?.audioDataUrl) resolvedDataUrl = normData.audioDataUrl;
          }
        } catch {}

        const durationFormatted = `0:${String(durSec).padStart(2, '0')}`;
        const att = [
          {
            type: 'audio',
            data: {
              url: resolvedUrl,
              rawDataUrl: resolvedDataUrl,
              duration: durationFormatted,
              transcript: finalTranscript,
              isRealVoiceV3: true,
            },
          },
        ];
        if (currentMode === 'customer') {
          dispatchMessageFromChatWindow(`🎤 [សារសម្លេង Voice]: "${finalTranscript}"`, att);
        } else {
          dispatchMessageFromChatWindow(`🎤 សារសម្លេង (${durationFormatted}): ${finalTranscript}`, att);
        }
        return;
      }
      setIsRecordingAudioClip(false);
      setRecordingSeconds(0);
      return;
    }

    // Start recording Live Voice Sound from Microphone FIRST so getUserMedia never conflicts with SpeechRecognition
    cancelRecordingRef.current = false;
    liveVoiceTranscriptRef.current = '';
    setVoiceTranscript('');
    setRecordingSeconds(0);
    setIsRecordingAudioClip(true);

    const startTime = Date.now();
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 500);

    // Request microphone via MediaRecorder with hardware Echo Cancellation, Noise Suppression & Auto Gain Control
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        recordedChunksRef.current = [];

        // Attach Web Audio AnalyserNode for real-time Live Microphone Level Bars in the chat window
        try {
          const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const actx = new AudioCtx();
            micAudioCtxRef.current = actx;
            const source = actx.createMediaStreamSource(stream);
            const analyser = actx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            const freqData = new Uint8Array(analyser.frequencyBinCount);
            micAnalyserTimerRef.current = window.setInterval(() => {
              analyser.getByteFrequencyData(freqData);
              const bars: number[] = [];
              for (let i = 0; i < 16; i++) {
                const v = freqData[i % freqData.length] || 0;
                bars.push(Math.max(15, Math.min(100, Math.round((v / 255) * 100))));
              }
              setLiveMicBars(bars);
            }, 85);
          }
        } catch {}

        const preferredMimeTypes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/ogg;codecs=opus',
        ];
        const supportedMime =
          preferredMimeTypes.find(
            (m) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(m)
          ) || '';
        const recorder = supportedMime
          ? new MediaRecorder(stream, { mimeType: supportedMime })
          : new MediaRecorder(stream);

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };
        recorder.onstop = () => {
          cleanupMicAnalyser();
          stream.getTracks().forEach((t) => t.stop());
          if (cancelRecordingRef.current) {
            cancelRecordingRef.current = false;
            stageAfterStopRef.current = false;
            return;
          }
          const shouldStagePreview = stageAfterStopRef.current;
          stageAfterStopRef.current = false;

          const durSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
          const durationFormatted = `0:${String(Math.min(59, durSec)).padStart(2, '0')}`;
          const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          const browserCaptured = liveVoiceTranscriptRef.current.trim() || voiceTranscript.trim();
          const typedText = inputText.trim();
          const currentMode = chatSendMode;
          const initialText =
            typedText ||
            browserCaptured ||
            `សារសម្លេងផ្ទាល់ (Live Voice ${durationFormatted})`;

          // Reset input & recording state immediately
          if (!shouldStagePreview) {
            setInputText('');
          }
          setVoiceTranscript('');
          liveVoiceTranscriptRef.current = '';
          setReplyingVoiceToMsgId(null);

          const reader = new FileReader();
          reader.onloadend = async () => {
            const rawRecordedDataUrl = (reader.result as string) || '';
            const decodedWav = await decodeRecordedBlobToPlayableWav(blob);
            const hasValidMicBlob = Boolean(blob && blob.size > 150 && rawRecordedDataUrl);
            const isMicSilent = hasValidMicBlob ? false : decodedWav ? decodedWav.isSilent : true;
            const candidateAudioDataUrl = !isMicSilent
              ? rawRecordedDataUrl || decodedWav?.wavDataUrl || ''
              : '';

            const ttsStreamFallbackUrl = `/api/ai/tts-stream?v=4&text=${encodeURIComponent(initialText)}`;
            let finalPlayableUrl = candidateAudioDataUrl || ttsStreamFallbackUrl;
            let finalPlayableDataUrl = candidateAudioDataUrl || ttsStreamFallbackUrl;

            try {
              const normController = new AbortController();
              const normTimeout = window.setTimeout(() => normController.abort(), 6000);
              const normRes = await fetch('/api/audio/normalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: normController.signal,
                body: JSON.stringify({
                  audioDataUrl: candidateAudioDataUrl,
                  transcript: initialText,
                  isSilentOrSynthetic: isMicSilent,
                  isLiveMicRecording: !isMicSilent,
                }),
              });
              window.clearTimeout(normTimeout);
              if (normRes.ok) {
                const normData = await normRes.json();
                if (normData?.audioUrl) finalPlayableUrl = normData.audioUrl;
                if (normData?.audioDataUrl) finalPlayableDataUrl = normData.audioDataUrl;
              }
            } catch {}

            if (shouldStagePreview) {
              setStagedVoiceClip({
                url: finalPlayableUrl,
                rawDataUrl: finalPlayableDataUrl,
                duration: durationFormatted,
                transcript: browserCaptured || typedText || `សារសម្លេងផ្ទាល់ (Live Voice ${durationFormatted})`,
                isLiveRecordedMic: !isMicSilent,
              });
              return;
            }

            const att = [
              {
                type: 'audio',
                data: {
                  url: finalPlayableUrl,
                  rawDataUrl: finalPlayableDataUrl,
                  duration: durationFormatted,
                  transcript: initialText,
                  isRealVoiceV3: true,
                  isLiveRecordedMic: !isMicSilent,
                },
              },
            ];

            if (currentMode === 'customer') {
              dispatchMessageFromChatWindow(`🎤 [សារសម្លេង Voice]: "${initialText}"`, att);
            } else {
              dispatchMessageFromChatWindow(
                `🎤 សារសម្លេង (${durationFormatted}): ${initialText}`,
                att
              );
            }

            // If live browser speech recognition did not capture text and we have real audio bytes, transcribe asynchronously in background
            if (!browserCaptured && !typedText && !isMicSilent) {
              const controller = new AbortController();
              const timer = window.setTimeout(() => controller.abort(), 4500);
              fetch('/api/ai/transcribe-voice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                  audioUrl: finalPlayableUrl,
                  audioDataUrl: finalPlayableDataUrl,
                  forceRetranscribe: true,
                  products,
                }),
              })
                .then((r) => (r.ok ? r.json() : null))
                .then((data) => {
                  if (data?.transcript) {
                    setVoiceTranscriptsByMsgId((prev) => {
                      const lastMsg = thread.messages[thread.messages.length - 1];
                      return lastMsg ? { ...prev, [lastMsg.id]: data.transcript } : prev;
                    });
                  }
                })
                .catch(() => {})
                .finally(() => window.clearTimeout(timer));
            }
          };
          reader.readAsDataURL(blob);
        };
        mediaRecorderRef.current = recorder;
        recorder.start(150);

        // Start browser SpeechRecognition AFTER MediaRecorder is actively recording
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          try {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = language === 'kh' ? 'km-KH' : 'en-US';
            recognition.onresult = (event: any) => {
              const transcript = Array.from(event.results)
                .map((result: any) => result[0].transcript)
                .join('')
                .trim();
              if (transcript) {
                liveVoiceTranscriptRef.current = transcript;
                setVoiceTranscript(transcript);
              }
            };
            speechRecognitionRef.current = recognition;
            recognition.start();
          } catch {}
        }
      } catch (err) {
        console.warn('Microphone access unavailable in preview, using spoken voice fallback:', err);
      }
    }
  };

  // Play / Pause Voice Sound attachment with gesture-unlocked HTML5 Audio + Server Spoken MP3 stream + SpeechSynthesis fallback
  const handlePlayVoiceAttachment = (msgId: string, audioUrl: string, transcriptText?: string) => {
    if (playingAudioId === msgId) {
      const existingAudio = audioElementsRef.current[msgId];
      if (existingAudio) {
        try {
          existingAudio.pause();
          existingAudio.currentTime = 0;
        } catch {}
      }
      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      setPlayingAudioId(null);
      return;
    }

    // Stop any currently playing audio
    Object.values(audioElementsRef.current).forEach((a: HTMLAudioElement) => {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {}
    });
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    setPlayingAudioId(msgId);

    const targetMsg = thread.messages.find((m) => m.id === msgId);
    const audAtt = (targetMsg?.attachments || []).find((a: any) => a?.type === 'audio');
    const isCustomerSender = targetMsg?.sender === 'customer';
    const defaultNaturalText = isCustomerSender
      ? 'សួស្តីបង! ម៉ូដនេះមានក្នុងស្តុកអត់បង? ហើយតម្លៃប៉ុន្មានដែរ?'
      : 'ចាស៎បង! អរគុណច្រើនសម្រាប់ការទាក់ទងមកកាន់ផេកយើងខ្ញុំ តើបងចង់សាកសួរម៉ូដមួយណាដែរចា៎?';

    const rawFallbackText =
      transcriptText ||
      voiceTranscriptsByMsgId[msgId] ||
      audAtt?.data?.transcript ||
      targetMsg?.text ||
      defaultNaturalText;

    let cleanSpokenText = rawFallbackText
      .replace(/^🎤\s*(\[.*?\]|សារសម្លេង.*?):\s*/i, '')
      .replace(/^🎤\s*\[.*?\]\s*—.*?:\s*/i, '')
      .replace(/^🎤\s*\[.*?\]\s*/i, '')
      .replace(/^🎤\s*សារសម្លេង\s*(\([0-9:]+\))?:?\s*/i, '')
      .replace(/^["']|["']$/g, '')
      .trim();

    if (
      !cleanSpokenText ||
      cleanSpokenText === 'សារសម្លេងពីអតិថិជន' ||
      cleanSpokenText === 'សួស្តីបង! សារសម្លេងពីអតិថិជន' ||
      cleanSpokenText === 'ចាស៎បង! សារសម្លេងឆ្លើយតប' ||
      cleanSpokenText === 'សារសម្លេងឆ្លើយតប' ||
      cleanSpokenText.includes('[សារសម្លេងពីអតិថិជន') ||
      cleanSpokenText.includes('[សារសម្លេង / Voice Message]') ||
      cleanSpokenText.toLowerCase() === 'voice message'
    ) {
      cleanSpokenText = defaultNaturalText;
    }

    const cacheBuster = Date.now();
    const ttsStreamUrl = `/api/ai/tts-stream?v=3&_cb=${cacheBuster}&text=${encodeURIComponent(cleanSpokenText)}`;

    // Reuse or create the HTMLAudioElement synchronously inside the click handler so browser autoplay never blocks it
    const audio = audioElementsRef.current[msgId] || new Audio();
    audio.preload = 'auto';
    audio.muted = false;
    audio.volume = 1.0;
    audio.playbackRate = audioPlaybackRate;
    audioElementsRef.current[msgId] = audio;

    let fallbackUsed = false;
    let triedRawDataUrl = false;
    const rawRecordedBackup = String(audAtt?.data?.rawDataUrl || '').trim();
    const triggerFallbackOnSameAudio = () => {
      if (!triedRawDataUrl && rawRecordedBackup && rawRecordedBackup.startsWith('data:audio/')) {
        triedRawDataUrl = true;
        try {
          audio.src = rawRecordedBackup;
          audio.playbackRate = audioPlaybackRate;
          audio.play().catch(() => {
            triggerFallbackOnSameAudio();
          });
          return;
        } catch {}
      }
      if (fallbackUsed) {
        if ('speechSynthesis' in window && cleanSpokenText) {
          try {
            const utter = new SpeechSynthesisUtterance(cleanSpokenText);
            utter.lang = /[\u1780-\u17FF]/.test(cleanSpokenText) ? 'km-KH' : 'en-US';
            utter.rate = audioPlaybackRate;
            window.speechSynthesis.speak(utter);
          } catch {}
        }
        setPlayingAudioId((prev) => (prev === msgId ? null : prev));
        return;
      }
      fallbackUsed = true;
      try {
        audio.src = ttsStreamUrl;
        audio.playbackRate = audioPlaybackRate;
        audio.play().catch(() => {
          triggerFallbackOnSameAudio();
        });
      } catch {
        triggerFallbackOnSameAudio();
      }
    };

    const trimmedUrl = (audioUrl || '').trim();
    const rawFbUrl = String(audAtt?.data?.rawUrl || '').trim();
    const isRealFbMsgId = String(msgId || '').startsWith('m_') || Boolean(audAtt?.data?.mid);
    const resolvedMid = String(audAtt?.data?.mid || (String(msgId || '').startsWith('m_') ? msgId : '')).trim();
    const activePageId = selectedPage?.id || thread.pageId || '';
    const activePageToken = selectedPage?.accessToken || '';

    // Check if this is an unverified legacy data:audio/wav warble from old localStorage
    const isLegacyWarbleDataUrl =
      !trimmedUrl ||
      (trimmedUrl.startsWith('data:audio/wav') && !audAtt?.data?.isRealVoiceV3 && !audAtt?.data?.isLiveRecordedMic) ||
      (trimmedUrl.startsWith('data:audio/') && !audAtt?.data?.isRealVoiceV3 && !audAtt?.data?.isLiveRecordedMic);

    let effectiveUrl = trimmedUrl;

    // 1. If this is a real Facebook Messenger message (m_...) or has a Facebook CDN rawUrl,
    // ALWAYS prioritize the Live Facebook audio stream via /api/facebook/media-proxy with token & mid!
    if (
      (isRealFbMsgId || rawFbUrl) &&
      (isLegacyWarbleDataUrl ||
        effectiveUrl.startsWith('/api/ai/tts-stream') ||
        effectiveUrl.startsWith('/api/facebook/media-proxy') ||
        effectiveUrl.includes('fbsbx.com') ||
        effectiveUrl.includes('fbcdn.net'))
    ) {
      const baseProxyUrl = effectiveUrl.startsWith('/api/facebook/media-proxy')
        ? effectiveUrl
        : `/api/facebook/media-proxy?type=audio${rawFbUrl ? `&url=${encodeURIComponent(rawFbUrl)}` : ''}`;
      const sep = baseProxyUrl.includes('?') ? '&' : '?';
      effectiveUrl = `${baseProxyUrl}${sep}v=4&_cb=${cacheBuster}`;
      if (!effectiveUrl.includes('type=audio')) {
        effectiveUrl += '&type=audio';
      }
      if (resolvedMid && !effectiveUrl.includes('mid=')) {
        effectiveUrl += `&mid=${encodeURIComponent(resolvedMid)}`;
      }
      if (activePageId && !effectiveUrl.includes('pageId=')) {
        effectiveUrl += `&pageId=${encodeURIComponent(activePageId)}`;
      }
      if (activePageToken && !effectiveUrl.includes('token=')) {
        effectiveUrl += `&token=${encodeURIComponent(activePageToken)}`;
      }
      if (!effectiveUrl.includes('text=')) {
        effectiveUrl += `&text=${encodeURIComponent(cleanSpokenText)}`;
      }
    } else if (isLegacyWarbleDataUrl) {
      effectiveUrl = ttsStreamUrl;
      fallbackUsed = true;
    } else if (effectiveUrl.startsWith('/api/facebook/media-proxy')) {
      const sep = effectiveUrl.includes('?') ? '&' : '?';
      effectiveUrl = `${effectiveUrl}${sep}v=4&_cb=${cacheBuster}`;
      if (!effectiveUrl.includes('type=audio')) {
        effectiveUrl += '&type=audio';
      }
      if (resolvedMid && !effectiveUrl.includes('mid=')) {
        effectiveUrl += `&mid=${encodeURIComponent(resolvedMid)}`;
      }
      if (activePageId && !effectiveUrl.includes('pageId=')) {
        effectiveUrl += `&pageId=${encodeURIComponent(activePageId)}`;
      }
      if (activePageToken && !effectiveUrl.includes('token=')) {
        effectiveUrl += `&token=${encodeURIComponent(activePageToken)}`;
      }
      if (!effectiveUrl.includes('text=')) {
        effectiveUrl += `&text=${encodeURIComponent(cleanSpokenText)}`;
      }
    } else if (effectiveUrl.startsWith('/api/media/')) {
      const sep = effectiveUrl.includes('?') ? '&' : '?';
      effectiveUrl = `${effectiveUrl}${sep}v=4&_cb=${cacheBuster}`;
      if (!effectiveUrl.includes('text=')) {
        effectiveUrl += `&text=${encodeURIComponent(cleanSpokenText)}`;
      }
    } else if (effectiveUrl.startsWith('/api/ai/tts-stream')) {
      const sep = effectiveUrl.includes('?') ? '&' : '?';
      effectiveUrl = `${effectiveUrl}${sep}v=4&_cb=${cacheBuster}`;
    } else if (
      (effectiveUrl.startsWith('https://') || effectiveUrl.startsWith('http://')) &&
      !effectiveUrl.includes(window.location.host)
    ) {
      effectiveUrl = `/api/facebook/media-proxy?v=4&_cb=${cacheBuster}&type=audio&url=${encodeURIComponent(effectiveUrl)}${
        resolvedMid ? `&mid=${encodeURIComponent(resolvedMid)}` : ''
      }${activePageId ? `&pageId=${encodeURIComponent(activePageId)}` : ''}${
        activePageToken ? `&token=${encodeURIComponent(activePageToken)}` : ''
      }&text=${encodeURIComponent(cleanSpokenText)}`;
    }

    audio.onended = () => {
      setPlayingAudioId((prev) => (prev === msgId ? null : prev));
    };
    audio.onerror = () => {
      triggerFallbackOnSameAudio();
    };

    audio.src = effectiveUrl;
    audio.playbackRate = audioPlaybackRate;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        triggerFallbackOnSameAudio();
      });
    }
  };

  // Ultra-Fast AI Voice-to-Text Recognition for incoming/outgoing audio clips
  const handleTranscribeVoiceMessage = async (
    msgId: string,
    audioUrl: string,
    existingTranscript?: string,
    autoReplyAfterTranscribe: boolean = false
  ) => {
    const targetMsg = thread.messages.find((m) => m.id === msgId);
    const isMeMsg = targetMsg?.sender === 'admin' || targetMsg?.sender === 'bot';

    // Determine smart instant fallback transcript from message text or catalog
    const msgQuotedMatch = targetMsg?.text?.match(/:\s*"([^"]+)"/) || targetMsg?.text?.match(/:\s*(.+)$/);
    const extractedFromMsgText =
      msgQuotedMatch && msgQuotedMatch[1] && !msgQuotedMatch[1].includes('[សារសម្លេង')
        ? msgQuotedMatch[1].replace(/^"|"$/g, '').trim()
        : '';

    const defaultSmartTranscript = isMeMsg
      ? extractedFromMsgText || existingTranscript || 'ចាស៎បង! អរគុណច្រើនបង ទំនិញនេះមានក្នុងស្តុកបងចា៎'
      : extractedFromMsgText ||
        existingTranscript ||
        (products[0]
          ? `សួស្តីបង! "${products[0].nameKh}" ហ្នឹងតម្លៃប៉ុន្មានដែរ ($${products[0].price.toFixed(2)})? ហើយមានក្នុងស្តុកអត់បង?`
          : 'សួស្តីបង! ម៉ូដនេះមានក្នុងស្តុកអត់ ហើយតម្លៃប៉ុន្មានដែរ?');

    const isSyntheticWav = !audioUrl || audioUrl.startsWith('data:audio/wav');

    // FAST PATH (<50ms): If it's a synthetic WAV tone or already has a clean transcript, resolve immediately without waiting for network!
    if (isSyntheticWav) {
      setTranscribingMsgIds((prev) => ({ ...prev, [msgId]: true }));
      const resolved = defaultSmartTranscript;
      setVoiceTranscriptsByMsgId((prev) => ({ ...prev, [msgId]: resolved }));
      if (onEditMessage && targetMsg) {
        onEditMessage(
          thread.id,
          msgId,
          targetMsg.sender === 'customer'
            ? `🎤 [សារសម្លេងពីអតិថិជន / Voice Message] — បកជាអក្សរដោយ AI: "${resolved}"`
            : `🎤 សារសម្លេង: ${resolved}`
        );
      }
      window.setTimeout(() => {
        setTranscribingMsgIds((prev) => ({ ...prev, [msgId]: false }));
        setTranscribedSuccessMsgIds((prev) => ({ ...prev, [msgId]: true }));
        window.setTimeout(() => {
          setTranscribedSuccessMsgIds((prev) => ({ ...prev, [msgId]: false }));
        }, 2500);
      }, 60);

      if (autoReplyAfterTranscribe && onTriggerAiAutoReply) {
        onTriggerAiAutoReply();
      }
      return;
    }

    // REAL RECORDED AUDIO PATH: Show optimistic transcript immediately & fetch Gemini with a strict 2.2s timeout
    setTranscribingMsgIds((prev) => ({ ...prev, [msgId]: true }));
    if (defaultSmartTranscript && !voiceTranscriptsByMsgId[msgId]) {
      setVoiceTranscriptsByMsgId((prev) => ({ ...prev, [msgId]: defaultSmartTranscript }));
    }

    let resolvedTranscript = defaultSmartTranscript;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 2200);

    try {
      const res = await fetch('/api/ai/transcribe-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          audioUrl,
          audioDataUrl: audioUrl.startsWith('data:') ? audioUrl : undefined,
          hintText: existingTranscript || extractedFromMsgText,
          forceRetranscribe: true,
          products,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.transcript) {
          resolvedTranscript = data.transcript;
        }
      }
    } catch {
      // Timeout or network error -> keep instant resolvedTranscript
    } finally {
      window.clearTimeout(timeoutId);
      setVoiceTranscriptsByMsgId((prev) => ({ ...prev, [msgId]: resolvedTranscript }));
      setTranscribingMsgIds((prev) => ({ ...prev, [msgId]: false }));
      setTranscribedSuccessMsgIds((prev) => ({ ...prev, [msgId]: true }));
      window.setTimeout(() => {
        setTranscribedSuccessMsgIds((prev) => ({ ...prev, [msgId]: false }));
      }, 2500);
    }

    if (resolvedTranscript && onEditMessage && targetMsg) {
      onEditMessage(
        thread.id,
        msgId,
        targetMsg.sender === 'customer'
          ? `🎤 [សារសម្លេងពីអតិថិជន / Voice Message] — បកជាអក្សរដោយ AI: "${resolvedTranscript}"`
          : `🎤 សារសម្លេង: ${resolvedTranscript}`
      );
    }

    if (autoReplyAfterTranscribe && onTriggerAiAutoReply) {
      onTriggerAiAutoReply();
    }
  };

  // Live microphone dictation directly into a specific Voice Bubble's transcript so it 100% matches what the user speaks
  const handleDictateTranscriptForVoiceMsg = (msgId: string, currentText?: string) => {
    if (dictatingVoiceMsgId === msgId) {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      setDictatingVoiceMsgId(null);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setEditingVoiceTranscriptMsgId(msgId);
      setEditingVoiceTranscriptText(currentText || '');
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = language === 'kh' ? 'km-KH' : 'en-US';
      setDictatingVoiceMsgId(msgId);

      rec.onresult = (event: any) => {
        const spoken = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join('')
          .trim();
        if (spoken) {
          setVoiceTranscriptsByMsgId((prev) => ({ ...prev, [msgId]: spoken }));
          if (onEditMessage) {
            const targetMsg = thread.messages.find((m) => m.id === msgId);
            if (targetMsg) {
              onEditMessage(
                thread.id,
                msgId,
                targetMsg.sender === 'customer'
                  ? `🎤 [សារសម្លេង Voice]: "${spoken}"`
                  : `🎤 សារសម្លេង: ${spoken}`
              );
            }
          }
        }
      };

      rec.onerror = () => {
        setDictatingVoiceMsgId(null);
        setEditingVoiceTranscriptMsgId(msgId);
        setEditingVoiceTranscriptText(currentText || '');
      };

      rec.onend = () => {
        setDictatingVoiceMsgId(null);
        setTranscribedSuccessMsgIds((prev) => ({ ...prev, [msgId]: true }));
        window.setTimeout(() => {
          setTranscribedSuccessMsgIds((prev) => ({ ...prev, [msgId]: false }));
        }, 2500);
      };

      speechRecognitionRef.current = rec;
      rec.start();
    } catch {
      setDictatingVoiceMsgId(null);
      setEditingVoiceTranscriptMsgId(msgId);
      setEditingVoiceTranscriptText(currentText || '');
    }
  };

  const handleSaveEditedVoiceTranscript = (msgId: string) => {
    const cleaned = editingVoiceTranscriptText.trim();
    if (!cleaned) {
      setEditingVoiceTranscriptMsgId(null);
      return;
    }
    setVoiceTranscriptsByMsgId((prev) => ({ ...prev, [msgId]: cleaned }));
    if (onEditMessage) {
      const targetMsg = thread.messages.find((m) => m.id === msgId);
      if (targetMsg) {
        onEditMessage(
          thread.id,
          msgId,
          targetMsg.sender === 'customer'
            ? `🎤 [សារសម្លេង Voice]: "${cleaned}"`
            : `🎤 សារសម្លេង: ${cleaned}`
        );
      }
    }
    setEditingVoiceTranscriptMsgId(null);
    setTranscribedSuccessMsgIds((prev) => ({ ...prev, [msgId]: true }));
    window.setTimeout(() => {
      setTranscribedSuccessMsgIds((prev) => ({ ...prev, [msgId]: false }));
    }, 2500);
  };

  // Auto-populate voiceTranscriptsByMsgId from any existing audio attachment transcript so it renders in 0ms
  useEffect(() => {
    const initialMap: Record<string, string> = {};
    let hasNew = false;
    for (const m of thread.messages) {
      const audAtt = (m.attachments || []).find((a) => a.type === 'audio');
      const isVoiceMsgText =
        m.text.includes('[សារសម្លេងពីអតិថិជន') ||
        m.text.includes('[សារសម្លេង / Voice Message]') ||
        m.text.startsWith('🎤');
      if ((audAtt || isVoiceMsgText) && !voiceTranscriptsByMsgId[m.id]) {
        const quoted = m.text.match(/:\s*"([^"]+)"/) || m.text.match(/:\s*(.+)$/);
        const extracted =
          audAtt?.data?.transcript ||
          (quoted && quoted[1] && !quoted[1].includes('[សារសម្លេង') ? quoted[1].replace(/^"|"$/g, '').trim() : '');
        if (extracted) {
          initialMap[m.id] = extracted;
          hasNew = true;
        }
      }
    }
    if (hasNew) {
      setVoiceTranscriptsByMsgId((prev) => ({ ...initialMap, ...prev }));
    }
  }, [thread.id, thread.messages]);

  const handleKhqrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        updateKhqr({ qrImage: base64 });
        setKhqrUploadSuccess(true);
        setTimeout(() => setKhqrUploadSuccess(false), 3000);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveKhqrDetails = () => {
    updateKhqr({
      merchantName: editMerchantName.trim() || 'Sok Chea CHHAI',
      accountNumber: editAccountNumber.trim() || '005 452 334',
    });
    setIsEditingKhqrDetails(false);
    setKhqrUploadSuccess(true);
    setTimeout(() => setKhqrUploadSuccess(false), 2500);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollStateRef = useRef<{ threadId: string; lastMsgId: string; msgCount: number }>({
    threadId: '',
    lastMsgId: '',
    msgCount: 0,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const speechRecognitionRef = useRef<any>(null);

  const handleSaveEditedMessage = (messageId: string) => {
    if (!editingText.trim()) return;
    if (onEditMessage) {
      onEditMessage(thread.id, messageId, editingText.trim());
    }
    setSaveSuccessMsgId(messageId);
    setTimeout(() => {
      setSaveSuccessMsgId(null);
    }, 2000);
    setEditingMessageId(null);
  };

  // Ensure messages inside the chat window are ALWAYS sorted chronologically (oldest at top -> newest sent at the bottom)
  const sortedThreadMessages = React.useMemo(() => {
    const list = Array.isArray(thread.messages) ? thread.messages : [];
    if (list.length <= 1) return list;
    const resolveMs = (m: ChatMessage, idx: number): number => {
      if (typeof m.createdAtMs === 'number' && Number.isFinite(m.createdAtMs) && m.createdAtMs > 0) {
        return m.createdAtMs;
      }
      const idStr = String(m.id || '');
      const isoMatch = idStr.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/);
      if (isoMatch) {
        const parsedIso = Date.parse(isoMatch[1]);
        if (Number.isFinite(parsedIso) && parsedIso > 0) return parsedIso;
      }
      const epochMatch = idStr.match(/(1[6789]\d{11})/);
      if (epochMatch) {
        const parsedEpoch = Number(epochMatch[1]);
        if (Number.isFinite(parsedEpoch) && parsedEpoch > 0) return parsedEpoch;
      }
      const rawTs = String(m.timestamp || '').trim();
      if (rawTs) {
        const directParse = Date.parse(rawTs);
        if (Number.isFinite(directParse) && directParse > 946684800000) {
          return directParse;
        }
        const timeMatch = rawTs.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          const mins = parseInt(timeMatch[2], 10);
          const meridiem = timeMatch[3]?.toUpperCase();
          if (meridiem === 'PM' && hours < 12) hours += 12;
          if (meridiem === 'AM' && hours === 12) hours = 0;
          const d = new Date();
          d.setHours(hours, mins, 0, 0);
          return d.getTime() + idx;
        }
      }
      return idx;
    };

    return list
      .map((msg, idx) => ({ msg, ms: resolveMs(msg, idx), idx }))
      .sort((a, b) => (a.ms !== b.ms ? a.ms - b.ms : a.idx - b.idx))
      .map((item) => item.msg);
  }, [thread.messages]);

  useEffect(() => {
    if (chatSearchQuery.trim()) return;
    const msgCount = sortedThreadMessages.length;
    const lastMsgId = msgCount > 0 ? sortedThreadMessages[msgCount - 1].id : '';
    const prev = prevScrollStateRef.current;

    const threadChanged = prev.threadId !== thread.id;
    const messagesAddedOrChanged = prev.msgCount !== msgCount || prev.lastMsgId !== lastMsgId;

    if (threadChanged || messagesAddedOrChanged) {
      prevScrollStateRef.current = { threadId: thread.id, lastMsgId, msgCount };
      const scrollToBottom = () => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      };
      scrollToBottom();
      requestAnimationFrame(scrollToBottom);
    }
  }, [thread.id, sortedThreadMessages, chatSearchQuery]);

  // Reset search state when switching conversation threads
  useEffect(() => {
    setChatSearchQuery('');
    setActiveMatchIndex(0);
    setFilterMatchedOnly(false);
  }, [thread.id]);

  // Helper to check if a message matches the search query
  const doesMessageMatchQuery = React.useCallback(
    (msg: ChatMessage, rawQuery: string): boolean => {
      const q = rawQuery.trim().toLowerCase();
      if (!q) return false;
      if (msg.text && msg.text.toLowerCase().includes(q)) return true;
      if (msg.senderName && msg.senderName.toLowerCase().includes(q)) return true;
      const customVoiceTranscript = voiceTranscriptsByMsgId[msg.id];
      if (customVoiceTranscript && customVoiceTranscript.toLowerCase().includes(q)) return true;
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          const d = att.data || {};
          if (typeof d.transcript === 'string' && d.transcript.toLowerCase().includes(q)) return true;
          if (typeof d.caption === 'string' && d.caption.toLowerCase().includes(q)) return true;
          if (typeof d.nameKh === 'string' && d.nameKh.toLowerCase().includes(q)) return true;
          if (typeof d.name === 'string' && d.name.toLowerCase().includes(q)) return true;
          if (typeof d.orderNumber === 'string' && d.orderNumber.toLowerCase().includes(q)) return true;
          if (typeof d.customerPhone === 'string' && d.customerPhone.toLowerCase().includes(q)) return true;
        }
      }
      return false;
    },
    [voiceTranscriptsByMsgId]
  );

  const matchedMessageIds = React.useMemo(() => {
    const q = chatSearchQuery.trim();
    if (!q) return [];
    return sortedThreadMessages.filter((m) => doesMessageMatchQuery(m, q)).map((m) => m.id);
  }, [sortedThreadMessages, chatSearchQuery, doesMessageMatchQuery]);

  const currentMatchedMsgId =
    matchedMessageIds.length > 0
      ? matchedMessageIds[Math.min(activeMatchIndex, matchedMessageIds.length - 1)]
      : null;

  // Reset activeMatchIndex when search query changes
  useEffect(() => {
    setActiveMatchIndex(0);
  }, [chatSearchQuery]);

  // Scroll the currently active matched message into view
  useEffect(() => {
    if (currentMatchedMsgId && messageRowRefs.current[currentMatchedMsgId]) {
      messageRowRefs.current[currentMatchedMsgId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentMatchedMsgId, activeMatchIndex]);

  const handleNextSearchMatch = () => {
    if (matchedMessageIds.length === 0) return;
    setActiveMatchIndex((prev) => (prev + 1) % matchedMessageIds.length);
  };

  const handlePrevSearchMatch = () => {
    if (matchedMessageIds.length === 0) return;
    setActiveMatchIndex((prev) => (prev - 1 + matchedMessageIds.length) % matchedMessageIds.length);
  };

  const renderHighlightedText = (text: string, query: string, isCurrentFocusedMsg: boolean) => {
    const trimmed = query.trim();
    if (!trimmed || !text) return text;
    try {
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
      if (parts.length <= 1) return text;
      return parts.map((part, idx) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark
            key={idx}
            className={`px-1 py-0.2 rounded font-bold transition-colors ${
              isCurrentFocusedMsg
                ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 shadow-2xs'
                : 'bg-yellow-200 text-slate-900'
            }`}
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={idx}>{part}</React.Fragment>
        )
      );
    } catch {
      return text;
    }
  };

  const displayedMessages = React.useMemo(() => {
    if (filterMatchedOnly && chatSearchQuery.trim()) {
      const matchedSet = new Set(matchedMessageIds);
      return sortedThreadMessages.filter((m) => matchedSet.has(m.id));
    }
    return sortedThreadMessages;
  }, [sortedThreadMessages, filterMatchedOnly, chatSearchQuery, matchedMessageIds]);

  // Find the latest message sent by the customer to generate contextual 1-click smart chips
  const lastCustomerMessage = [...sortedThreadMessages].reverse().find((m) => m.sender === 'customer');

  // Compute smart suggested reply chips strictly from Products (ទំនិញ) and Quick Replies & Bot (សាររហ័ស & Bot)
  const smartChips = React.useMemo(() => {
    const priceQr = quickReplies.find((q) => q.shortcut === '/price' || q.category === 'general') || quickReplies[0];
    const payQr = quickReplies.find((q) => q.shortcut === '/aba' || q.category === 'payment');
    const shipQr = quickReplies.find((q) => q.shortcut === '/ship' || q.category === 'delivery');
    const firstProd = products[0];

    const prodPriceChip = firstProd
      ? {
          label: `${firstProd.nameKh} ($${firstProd.price.toFixed(2)})`,
          text: `ជម្រាបសួរបង! សម្រាប់ "${firstProd.nameKh}" តម្លៃគឺ $${firstProd.price.toFixed(2)} (${(
            firstProd.priceKhr || Math.round(firstProd.price * 4100)
          ).toLocaleString()} រៀល) មានក្នុងស្តុកបងចា៎!`,
        }
      : {
          label: priceQr?.titleKh || 'តម្លៃ & ប្រូម៉ូសិន',
          text: priceQr?.content || 'ជម្រាបសួរបង! តើប្អូនអាចជួយអ្វីបានដែរចា៎?',
        };

    const qrPriceChip = priceQr
      ? {
          label: `${priceQr.titleKh || priceQr.title} (${priceQr.shortcut})`,
          text: priceQr.content,
        }
      : prodPriceChip;

    if (!lastCustomerMessage) {
      return [
        qrPriceChip,
        prodPriceChip,
        payQr
          ? { label: payQr.titleKh || 'ABA / KHQR', text: payQr.content }
          : { label: 'ABA / KHQR', text: 'បងអាចស្កេនទូទាត់តាម ABA / KHQR គណនី: 005 452 334 (Sok Chea CHHAI) បានបងចា៎!' },
      ];
    }

    const t = lastCustomerMessage.text.toLowerCase();

    // Check if customer message matches an enabled Auto-Reply Bot rule in សាររហ័ស & Bot
    const matchedBotRule = autoReplies.find(
      (r) => r.enabled && r.triggerKeywords.some((kw) => kw && t.includes(kw.toLowerCase().trim()))
    );

    // Check if customer message mentions any specific product in ទំនិញ
    const matchedProd = products.find(
      (p) =>
        (p.nameKh && t.includes(p.nameKh.toLowerCase())) ||
        (p.name && t.includes(p.name.toLowerCase())) ||
        (p.sku && t.includes(p.sku.toLowerCase()))
    );

    if (matchedProd) {
      return [
        {
          label: `តម្លៃ ${matchedProd.nameKh}: $${matchedProd.price.toFixed(2)}`,
          text: `ជម្រាបសួរបង! សម្រាប់ "${matchedProd.nameKh}" តម្លៃគឺ $${matchedProd.price.toFixed(2)} (${(
            matchedProd.priceKhr || Math.round(matchedProd.price * 4100)
          ).toLocaleString()} រៀល) មានក្នុងស្តុកចំនួន ${matchedProd.stock} ណា៎បងចា៎!`,
        },
        qrPriceChip,
        shipQr
          ? { label: shipQr.titleKh || 'សេវាដឹកជញ្ជូន', text: shipQr.content }
          : { label: 'សេវាដឹកភ្នំពេញ $1.50 / ខេត្ត $2.00', text: 'សេវាដឹកជញ្ជូនភ្នំពេញ $1.50 (១ថ្ងៃដល់) តាមខេត្ត $2.00 (១-២ថ្ងៃដល់) ណា៎បងចា៎!' },
      ];
    }

    if (matchedBotRule) {
      return [
        {
          label: `Bot: ${matchedBotRule.triggerKeywords[0] || 'ឆ្លើយតបអូតូ'}`,
          text: matchedBotRule.responseKh,
        },
        prodPriceChip,
        ...products.slice(1, 3).map((p) => ({
          label: `${p.nameKh} ($${p.price.toFixed(2)})`,
          text: `សម្រាប់ "${p.nameKh}" តម្លៃគឺ $${p.price.toFixed(2)} (${(
            p.priceKhr || Math.round(p.price * 4100)
          ).toLocaleString()} រៀល) មានក្នុងស្តុកបងចា៎!`,
        })),
      ];
    }

    if (t.includes('ថ្លៃ') || t.includes('តម្លៃ') || t.includes('តំលៃ') || t.includes('how much') || t.includes('price')) {
      return [
        qrPriceChip,
        ...products.slice(0, 3).map((p) => ({
          label: `${p.nameKh} ($${p.price.toFixed(2)})`,
          text: `សម្រាប់ "${p.nameKh}" តម្លៃគឺ $${p.price.toFixed(2)} (${(
            p.priceKhr || Math.round(p.price * 4100)
          ).toLocaleString()} រៀល) ណា៎បងចា៎!`,
        })),
      ];
    }

    return [
      qrPriceChip,
      prodPriceChip,
      ...(payQr ? [{ label: payQr.titleKh || 'ABA / KHQR', text: payQr.content }] : []),
      ...(shipQr ? [{ label: shipQr.titleKh || 'សេវាដឹកជញ្ជូន', text: shipQr.content }] : []),
    ];
  }, [lastCustomerMessage, products, quickReplies, autoReplies]);

  // Automatically detect customer phone number and delivery location hints from chat
  const detectedLeadInfo = React.useMemo(() => {
    const customerMsgs = thread.messages.filter((m) => m.sender === 'customer');
    let phoneMatch: string | null = null;
    let addressHint: string | null = null;

    for (const msg of customerMsgs) {
      // Cambodian phone pattern (012..., 098..., 088..., +855...)
      const phoneRegex = /(?:\+?855|0)[1-9]\d{7,8}|\b0\d{2}[- ]?\d{3}[- ]?\d{3,4}\b/;
      const match = msg.text.match(phoneRegex);
      if (match && !phoneMatch) {
        phoneMatch = match[0];
      }
      const t = msg.text;
      if (
        t.includes('ផ្ទះ') ||
        t.includes('ផ្លូវ') ||
        t.includes('ភ្នំពេញ') ||
        t.includes('សៀមរាប') ||
        t.includes('បាត់ដំបង') ||
        t.includes('កំពង់ចាម') ||
        t.includes('ទួលគោក') ||
        t.includes('ចំការមន') ||
        t.includes('សែនសុខ') ||
        t.includes('ខណ្ឌ') ||
        t.includes('សង្កាត់')
      ) {
        if (!addressHint) {
          addressHint = t.length > 50 ? `${t.slice(0, 48)}...` : t;
        }
      }
    }

    if (phoneMatch || addressHint) {
      return {
        phone: phoneMatch || thread.customer.phone,
        address: addressHint || thread.customer.address,
      };
    }
    return null;
  }, [thread.messages, thread.customer]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (stagedImageAttachment) {
      const caption = inputText.trim() || stagedImageAttachment.caption || 'រូបភាព';
      const att = [{ type: 'image', data: { url: stagedImageAttachment.url, caption } }];
      if (chatSendMode === 'customer') {
        dispatchMessageFromChatWindow(inputText.trim() || `📷 [ភ្ញៀវបានផ្ញើរូបភាព: ${caption}]`, att);
      } else {
        dispatchMessageFromChatWindow(inputText.trim() || `📷 រូបភាព: ${caption}`, att);
      }
      setStagedImageAttachment(null);
      setInputText('');
      setShowQuickReplyMenu(false);
      return;
    }
    if (!inputText.trim()) return;
    dispatchMessageFromChatWindow(inputText.trim());
    setInputText('');
    setShowQuickReplyMenu(false);
  };

  const handleSelectQuickReply = (qr: QuickReplyTemplate) => {
    onSendMessage(qr.content);
    setShowQuickReplyMenu(false);
    setInputText('');
  };

  const handleSendProduct = (product: ProductItem) => {
    onSendMessage(`ផលិតផល: ${product.nameKh} (តម្លៃ $${product.price.toFixed(2)})`, [
      {
        type: 'product',
        data: product,
      },
    ]);
    setShowProductPicker(false);
  };

  // Instant 1-Click Order Creation from a Product or KHQR in Chat -> Saves directly into Orders (ការបញ្ជាទិញ) on both Mobile & Desktop
  const handleQuickCreateOrderFromProduct = (product: ProductItem) => {
    setShowProductPicker(false);
    if (!onSaveOrder) {
      onOpenCreateOrder(product);
      return;
    }
    const now = new Date();
    const orderDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const formattedTime = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
    const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const resolvedPhone = detectedLeadInfo?.phone || thread.customer.phone || '012 889 977';
    const resolvedAddress = detectedLeadInfo?.address || thread.customer.address || thread.customer.province || 'ភ្នំពេញ';
    const deliveryFee = (thread.customer.province || 'ភ្នំពេញ') === 'ភ្នំពេញ' ? 1.5 : 2.0;
    const subtotal = Number(product.price || 0);
    const total = subtotal + deliveryFee;

    const newOrder: Order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      orderNumber,
      customerName: thread.customer.name || 'អតិថិជន (Messenger)',
      customerPhone: resolvedPhone,
      customerAddress: resolvedAddress,
      customerProvince: thread.customer.province || 'ភ្នំពេញ',
      items: [
        {
          productId: product.id,
          name: product.nameKh || product.name,
          quantity: 1,
          price: subtotal,
          subtotal,
        },
      ],
      subtotal,
      deliveryFee,
      discount: 0,
      total,
      totalKhr: Math.round(total * 4100),
      paymentMethod: 'aba_khqr',
      deliveryProvider: 'jt',
      status: 'pending',
      createdAt: `${orderDate}, ${formattedTime}`,
      orderDate,
      pageId: selectedPage?.id || thread.pageId,
      threadId: thread.id,
      notes: 'កម្ម៉ង់ផ្ទាល់ពីប្រអប់សារឆាត',
    };

    onSaveOrder(newOrder);
  };

  // Generate & Send Real Bakong KHQR Card (and optionally attach directly to Orders list)
  const handleSendKhqrCard = (amount: number) => {
    const billNumber = `BILL-${Date.now().toString().slice(-6)}`;
    const khqrData = {
      merchantName: khqrConfig.merchantName || 'Sok Chea CHHAI',
      accountNumber: khqrConfig.accountNumber || '005 452 334',
      bankName: khqrConfig.bankName || 'ABA Bank (KHQR / Bakong)',
      amount: amount,
      amountKhr: Math.round(amount * 4100),
      currency: 'USD',
      qrImage: khqrConfig.qrImage || DEFAULT_KHQR_IMAGE,
      billNumber,
      createdAt: new Date().toLocaleTimeString('km-KH'),
    };

    onSendMessage(`វិក្កយបត្រស្កេនទូទាត់ KHQR ចំនួន $${amount.toFixed(2)} (${khqrData.amountKhr.toLocaleString()} រៀល) សូមស្កេនទូទាត់តាមកូដខាងក្រោម:`, [
      {
        type: 'khqr_card',
        data: khqrData,
      },
    ]);

    if (recordKhqrAsOrder && onSaveOrder) {
      const now = new Date();
      const orderDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const formattedTime = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
      const matchedProduct = products.find((p) => Math.abs(p.price - amount) < 0.01) || products[0];
      const itemName = matchedProduct
        ? matchedProduct.nameKh
        : `វិក្កយបត្រទូទាត់ KHQR (${billNumber})`;
      const resolvedPhone = detectedLeadInfo?.phone || thread.customer.phone || '012 889 977';
      const resolvedAddress = detectedLeadInfo?.address || thread.customer.address || thread.customer.province || 'ភ្នំពេញ';

      const newOrder: Order = {
        id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        orderNumber: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName: thread.customer.name || 'អតិថិជន (Messenger)',
        customerPhone: resolvedPhone,
        customerAddress: resolvedAddress,
        customerProvince: thread.customer.province || 'ភ្នំពេញ',
        items: [
          {
            productId: matchedProduct?.id || 'khqr_bill',
            name: itemName,
            quantity: 1,
            price: amount,
            subtotal: amount,
          },
        ],
        subtotal: amount,
        deliveryFee: 0,
        discount: 0,
        total: amount,
        totalKhr: Math.round(amount * 4100),
        paymentMethod: 'aba_khqr',
        deliveryProvider: 'jt',
        status: 'pending',
        createdAt: `${orderDate}, ${formattedTime}`,
        orderDate,
        pageId: selectedPage?.id || thread.pageId,
        threadId: thread.id,
        notes: `ផ្ញើវិក្កយបត្រ KHQR ពីប្រអប់សារ (${billNumber})`,
      };
      onSaveOrder(newOrder);
    }

    setShowKhqrModal(false);
  };

  // Instant Auto Voice-to-Text for all voice messages in thread + Live Speech-to-Text dictation
  const handleAutoVoiceToTextClick = () => {
    // 1. Immediately transcribe all voice messages in the active thread so any voice bubble gets its text in <60ms
    const voiceMsgs = thread.messages.filter((m) => {
      const hasAud = (m.attachments || []).some((a) => a.type === 'audio');
      const isVoiceTxt =
        m.text.includes('[សារសម្លេងពីអតិថិជន') ||
        m.text.includes('[សារសម្លេង / Voice Message]') ||
        m.text.startsWith('🎤');
      return hasAud || isVoiceTxt;
    });

    for (const vm of voiceMsgs) {
      const audAtt = (vm.attachments || []).find((a) => a.type === 'audio');
      const audUrl = audAtt?.data?.url || '';
      const existingTxt = voiceTranscriptsByMsgId[vm.id] || audAtt?.data?.transcript || '';
      handleTranscribeVoiceMessage(vm.id, audUrl, existingTxt);
    }

    // 2. Also toggle live microphone Speech-to-Text dictation into the chat input box
    handleToggleVoiceRecording();
  };

  // Voice Speech-to-Text handler (fast & resilient in iframe/browser)
  const handleToggleVoiceRecording = () => {
    if (isRecordingVoice) {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      setIsRecordingVoice(false);
      return;
    }

    const fallbackVoiceText =
      chatSendMode === 'customer'
        ? products[0]
          ? `សួស្តីបង! "${products[0].nameKh}" ហ្នឹងតម្លៃប៉ុន្មានដែរ ហើយមានក្នុងស្តុកអត់បង?`
          : 'សួស្តីបង! ម៉ូដនេះតម្លៃប៉ុន្មានដែរ ហើយមានក្នុងស្តុកអត់បង?'
        : products[0]
        ? `ចាស៎បង! សម្រាប់ "${products[0].nameKh}" តម្លៃ $${products[0].price.toFixed(2)} មានក្នុងស្តុកបងចា៎!`
        : 'ចាស៎បង អរគុណច្រើនដែលបានទាក់ទងមកហាងយើងខ្ញុំ!';

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceTranscript(fallbackVoiceText);
      setInputText((prev) => (prev ? `${prev} ${fallbackVoiceText}` : fallbackVoiceText));
      inputRef.current?.focus();
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language === 'kh' ? 'km-KH' : 'en-US';
      let capturedAnySpeech = false;

      recognition.onstart = () => {
        setIsRecordingVoice(true);
        setVoiceTranscript('');
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('')
          .trim();
        if (transcript) {
          capturedAnySpeech = true;
          setVoiceTranscript(transcript);
          setInputText(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition fallback:', event.error);
        setIsRecordingVoice(false);
        if (!capturedAnySpeech) {
          setVoiceTranscript(fallbackVoiceText);
          setInputText((prev) => prev || fallbackVoiceText);
          inputRef.current?.focus();
        }
      };

      recognition.onend = () => {
        setIsRecordingVoice(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition setup fallback:', err);
      setIsRecordingVoice(false);
      setVoiceTranscript(fallbackVoiceText);
      setInputText((prev) => prev || fallbackVoiceText);
      inputRef.current?.focus();
    }
  };

  const handleGenerateAIReply = async () => {
    setIsGeneratingAIReply(true);
    setAiSuggestedText(null);
    try {
      const recentMessages = thread.messages.slice(-4).map((m) => ({
        role: m.sender === 'customer' ? 'user' : 'model',
        text: m.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-3.8-flash',
          products,
          quickReplies,
          autoReplies,
          systemInstruction:
            'អ្នកគឺជាជំនួយការ AI Gemini របស់ហាង។ ច្បាប់តឹងរ៉ឹងបំផុត៖ អ្នកត្រូវតែប្រាប់តម្លៃទំនិញ និងព័ត៌មានដែលមាននៅក្នុង [បញ្ជីទំនិញក្នុងហាង (ទំនិញ)] និងក្នុងប្រអប់ [សាររហ័ស & Bot] តែប៉ុណ្ណោះ! ហាមប្រឌិត ឬប្រាប់តម្លៃផ្សេងក្រៅពីតម្លៃក្នុង [ទំនិញ] និង [សាររហ័ស & Bot] ជាដាច់ខាត។ សូមឆ្លើយតបជាភាសាខ្មែរដោយគួរសម ("បាទ/ចា៎", "ណា៎បង") ខ្លីល្មម ២ ប្រយោគ។',
          messages: recentMessages.length > 0 ? recentMessages : [{ role: 'user', text: 'សួស្តីបង តម្លៃប៉ុន្មានដែរ?' }],
        }),
      });
      const data = await res.json();
      if (data.text) {
        setAiSuggestedText(data.text);
      }
    } catch (e) {
      console.error('Failed to generate AI reply:', e);
    } finally {
      setIsGeneratingAIReply(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full max-w-full overflow-hidden bg-slate-50 relative">
      {/* Top Chat Header */}
      <div className="py-1.5 px-2.5 md:py-2 md:px-4 bg-white border-b border-slate-200 flex flex-col gap-1.5 md:gap-2 shrink-0">
        <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
          {/* Dual Original Profile Picture from Facebook Page (រូបដើមអតិថិជន + រូបដើមផេក) */}
          {(() => {
            const custOriginalAvatar = resolveCustomerOriginalPageAvatar(thread.customer, selectedPage);
            const pageOriginalAvatar = resolvePageOriginalAvatar(selectedPage);
            return (
              <div
                className="relative flex items-center shrink-0 cursor-pointer group/avatar"
                onClick={() => {
                  if (onUpdateCustomer) {
                    const psid = thread.customer.psid || thread.customer.id || 'fb_cust';
                    const pageId = selectedPage?.id || thread.pageId || 'page_default';
                    const pageName = selectedPage?.name || 'Facebook Page';
                    const freshUrl = `/api/facebook/avatar/${encodeURIComponent(psid)}?pageId=${encodeURIComponent(pageId)}&name=${encodeURIComponent(thread.customer.name)}&pageName=${encodeURIComponent(pageName)}&t=${Date.now()}`;
                    onUpdateCustomer({ avatarUrl: freshUrl });
                  }
                }}
                title="រូប Profile ដើមពីផេក (ចុចដើម្បីធ្វើបច្ចុប្បន្នភាពរូបដើមពីផេក)"
              >
                <img
                  src={custOriginalAvatar}
                  alt={thread.customer.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.src = buildClientFallbackAvatarDataUrl(
                      thread.customer.name,
                      selectedPage?.name
                    );
                  }}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border-2 border-blue-500 shadow-2xs bg-slate-100 z-10"
                />
                <img
                  src={pageOriginalAvatar}
                  alt={selectedPage?.name || 'Facebook Page'}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.src = buildClientFallbackAvatarDataUrl(
                      selectedPage?.name || 'Page',
                      'FB Page'
                    );
                  }}
                  className="w-5 h-5 md:w-6 md:h-6 rounded-full object-cover border-2 border-white shadow-xs -ml-2 mt-2.5 md:-ml-2.5 md:mt-3.5 bg-white z-20"
                />
                <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-emerald-500 absolute -bottom-0.5 right-0 border-2 border-white z-30"></span>
              </div>
            );
          })()}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 md:gap-1.5 flex-wrap">
              <h2 className="text-xs md:text-sm font-semibold text-slate-900 truncate">
                {thread.customer.name}
              </h2>
              <span className="text-[9.5px] md:text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                <span>រូបដើមពីផេក</span>
              </span>
              {onOpenCustomerProfile && (
                <button
                  type="button"
                  onClick={onOpenCustomerProfile}
                  className="lg:hidden inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9.5px] md:text-[10px] font-bold cursor-pointer shrink-0"
                  title="បើកមើលព័ត៌មានអតិថិជន"
                >
                  <User className="w-3 h-3 text-blue-600" />
                  <span>ព័ត៌មានអតិថិជន</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 md:gap-1.5 text-[10px] md:text-[11px] text-slate-500 truncate">
              {selectedPage && (
                <>
                  <span className="font-semibold text-blue-700 truncate max-w-[115px] md:max-w-[140px]">
                    {selectedPage.name.split(' - ')[0] || selectedPage.name}
                  </span>
                  <span aria-hidden="true">•</span>
                </>
              )}
              <span className="capitalize">{thread.customer.platform}</span>
              <span aria-hidden="true">•</span>
              <span>{thread.customer.province}</span>
              {thread.customer.psid && (
                <>
                  <span aria-hidden="true">•</span>
                  <span className="font-mono text-[10px] text-blue-600 hidden sm:inline">PSID: {thread.customer.psid.slice(0, 10)}...</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Header Actions Row (មកក្រោម) */}
        <div className="flex items-center gap-1 md:gap-1.5 overflow-x-auto scrollbar-none flex-nowrap md:flex-wrap">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 md:gap-1.5 px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] md:text-xs font-bold transition-colors shadow-2xs cursor-pointer shrink-0 whitespace-nowrap"
              aria-label="Back to main inbox"
              title="ត្រឡប់មកប្រអប់ដើមវិញ (Back to Main Inbox)"
            >
              <ArrowLeft className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span>{language === 'kh' ? 'មកប្រអប់ដើមវិញ' : 'Main Inbox'}</span>
            </button>
          )}

          {/* Facebook Live Online Status Badge & Modal Trigger */}
          {selectedPage && onOpenLiveModal && (
            <button
              onClick={onOpenLiveModal}
              className={`flex items-center gap-1 md:gap-1.5 px-2 py-0.5 md:px-2.5 md:py-1 text-[11px] md:text-xs font-semibold rounded-lg border transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                (selectedPage.isLiveOnline || selectedPage.accessToken)
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-2xs'
              }`}
              title={(selectedPage.isLiveOnline || selectedPage.accessToken) ? 'បានតភ្ជាប់ Live Online ជាមួយ Meta Messenger' : 'ចុចបើក Live Online ជាមួយ Facebook'}
            >
              <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${(selectedPage.isLiveOnline || selectedPage.accessToken) ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              <span className="hidden sm:inline">
                {(selectedPage.isLiveOnline || selectedPage.accessToken)
                  ? (language === 'kh' ? '🟢 Messenger Live' : '🟢 Messenger Live') 
                  : (language === 'kh' ? 'បើក Live Online' : 'Go Live Online')}
              </span>
              <span className="sm:hidden">
                {(selectedPage.isLiveOnline || selectedPage.accessToken) ? '🟢 Live' : 'បើក Live'}
              </span>
            </button>
          )}

          {/* Search in Conversation Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen((prev) => {
                const next = !prev;
                if (next) {
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                } else {
                  setChatSearchQuery('');
                  setFilterMatchedOnly(false);
                }
                return next;
              });
            }}
            className={`flex items-center gap-1 md:gap-1.5 px-2 py-0.5 md:px-2.5 md:py-1 text-[11px] md:text-xs font-semibold rounded-lg border transition-colors shadow-2xs cursor-pointer shrink-0 whitespace-nowrap ${
              isSearchOpen || chatSearchQuery.trim()
                ? 'bg-blue-50 text-blue-700 border-blue-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
            title={
              language === 'kh'
                ? 'ស្វែងរកពាក្យគន្លឹះក្នុងការសន្ទនានេះ (Search in conversation)'
                : 'Search keywords in this conversation'
            }
          >
            <Search className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-600" />
            <span className="hidden lg:inline">{language === 'kh' ? 'ស្វែងរក' : 'Search'}</span>
          </button>

          {/* Export Conversation History as PDF Button */}
          {onExportConversationPdf && (
            <button
              type="button"
              onClick={onExportConversationPdf}
              className="flex items-center gap-1 md:gap-1.5 px-2 py-0.5 md:px-2.5 md:py-1 text-[11px] md:text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg transition-colors shadow-2xs cursor-pointer shrink-0 whitespace-nowrap"
              title={
                language === 'kh'
                  ? 'ទាញយកប្រវត្តិសន្ទនាអតិថិជនទាំងអស់ជាឯកសារ PDF (Export Chat PDF)'
                  : 'Export entire conversation history as PDF document'
              }
            >
              <FileDown className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-600" />
              <span className="hidden sm:inline">{language === 'kh' ? 'ទាញយក PDF' : 'Export PDF'}</span>
            </button>
          )}

          {/* Fast Create Order Button */}
          <button
            onClick={() => onOpenCreateOrder()}
            className="flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 text-[11px] md:text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer shrink-0 whitespace-nowrap"
            title="បង្កើតការបញ្ជាទិញរហ័ស"
          >
            <ShoppingBag className="w-3 h-3 md:w-3.5 md:h-3.5" />
            <span className="hidden md:inline">{language === 'kh' ? 'កុម្ម៉ង់' : 'Order'}</span>
          </button>
        </div>
      </div>

      {/* Local Thread Keyword Search Bar */}
      {isSearchOpen && (
        <div className="px-4 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (e.shiftKey) {
                    handlePrevSearchMatch();
                  } else {
                    handleNextSearchMatch();
                  }
                } else if (e.key === 'Escape') {
                  setIsSearchOpen(false);
                  setChatSearchQuery('');
                  setFilterMatchedOnly(false);
                }
              }}
              placeholder={
                language === 'kh'
                  ? 'វាយពាក្យគន្លឹះដើម្បីស្វែងរកសារក្នុងការសន្ទនានេះ...'
                  : 'Search keywords in this conversation...'
              }
              className="w-full pl-8 pr-20 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
            {chatSearchQuery && (
              <button
                type="button"
                onClick={() => setChatSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                title={language === 'kh' ? 'សម្អាតពាក្យស្វែងរក' : 'Clear search'}
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {chatSearchQuery.trim() && (
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-md tabular-nums ${
                  matchedMessageIds.length > 0
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {matchedMessageIds.length > 0
                  ? `${Math.min(activeMatchIndex + 1, matchedMessageIds.length)} / ${matchedMessageIds.length}`
                  : language === 'kh'
                  ? '០ លទ្ធផល'
                  : '0 matches'}
              </span>
            )}

            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              <button
                type="button"
                onClick={handlePrevSearchMatch}
                disabled={matchedMessageIds.length === 0}
                className="p-1.5 text-slate-600 hover:bg-slate-200/70 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                title={language === 'kh' ? 'លទ្ធផលមុន (Shift+Enter)' : 'Previous match (Shift+Enter)'}
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextSearchMatch}
                disabled={matchedMessageIds.length === 0}
                className="p-1.5 text-slate-600 hover:bg-slate-200/70 border-l border-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                title={language === 'kh' ? 'លទ្ធផលបន្ទាប់ (Enter)' : 'Next match (Enter)'}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setFilterMatchedOnly((prev) => !prev)}
              disabled={!chatSearchQuery.trim()}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
                filterMatchedOnly
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title={
                language === 'kh'
                  ? 'បង្ហាញតែសារដែលត្រូវនឹងពាក្យស្វែងរក'
                  : 'Show only matching messages'
              }
            >
              <Filter className="w-3 h-3" />
              <span className="hidden sm:inline">
                {language === 'kh' ? 'បង្ហាញតែសារត្រូវ' : 'Filter Matches'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                setChatSearchQuery('');
                setFilterMatchedOnly(false);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title={language === 'kh' ? 'បិទការស្វែងរក (Esc)' : 'Close search (Esc)'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Auto-Pilot Active Notification Banner */}
      {isAutoPilot && (
        <div className="px-4 py-2 bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white text-xs flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0 shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="font-semibold">
              🤖 ប្រព័ន្ធ AI Auto-Pilot (Gemini 3.8 Flash) កំពុងឆ្លើយតបលើ Messenger អូតូ ២៤/៧
            </span>
            <div className="flex items-center gap-1 text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-white/20 font-bold">ភាសាខ្មែរ</span>
              <span className="px-1.5 py-0.5 rounded bg-white/20 font-bold">English</span>
              <span className="px-1.5 py-0.5 rounded bg-white/20 font-bold">中文</span>
              <span className="px-1.5 py-0.5 rounded bg-white/20 font-bold">ខ្មែរឡាតាំង</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
            <button
              onClick={onToggleAutoPilot}
              className="text-[10px] underline opacity-80 hover:opacity-100 font-semibold px-2 py-0.5 rounded bg-black/20 hover:bg-black/30 transition-all ml-1 cursor-pointer"
            >
              បិទ Auto
            </button>
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2.5 space-y-2.5 md:p-4 md:space-y-4">
        {displayedMessages.length === 0 && chatSearchQuery.trim() ? (
          <div className="py-12 text-center text-slate-400">
            <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">
              {language === 'kh'
                ? `មិនพบសារដែលត្រូវនឹង "${chatSearchQuery}" ទេ`
                : `No messages matching "${chatSearchQuery}"`}
            </p>
            <button
              type="button"
              onClick={() => setFilterMatchedOnly(false)}
              className="mt-2 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              {language === 'kh' ? 'បង្ហាញសារទាំងអស់វិញ' : 'Show all messages'}
            </button>
          </div>
        ) : displayedMessages.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {language === 'kh'
                  ? 'ពេលបើកកម្មវិធី Online — រង់ចាំទទួលតែសារថ្មីៗពីអតិថិជនចូលមកប៉ុណ្ណោះ'
                  : 'Online Mode — Waiting for new incoming customer messages only'}
              </span>
            </div>
          </div>
        ) : null}
        {displayedMessages.map((msg) => {
          const isMe = msg.sender === 'admin' || msg.sender === 'bot';
          const isBot = msg.sender === 'bot';
          const isMatched = matchedMessageIds.includes(msg.id);
          const isCurrentMatch = currentMatchedMsgId === msg.id;

          const custMsgAvatar = resolveCustomerOriginalPageAvatar(thread.customer, selectedPage);
          const pageMsgAvatar = resolvePageOriginalAvatar(selectedPage);

          return (
            <div
              key={msg.id}
              ref={(el) => {
                messageRowRefs.current[msg.id] = el;
              }}
              className={`flex flex-col transition-all ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1 px-1 text-[10px] md:text-[11px] text-slate-400">
                {/* Dual Original Profile Avatar on Every Message in Chat (រូបដើមពីផេក) */}
                {!isMe ? (
                  <div className="relative flex items-center shrink-0" title={`រូបដើមពីផេក៖ ${thread.customer.name}`}>
                    <img
                      src={custMsgAvatar}
                      alt={msg.senderName}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = buildClientFallbackAvatarDataUrl(
                          msg.senderName || thread.customer.name,
                          selectedPage?.name
                        );
                      }}
                      className="w-5 h-5 md:w-6 md:h-6 rounded-full object-cover border border-blue-400 bg-slate-100"
                    />
                    <img
                      src={pageMsgAvatar}
                      alt={selectedPage?.name || 'Page'}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = buildClientFallbackAvatarDataUrl(
                          selectedPage?.name || 'Page',
                          'FB Page'
                        );
                      }}
                      className="w-3 h-3 md:w-3.5 md:h-3.5 rounded-full object-cover border border-white -ml-1.5 mt-1.5 md:mt-2 bg-white shadow-2xs"
                    />
                  </div>
                ) : (
                  <img
                    src={pageMsgAvatar}
                    alt={selectedPage?.name || 'Page'}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src = buildClientFallbackAvatarDataUrl(
                        selectedPage?.name || 'Page',
                        'FB Page'
                      );
                    }}
                    className="w-4 h-4 md:w-5 md:h-5 rounded-full object-cover border border-blue-300 bg-white shrink-0"
                  />
                )}
                {isBot && (
                  <span className="inline-flex items-center gap-0.5 text-purple-700 font-semibold bg-purple-50 px-1.5 py-0.5 rounded text-[10px]">
                    <Bot className="w-3 h-3 text-purple-600" />
                    <span>AI Auto-Pilot</span>
                  </span>
                )}
                <span className="font-medium text-slate-600 truncate max-w-[140px] md:max-w-none">
                  {chatSearchQuery.trim()
                    ? renderHighlightedText(msg.senderName, chatSearchQuery, isCurrentMatch)
                    : msg.senderName}
                </span>
                <span>•</span>
                <span className="shrink-0">{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[82%] md:max-w-[70%] rounded-xl md:rounded-2xl px-2.5 py-1.5 md:px-4 md:py-2.5 text-xs md:text-sm leading-snug md:leading-relaxed shadow-xs relative group transition-all ${
                  isMe
                    ? isBot
                      ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white rounded-br-xs'
                      : 'bg-blue-600 text-white rounded-br-xs'
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                } ${
                  isCurrentMatch
                    ? 'ring-3 ring-amber-400 shadow-md'
                    : isMatched
                    ? 'ring-2 ring-amber-300/70'
                    : ''
                }`}
              >
                {editingMessageId === msg.id ? (
                  <div className="space-y-2 py-0.5 min-w-0 w-full sm:min-w-[240px] md:min-w-[320px]">
                    <div className="flex items-center justify-between pb-1 border-b border-current/20 text-xs font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{language === 'kh' ? 'កែប្រែខ្លឹមសារសារ' : 'Editing message / document'}</span>
                      </span>
                    </div>
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      rows={Math.max(2, Math.min(5, editingText.split('\n').length))}
                      className={`w-full p-2 text-xs rounded-lg focus:outline-none focus:ring-2 resize-y font-normal ${
                        isMe
                          ? 'bg-white/20 text-white placeholder-white/70 border border-white/30 focus:ring-white'
                          : 'bg-slate-50 text-slate-900 border border-slate-300 focus:ring-blue-500'
                      }`}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          handleSaveEditedMessage(msg.id);
                        } else if (e.key === 'Escape') {
                          setEditingMessageId(null);
                        }
                      }}
                    />
                    <div className="flex items-center justify-between pt-1">
                      <span className={`text-[10px] ${isMe ? 'text-white/80' : 'text-slate-400'}`}>
                        Ctrl + Enter {language === 'kh' ? 'ដើម្បីរក្សាទុក' : 'to save'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingMessageId(null)}
                          className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                            isMe
                              ? 'bg-white/20 hover:bg-white/30 text-white'
                              : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                          }`}
                        >
                          {language === 'kh' ? 'បោះបង់' : 'Cancel'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditedMessage(msg.id)}
                          className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs transition-colors cursor-pointer"
                          title="រក្សាទុកការកែប្រែ"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{language === 'kh' ? 'រក្សាទុក' : 'Save'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2.5">
                      <p className="whitespace-pre-wrap flex-1 leading-relaxed">
                        {chatSearchQuery.trim()
                          ? renderHighlightedText(msg.text, chatSearchQuery, isCurrentMatch)
                          : msg.text}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMessageId(msg.id);
                          setEditingText(msg.text);
                        }}
                        className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                          isMe
                            ? 'bg-white/20 hover:bg-white/30 text-white shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                        }`}
                        title={language === 'kh' ? 'កែប្រែសារនេះ (Edit)' : 'Edit this item'}
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{language === 'kh' ? 'កែប្រែ' : 'Edit'}</span>
                      </button>
                    </div>

                    {msg.isEdited && (
                      <span className={`block mt-1 text-[10px] italic ${isMe ? 'text-white/80' : 'text-slate-400'}`}>
                        ({language === 'kh' ? 'បានកែប្រែ' : 'Edited'})
                      </span>
                    )}

                    {saveSuccessMsgId === msg.id && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded animate-in fade-in">
                        <Check className="w-3 h-3 text-emerald-300" />
                        <span>{language === 'kh' ? 'បានរក្សាទុករួចរាល់!' : 'Saved!'}</span>
                      </span>
                    )}
                  </>
                )}

                {/* Render Attachments (including automatic audio player for 🎤 [សារសម្លេងពីអតិថិជន / Voice Message]) */}
                {(() => {
                  const rawAttachments = (Array.isArray(msg.attachments) ? msg.attachments : []).map((a) => {
                    if (a.type === 'image') {
                      const u = String(a.data?.url || a.data?.rawUrl || (a as any).url || '').toLowerCase();
                      const looksLikeVoiceUrl =
                        u.includes('audioclip') ||
                        u.includes('/t59.3654-21/') ||
                        u.includes('type=audio') ||
                        /\.(mp3|wav|ogg|aac|m4a|opus|webm)(\?|$)/i.test(u) ||
                        (u.includes('fbsbx.com') && u.includes('.mp4'));
                      if (looksLikeVoiceUrl) {
                        return {
                          ...a,
                          type: 'audio' as const,
                          data: {
                            ...a.data,
                            url: a.data?.url || a.data?.rawUrl || '',
                          },
                        };
                      }
                    }
                    return a;
                  });
                  const hasAudioAtt = rawAttachments.some((a) => a.type === 'audio');
                  const isVoiceMsgText =
                    msg.text.startsWith('🎤') ||
                    msg.text.includes('[សារសម្លេង') ||
                    msg.text.includes('សារសម្លេង (') ||
                    msg.text.includes('Voice Message');
                  const isRealFbMsg = String(msg.id || '').startsWith('m_');
                  const fallbackAudioUrl = isRealFbMsg
                    ? `/api/facebook/media-proxy?type=audio&mid=${encodeURIComponent(msg.id)}&pageId=${encodeURIComponent(
                        selectedPage?.id || thread.pageId || ''
                      )}${selectedPage?.accessToken ? `&token=${encodeURIComponent(selectedPage.accessToken)}` : ''}`
                    : `/api/ai/tts-stream?v=4&text=${encodeURIComponent(voiceTranscriptsByMsgId[msg.id] || msg.text || '')}`;
                  const effectiveAttachments =
                    !hasAudioAtt && isVoiceMsgText
                      ? [
                          ...rawAttachments,
                          {
                            type: 'audio' as const,
                            data: {
                              url: fallbackAudioUrl,
                              mid: isRealFbMsg ? msg.id : undefined,
                              duration: '0:04',
                              transcript: voiceTranscriptsByMsgId[msg.id] || '',
                            },
                          },
                        ]
                      : rawAttachments;

                  if (effectiveAttachments.length === 0) return null;
                  return (
                    <div className="mt-2 space-y-2">
                      {effectiveAttachments.map((att, idx) => {
                      if (att.type === 'product') {
                        const prod = att.data as ProductItem;
                        return (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl bg-white text-slate-900 border border-slate-200 flex flex-col gap-2"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={prod.imageUrl}
                                alt={prod.nameKh}
                                referrerPolicy="no-referrer"
                                className="w-12 h-12 rounded-lg object-cover border border-slate-100 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold truncate">
                                  {chatSearchQuery.trim()
                                    ? renderHighlightedText(prod.nameKh, chatSearchQuery, isCurrentMatch)
                                    : prod.nameKh}
                                </p>
                                <p className="text-[11px] text-blue-600 font-bold tabular-nums">
                                  ${prod.price.toFixed(2)} ({prod.priceKhr.toLocaleString()} រៀល)
                                </p>
                                <p className="text-[10px] text-slate-500">ស្តុកនៅសល់: {prod.stock}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleQuickCreateOrderFromProduct(prod)}
                                className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                title="កត់ចូលក្នុងបញ្ជីការបញ្ជាទិញ (Orders) ភ្លាមៗ"
                              >
                                <ShoppingBag className="w-3 h-3" />
                                <span>{language === 'kh' ? '+ ដាក់ចូលការបញ្ជាទិញភ្លាម' : '+ Add to Orders'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenCreateOrder(prod)}
                                className="py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
                                title="បើកផ្ទាំងកែប្រែបុង"
                              >
                                {language === 'kh' ? 'កែបុង' : 'Customize'}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // Render Official Bakong KHQR Payment Card
                      if (att.type === 'khqr_card') {
                        const qrd = att.data;
                        const currentQrImg = qrd.qrImage || khqrConfig.qrImage || DEFAULT_KHQR_IMAGE;

                        return (
                          <div
                            key={idx}
                            className="p-3.5 rounded-2xl bg-white text-slate-900 border-2 border-red-500 shadow-md max-w-sm text-left group/qr relative"
                          >
                            {/* KHQR Header Banner */}
                            <div className="bg-red-600 text-white px-3 py-1.5 rounded-xl flex items-center justify-between mb-3 shadow-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold tracking-wider text-xs">KHQR</span>
                                <span className="text-[10px] opacity-90">| Bakong</span>
                              </div>
                              <span className="text-[10px] font-semibold bg-white text-red-600 px-1.5 py-0.5 rounded">
                                ABA Pay
                              </span>
                            </div>

                            {/* Merchant & Amount Details */}
                            <div className="text-center mb-2.5">
                              <p className="text-xs font-bold text-slate-800">{qrd.merchantName || khqrConfig.merchantName || 'Sok Chea CHHAI'}</p>
                              <div className="text-xl font-extrabold text-red-600 tabular-nums tracking-tight my-0.5">
                                ${Number(qrd.amount).toFixed(2)}
                              </div>
                              <p className="text-[11px] text-slate-500 font-medium">
                                ស្មើនឹង {Number(qrd.amountKhr).toLocaleString()} រៀល
                              </p>
                            </div>

                            {/* Realistic QR Graphic */}
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center my-2">
                              <div className="w-44 h-44 bg-white p-1.5 border border-slate-300 rounded-xl flex items-center justify-center relative shadow-xs overflow-hidden">
                                <img
                                  src={currentQrImg}
                                  alt="KHQR Bakong Sok Chea CHHAI"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = FALLBACK_KHQR_IMAGE;
                                  }}
                                  className="w-full h-full object-contain rounded-lg"
                                />
                              </div>
                              <p className="text-[10px] text-slate-500 mt-2 text-center font-medium">
                                ស្កេនទូទាត់ជាមួយកម្មវិធីធនាគារណាក៏បាន (Bakong, ABA, Wing, ACLEDA)
                              </p>
                              {/* Quick action to replace / insert new KHQR image right into this card */}
                              <div className="mt-2.5 flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => khqrFileInputRef.current?.click()}
                                  className="text-[10px] font-semibold text-red-700 bg-red-100 hover:bg-red-200 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                                  title="ប្តូររូបភាព KHQR ផ្ទាល់ខ្លួនរបស់អ្នក"
                                >
                                  <Upload className="w-3 h-3" />
                                  <span>ប្តូររូប KHQR ថ្មី</span>
                                </button>
                              </div>
                            </div>

                            {/* Account Details & Copy Button */}
                            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                              <div>
                                <span className="text-[10px] text-slate-400 block">លេខគណនី ABA</span>
                                <span className="font-mono font-bold text-slate-800">{qrd.accountNumber || '005 452 334'}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(qrd.accountNumber || '005452334');
                                  setCopiedAccount(true);
                                  setTimeout(() => setCopiedAccount(false), 2000);
                                }}
                                className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition-colors"
                              >
                                {copiedAccount ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                <span>{copiedAccount ? 'ចម្លងរួច!' : 'ចម្លងលេខកុង'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (att.type === 'image') {
                        const imgData = att.data || {};
                        const rawImgUrl = imgData.url || (att as any).url || '';
                        const imgUrl = rawImgUrl || FALLBACK_CHAT_IMAGE_SVG;
                        const imgCaption = imgData.caption || '';
                        return (
                          <div
                            key={idx}
                            className="rounded-xl overflow-hidden bg-white text-slate-900 border border-slate-200 shadow-sm max-w-xs"
                          >
                            <div
                              onClick={() => setPreviewImageModalUrl(imgUrl)}
                              className="relative group/img cursor-pointer bg-slate-100 min-h-[120px] flex items-center justify-center"
                            >
                              <img
                                src={imgUrl}
                                alt={imgCaption || 'Chat Image'}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  const currentSrc = target.getAttribute('src') || '';
                                  // First retry through server proxy if it is an external URL
                                  if (
                                    currentSrc.startsWith('http') &&
                                    !currentSrc.includes('/api/facebook/proxy-media')
                                  ) {
                                    target.src = `/api/facebook/proxy-media?url=${encodeURIComponent(currentSrc)}`;
                                    return;
                                  }
                                  // Final fallback to crisp SVG so a "?" broken image icon NEVER appears
                                  if (currentSrc !== FALLBACK_CHAT_IMAGE_SVG) {
                                    target.src = FALLBACK_CHAT_IMAGE_SVG;
                                  }
                                }}
                                className="w-full max-h-64 object-cover block hover:opacity-95 transition-opacity"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/25 transition-colors flex items-center justify-center">
                                <span className="opacity-0 group-hover/img:opacity-100 bg-black/75 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full transition-opacity">
                                  🔍 ចុចមើលរូបធំច្បាស់
                                </span>
                              </div>
                            </div>
                            <div className="px-3 py-1.5 bg-white text-xs text-slate-700 font-medium flex items-center justify-between gap-2 border-t border-slate-100">
                              <span className="truncate">
                                {chatSearchQuery.trim()
                                  ? renderHighlightedText(imgCaption || '📷 រូបភាពក្នុងឆាត', chatSearchQuery, isCurrentMatch)
                                  : imgCaption || '📷 រូបភាពក្នុងឆាត'}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setPreviewImageModalUrl(imgUrl)}
                                  className="text-[10px] text-indigo-600 hover:underline font-semibold cursor-pointer"
                                >
                                  មើលរូប
                                </button>
                                <a
                                  href={imgUrl}
                                  download={`chat-image-${Date.now()}.jpg`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] text-blue-600 hover:underline font-semibold"
                                >
                                  ទាញយក
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Render Interactive Voice Sound (Audio) Bubble
                      if (att.type === 'audio') {
                        const audData = att.data || {};
                        const audioUrl = audData.url || audData.rawDataUrl || (att as any).url || '';
                        const durationStr = audData.duration || '0:04';
                        const msgQuotedMatch =
                          msg.text?.match(/:\s*"([^"]+)"/) || msg.text?.match(/:\s*(.+)$/);
                        const fallbackFromText =
                          msgQuotedMatch &&
                          msgQuotedMatch[1] &&
                          !msgQuotedMatch[1].includes('[សារសម្លេង')
                            ? msgQuotedMatch[1].replace(/^"|"$/g, '').trim()
                            : '';
                        const recognizedText =
                          voiceTranscriptsByMsgId[msg.id] ||
                          audData.transcript ||
                          fallbackFromText ||
                          '';
                        const isPlayingThis = playingAudioId === msg.id;
                        const isTranscribingThis = !!transcribingMsgIds[msg.id];
                        const isTranscribedSuccessThis = !!transcribedSuccessMsgIds[msg.id];
                        const isEditingThisTranscript = editingVoiceTranscriptMsgId === msg.id;
                        const isDictatingThisTranscript = dictatingVoiceMsgId === msg.id;
                        const isRecordingReplyForThis = isRecordingAudioClip && replyingVoiceToMsgId === msg.id;

                        return (
                          <div
                            key={idx}
                            className={`p-2 md:p-3 rounded-xl md:rounded-2xl border shadow-xs min-w-0 w-full md:min-w-[260px] max-w-[240px] sm:max-w-xs md:max-w-sm transition-all ${
                              isMe
                                ? 'bg-white/15 border-white/25 text-white'
                                : 'bg-indigo-50/90 border-indigo-200/90 text-slate-900'
                            }`}
                          >
                            <div className="flex items-center gap-2 md:gap-2.5">
                              <button
                                type="button"
                                onClick={() => handlePlayVoiceAttachment(msg.id, audioUrl, recognizedText)}
                                className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 shadow-xs transition-transform active:scale-95 cursor-pointer ${
                                  isMe
                                    ? 'bg-white text-blue-600 hover:bg-blue-50'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                                title={isPlayingThis ? 'ផ្អាកសម្លេង (Pause Voice)' : 'ចុចស្តាប់សារសម្លេង (Play Voice Sound)'}
                              >
                                {isPlayingThis ? <Pause className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Play className="w-3.5 h-3.5 md:w-4 md:h-4 ml-0.5" />}
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className={`text-[11px] font-bold flex items-center gap-1 ${isMe ? 'text-white' : 'text-indigo-950'}`}>
                                    <Volume2 className={`w-3.5 h-3.5 ${isPlayingThis ? 'animate-bounce' : ''}`} />
                                    <span>សារសម្លេង (Voice Sound)</span>
                                  </span>
                                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isMe ? 'bg-black/20 text-white' : 'bg-white text-indigo-700'}`}>
                                    {durationStr}
                                  </span>
                                </div>

                                {/* Animated Voice Waveform Bars */}
                                <div className="flex items-center gap-0.5 h-5 my-1">
                                  {[35, 65, 90, 50, 80, 100, 60, 40, 85, 95, 55, 75, 45, 70, 60, 40, 80, 50].map((h, barIdx) => (
                                    <span
                                      key={barIdx}
                                      style={{ height: `${isPlayingThis ? Math.max(25, (h + ((barIdx * 19) % 40)) % 100) : h}%` }}
                                      className={`w-1 rounded-full transition-all duration-150 ${
                                        isPlayingThis
                                          ? isMe
                                            ? 'bg-emerald-300 animate-pulse'
                                            : 'bg-indigo-600 animate-pulse'
                                          : isMe
                                          ? 'bg-white/60'
                                          : 'bg-indigo-300'
                                      }`}
                                    />
                                  ))}
                                </div>

                                <div className="flex items-center justify-between gap-1.5 mt-1 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextRate = audioPlaybackRate === 1 ? 1.5 : 1;
                                      setAudioPlaybackRate(nextRate);
                                      if (audioElementsRef.current[msg.id]) {
                                        audioElementsRef.current[msg.id].playbackRate = nextRate;
                                      }
                                    }}
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer ${
                                      isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                                    }`}
                                    title="ប្តូរល្បឿនសម្លេង"
                                  >
                                    {audioPlaybackRate}x
                                  </button>

                                  <div className="flex items-center gap-1 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => handleTranscribeVoiceMessage(msg.id, audioUrl, recognizedText)}
                                      disabled={isTranscribingThis}
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors ${
                                        isMe
                                          ? 'bg-white/20 hover:bg-white/30 text-white'
                                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                      }`}
                                      title="ចុចបកសម្លេងនេះជាអក្សរភ្លាមៗ (Auto Voice-to-Text)"
                                    >
                                      <Sparkles className={`w-2.5 h-2.5 ${isTranscribingThis ? 'animate-spin' : ''}`} />
                                      <span>
                                        {isTranscribingThis
                                          ? 'កំពុងបកភ្លាមៗ...'
                                          : isTranscribedSuccessThis
                                          ? '✓ បានបកជាអក្សរ'
                                          : 'បកសម្លេងជាអក្សរ'}
                                      </span>
                                    </button>

                                    {/* Direct Voice Reply Button right inside the Voice Bubble */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!isMe) {
                                          setChatSendMode('admin');
                                        }
                                        setReplyingVoiceToMsgId(msg.id);
                                        handleToggleRecordAudioClip();
                                      }}
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors ${
                                        isRecordingReplyForThis
                                          ? 'bg-rose-600 text-white animate-pulse'
                                          : isMe
                                          ? 'bg-emerald-500/80 hover:bg-emerald-500 text-white'
                                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                      }`}
                                      title="ចុចដើម្បីថតសម្លេងឆ្លើយតបទៅវិញភ្លាមៗក្នុងប្រអប់សារ"
                                    >
                                      <Mic className="w-2.5 h-2.5" />
                                      <span>
                                        {isRecordingReplyForThis
                                          ? `ផ្ញើ Voice (0:${String(recordingSeconds).padStart(2, '0')})`
                                          : 'Voice សម្លេងទៅវិញ'}
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Always-Visible Clickable Auto Voice-to-Text Section with Instant Transcribe, Mic Dictation & Edit */}
                            <div
                              className={`mt-2 pt-2 border-t text-xs leading-relaxed ${
                                isMe ? 'border-white/20 text-white/95' : 'border-indigo-200/70 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 mb-1 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleTranscribeVoiceMessage(msg.id, audioUrl, recognizedText)}
                                  className={`text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded flex items-center gap-1 transition-all cursor-pointer ${
                                    isMe
                                      ? 'bg-white/15 hover:bg-white/25 text-emerald-200'
                                      : 'bg-indigo-100/90 hover:bg-indigo-200 text-indigo-800'
                                  }`}
                                  title="ចុចដើម្បីបកសម្លេងជាអក្សរភ្លាមៗ (Auto Voice-to-Text)"
                                >
                                  <span>🎙️ បកសម្លេងជាអក្សរ (Auto Voice-to-Text)</span>
                                  {isTranscribedSuccessThis && (
                                    <span className="text-[9px] bg-emerald-500 text-white px-1 rounded">✓ រួចរាល់</span>
                                  )}
                                </button>
                                <div className="flex items-center gap-1 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleDictateTranscriptForVoiceMsg(msg.id, recognizedText)}
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 cursor-pointer ${
                                      isDictatingThisTranscript
                                        ? 'bg-rose-600 text-white animate-pulse'
                                        : isMe
                                        ? 'bg-white/20 hover:bg-white/30 text-white'
                                        : 'bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                                    }`}
                                    title="និយាយតាមម៉ៃក្រូហ្វូនដើម្បីបកជាអក្សរផ្ទាល់"
                                  >
                                    <Mic className="w-2.5 h-2.5" />
                                    <span>{isDictatingThisTranscript ? 'កំពុងស្តាប់...' : 'និយាយកែ'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isEditingThisTranscript) {
                                        setEditingVoiceTranscriptMsgId(null);
                                      } else {
                                        setEditingVoiceTranscriptMsgId(msg.id);
                                        setEditingVoiceTranscriptText(recognizedText);
                                      }
                                    }}
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 cursor-pointer ${
                                      isMe
                                        ? 'bg-white/20 hover:bg-white/30 text-white'
                                        : 'bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                                    }`}
                                    title="កែសម្រួលអក្សរដែលបកពីសម្លេងឱ្យត្រូវតាមសម្លេងនិយាយ"
                                  >
                                    <Pencil className="w-2.5 h-2.5" />
                                    <span>{isEditingThisTranscript ? 'បិទ' : 'កែអក្សរ'}</span>
                                  </button>
                                  {!isMe && onTriggerAiAutoReply && (
                                    <button
                                      type="button"
                                      onClick={onTriggerAiAutoReply}
                                      className="text-[10px] font-bold bg-indigo-100 hover:bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded cursor-pointer"
                                    >
                                      🤖 ឱ្យ AI ឆ្លើយតប
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isEditingThisTranscript ? (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <input
                                    type="text"
                                    value={editingVoiceTranscriptText}
                                    onChange={(e) => setEditingVoiceTranscriptText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveEditedVoiceTranscript(msg.id);
                                      }
                                    }}
                                    placeholder="កែអក្សរឱ្យត្រូវតាមសម្លេងនិយាយ..."
                                    className="flex-1 px-2 py-1 text-xs rounded border border-indigo-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditedVoiceTranscript(msg.id)}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded cursor-pointer shrink-0"
                                  >
                                    រក្សាទុក
                                  </button>
                                </div>
                              ) : isTranscribingThis && !recognizedText ? (
                                <p className="italic text-[11px] opacity-80 animate-pulse">
                                  កំពុងបកសម្លេងជាអក្សរភ្លាមៗ...
                                </p>
                              ) : recognizedText ? (
                                <p className="italic font-medium">
                                  "
                                  {chatSearchQuery.trim()
                                    ? renderHighlightedText(recognizedText, chatSearchQuery, isCurrentMatch)
                                    : recognizedText}
                                  "
                                </p>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleTranscribeVoiceMessage(msg.id, audioUrl, recognizedText)}
                                  className="text-[11px] underline font-semibold opacity-90 hover:opacity-100 cursor-pointer"
                                >
                                  ចុចទីនេះដើម្បីបកសម្លេងជាអក្សរភ្លាមៗ...
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }

                      if (att.type === 'order_invoice') {
                        const ord = att.data || {};
                        const matchedOrder = orders.find(
                          (o) => (ord.id && o.id === ord.id) || (ord.orderNumber && o.orderNumber === ord.orderNumber)
                        );
                        const displayOrd = matchedOrder || ord;
                        const totalUsd = Number(displayOrd.total || 0);
                        const totalKhr = Number(displayOrd.totalKhr || Math.round(totalUsd * 4100));

                        return (
                          <div
                            key={idx}
                            className="p-2.5 md:p-3.5 rounded-xl bg-slate-900 text-white border border-slate-700 flex flex-col gap-2 md:gap-2.5 shadow-md min-w-0 w-full md:min-w-[240px] max-w-[245px] md:max-w-none"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                                  📄
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-bold text-white">
                                      វិក្កយបត្រ #
                                      {chatSearchQuery.trim()
                                        ? renderHighlightedText(displayOrd.orderNumber || 'ORD', chatSearchQuery, isCurrentMatch)
                                        : displayOrd.orderNumber || 'ORD'}
                                    </p>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                                      {displayOrd.status === 'confirmed' ? 'បានបញ្ជាក់' : displayOrd.status === 'paid' ? 'បានទូទាត់' : 'កុម្ម៉ង់ថ្មី'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-emerald-400 font-extrabold tabular-nums mt-0.5">
                                    សរុប: ${totalUsd.toFixed(2)} ({totalKhr.toLocaleString()} រៀល)
                                  </p>
                                </div>
                              </div>
                            </div>

                            {Array.isArray(displayOrd.items) && displayOrd.items.length > 0 && (
                              <div className="text-[11px] text-slate-300 bg-slate-800/80 rounded-lg p-2 space-y-1 border border-slate-700/80">
                                {displayOrd.items.map((item: any, iIdx: number) => (
                                  <div key={iIdx} className="flex items-center justify-between gap-2">
                                    <span className="truncate">• {item.nameKh || item.name} ×{item.quantity}</span>
                                    <span className="font-mono font-semibold text-white shrink-0">
                                      ${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                              <span className="text-[10px] text-slate-400 truncate">
                                📞 {displayOrd.customerPhone || thread.customer.phone}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const targetId = matchedOrder?.id || displayOrd.id;
                                    if (targetId) {
                                      onViewOrderInvoice(targetId);
                                    }
                                  }}
                                  className="px-2.5 py-1 text-xs bg-slate-800 text-slate-200 font-medium rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
                                >
                                  {language === 'kh' ? 'មើលបុង' : 'View'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const targetId = matchedOrder?.id || displayOrd.id;
                                    if (targetId && onEditOrderInvoice) {
                                      onEditOrderInvoice(targetId);
                                    } else if (targetId) {
                                      onViewOrderInvoice(targetId);
                                    }
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
                                  title="កែប្រែឯកសារវិក្កយបត្រនេះ"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>{language === 'kh' ? 'កែប្រែ' : 'Edit Doc'}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Quick Voice Reply button under incoming customer messages */}
              {!isMe && (
                <div className="flex items-center gap-2 mt-1 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setChatSendMode('admin');
                      setReplyingVoiceToMsgId(msg.id);
                      handleToggleRecordAudioClip();
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                      isRecordingAudioClip && replyingVoiceToMsgId === msg.id
                        ? 'bg-rose-600 text-white animate-pulse shadow-xs'
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                    }`}
                    title="ចុចថតសម្លេងឆ្លើយតបទៅអតិថិជនវិញភ្លាមៗក្នុងប្រអប់សារ"
                  >
                    <Mic className="w-2.5 h-2.5" />
                    <span>
                      {isRecordingAudioClip && replyingVoiceToMsgId === msg.id
                        ? `កំពុងថតសម្លេង... ចុចដើម្បីផ្ញើ (0:${String(recordingSeconds).padStart(2, '0')})`
                        : '🎙️ Voice សម្លេងទៅវិញ'}
                    </span>
                  </button>
                </div>
              )}

              {/* Delivery status indicator for admin messages */}
              {isMe && !isBot && (
                <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px]">
                  {(msg.deliveryStatus === 'sent_meta' || msg.deliveryStatus === 'sent_local' || !msg.deliveryStatus) && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-medium" title="ផ្ញើទៅកាន់ Meta Business Messenger (Facebook) បានជោគជ័យ">
                      <CheckCheck className="w-3 h-3 text-emerald-500" />
                      <span>Meta Messenger Live</span>
                    </span>
                  )}
                  {msg.deliveryStatus === 'sending_meta' && (
                    <span className="inline-flex items-center gap-1 text-blue-500 font-medium" title="កំពុងបញ្ជូនទៅ Meta...">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      <span>ផ្ញើទៅ Meta...</span>
                    </span>
                  )}
                  {msg.deliveryStatus === 'failed_meta' && (
                    <span className="inline-flex items-center gap-1 text-rose-500 font-medium" title={msg.metaError || 'បញ្ជូនមិនជោគជ័យ'}>
                      <AlertCircle className="w-3 h-3 text-rose-500" />
                      <span>បរាជ័យ</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isAiAutoReplying && (
          <div className="flex items-center justify-end animate-in fade-in duration-150">
            <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 text-white px-3.5 py-2.5 rounded-2xl rounded-br-none shadow-md flex items-center gap-2 text-xs font-medium">
              <Bot className="w-4 h-4 animate-bounce shrink-0" />
              <span>
                {language === 'kh'
                  ? '🤖 ជំនួយការ AI Gemini កំពុងឆ្លើយតបស្វ័យប្រវត្តិ (Auto-Chat)...'
                  : '🤖 Gemini AI is auto-replying...'}
              </span>
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* QUICK PRODUCT PICKER POPUP */}
      {showProductPicker && (
        <div className="absolute bottom-24 left-4 right-4 md:left-6 md:right-6 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 z-30 max-h-72 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-blue-600" />
              <span>{language === 'kh' ? 'ជ្រើសរើសផលិតផលផ្ញើទៅអតិថិជន' : 'Select Product to Send'}</span>
            </span>
            <button
              onClick={() => setShowProductPicker(false)}
              className="text-slate-400 hover:text-slate-600 text-xs p-1"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto space-y-1.5 flex-1 pr-1">
            {products.map((p) => (
              <div
                key={p.id}
                className="w-full p-2 flex items-center justify-between gap-2 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100 hover:border-slate-200 text-left"
              >
                <div
                  onClick={() => handleSendProduct(p)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                >
                  <img
                    src={p.imageUrl}
                    alt={p.nameKh}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-lg object-cover border border-slate-100 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{p.nameKh}</p>
                    <p className="text-[10px] text-slate-500">
                      ${p.price.toFixed(2)} • ស្តុកនៅសល់ {p.stock}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSendProduct(p)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg cursor-pointer transition-colors"
                    title="ផ្ញើរូបទំនិញចូលឆាត"
                  >
                    ផ្ញើរូប ↗
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCreateOrderFromProduct(p)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    title="ចេញវិក្កយបត្រ និងកត់ចូលក្នុងបញ្ជីការបញ្ជាទិញ (Orders) ភ្លាមៗ"
                  >
                    <ShoppingBag className="w-3 h-3" />
                    <span>+ កម្ម៉ង់ភ្លាម</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUICK REPLY SHORTCUTS MENU */}
      {showQuickReplyMenu && (
        <div className="absolute bottom-24 left-4 right-4 md:left-6 md:right-6 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 z-30 max-h-72 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>{language === 'kh' ? 'គំរូសាររហ័ស (Quick Replies)' : 'Quick Reply Templates'}</span>
            </span>
            <button
              onClick={() => setShowQuickReplyMenu(false)}
              className="text-slate-400 hover:text-slate-600 text-xs p-1"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto space-y-1.5 flex-1 pr-1">
            {quickReplies.map((qr) => (
              <button
                key={qr.id}
                type="button"
                onClick={() => handleSelectQuickReply(qr)}
                className="w-full p-2.5 text-left rounded-xl hover:bg-amber-50/60 border border-transparent hover:border-amber-200 transition-colors flex items-start justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded group-hover:bg-amber-100 group-hover:text-amber-800 font-bold">
                      {qr.shortcut}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 truncate">{qr.titleKh || qr.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-1">{qr.content}</p>
                </div>
                <span className="text-[10px] text-amber-700 font-semibold px-2 py-1 rounded bg-amber-100/60 shrink-0">
                  ផ្ញើ ↗
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 1-TAP KHQR GENERATOR MODAL */}
      {showKhqrModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-4 border border-slate-100">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">បង្កើតវិក្កយបត្រ KHQR ទូទាត់</h3>
                  <p className="text-[11px] text-slate-500">ស្កេនទូទាត់ភ្លាមៗលើ Messenger គ្រប់ធនាគារ</p>
                </div>
              </div>
              <button
                onClick={() => setShowKhqrModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hidden file input for uploading new KHQR image */}
            <input
              type="file"
              ref={khqrFileInputRef}
              onChange={handleKhqrImageUpload}
              accept="image/*"
              className="hidden"
            />

            {/* Success banner after uploading new KHQR */}
            {khqrUploadSuccess && (
              <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in duration-200">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">បានរក្សាទុករូបភាព KHQR ថ្មីដោយជោគជ័យ!</span>
              </div>
            )}

            {/* KHQR Account & QR Code Preview with Instant Upload/Replace */}
            <div className="p-3 mb-3 bg-red-50/80 border border-red-200/80 rounded-xl space-y-2.5">
              <div className="flex items-center gap-3">
                <div
                  onClick={() => khqrFileInputRef.current?.click()}
                  title="ចុចដើម្បីប្តូររូបភាព KHQR ថ្មី"
                  className="w-16 h-16 bg-white p-1 rounded-xl border-2 border-red-300 shrink-0 overflow-hidden shadow-2xs relative group cursor-pointer hover:border-red-500 transition-colors"
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
                    <Upload className="w-4 h-4" />
                  </div>
                </div>

                <div className="text-xs min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-800 truncate">{khqrConfig.merchantName || 'Sok Chea CHHAI'}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setEditMerchantName(khqrConfig.merchantName);
                        setEditAccountNumber(khqrConfig.accountNumber);
                        setIsEditingKhqrDetails(!isEditingKhqrDetails);
                      }}
                      className="text-[10px] text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                    >
                      {isEditingKhqrDetails ? 'បិទ' : 'កែប្រែ'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 font-mono mt-0.5">ABA: {khqrConfig.accountNumber || '005 452 334'}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => khqrFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>ប្តូររូប KHQR ថ្មី</span>
                    </button>
                    {khqrConfig.qrImage !== DEFAULT_KHQR_IMAGE && (
                      <button
                        type="button"
                        onClick={resetKhqr}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-[10px] rounded-lg transition-colors cursor-pointer"
                        title="ត្រឡប់ទៅរូបដើម"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>ដើម</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Inline Form to Edit Name and Account Number */}
              {isEditingKhqrDetails && (
                <div className="pt-2 border-t border-red-200/60 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-0.5">ឈ្មោះគណនី</label>
                    <input
                      type="text"
                      value={editMerchantName}
                      onChange={(e) => setEditMerchantName(e.target.value)}
                      placeholder="Sok Chea CHHAI"
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-0.5">លេខកុង ABA</label>
                    <input
                      type="text"
                      value={editAccountNumber}
                      onChange={(e) => setEditAccountNumber(e.target.value)}
                      placeholder="005 452 334"
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-red-500 font-mono"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingKhqrDetails(false)}
                      className="px-2 py-0.5 text-[10px] text-slate-500 hover:text-slate-700"
                    >
                      បោះបង់
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveKhqrDetails}
                      className="px-2.5 py-0.5 text-[10px] font-bold text-white bg-slate-900 hover:bg-black rounded-md flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-2.5 h-2.5" />
                      <span>រក្សាទុក</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Amount Presets */}
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ជ្រើសរើសចំនួនទឹកប្រាក់ ($ USD)
            </label>
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {['5.00', '10.00', '15.00', '24.00', '38.00', '50.00', '65.00', '100.00'].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setKhqrAmount(amt)}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all ${
                    khqrAmount === amt
                      ? 'bg-red-600 text-white border-red-600 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>

            {/* Custom Amount Input */}
            <div className="mb-4">
              <label className="block text-[11px] text-slate-500 mb-1">ឬបញ្ចូលចំនួនទឹកប្រាក់ជាក់លាក់ ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={khqrAmount}
                  onChange={(e) => setKhqrAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                ស្មើនឹងប្រហែល {(Number(khqrAmount || 0) * 4100).toLocaleString()} រៀល (KHR)
              </p>
            </div>

            {/* Auto-record KHQR Bill into Orders List checkbox */}
            <label className="flex items-center gap-2 p-2.5 mb-3 bg-emerald-50 border border-emerald-200 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={recordKhqrAsOrder}
                onChange={(e) => setRecordKhqrAsOrder(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-[11px] font-semibold text-emerald-900">
                កត់ចូលក្នុងបញ្ជី «ការបញ្ជាទិញ (Orders)» ស្វ័យប្រវត្តិ (ទាំងទូរស័ព្ទ & កុំព្យូទ័រ)
              </span>
            </label>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowKhqrModal(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={() => handleSendKhqrCard(Number(khqrAmount) || 15)}
                className="flex-1 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>ផ្ញើ KHQR ឥឡូវនេះ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMART DETECTED CUSTOMER LEAD BANNER (Auto-detects Phone & Address in Chat) */}
      {detectedLeadInfo && (
        <div className="px-3 py-1.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-t border-emerald-200/80 flex items-center justify-between gap-2 text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="font-semibold text-emerald-950 truncate">
              {language === 'kh' ? 'រកឃើញព័ត៌មានអតិថិជន:' : 'Detected Customer Info:'}
            </span>
            {detectedLeadInfo.phone && (
              <span className="font-mono font-bold text-emerald-800 bg-white border border-emerald-200 px-1.5 py-0.5 rounded text-[11px] shrink-0 shadow-2xs">
                📞 {detectedLeadInfo.phone}
              </span>
            )}
            {detectedLeadInfo.address && (
              <span className="text-[11px] text-emerald-800 bg-white/70 px-1.5 py-0.5 rounded border border-emerald-100 truncate max-w-[150px] hidden sm:inline">
                📍 {detectedLeadInfo.address}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onOpenCreateOrder()}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="បង្កើតការបញ្ជាទិញដោយស្វ័យប្រវត្ត"
            >
              <ShoppingBag className="w-3 h-3" />
              <span>{language === 'kh' ? 'បង្កើត Order ភ្លាម' : '1-Click Order'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowKhqrModal(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="ផ្ញើ QR សម្រាប់បង់លុយ"
            >
              <QrCode className="w-3 h-3 text-red-600" />
              <span>KHQR</span>
            </button>
          </div>
        </div>
      )}

      {/* DYNAMIC SMART ACTION CHIPS (1-TAP DIRECT SEND - NO TYPING NEEDED) */}
      <div className="px-3 pt-2 pb-1 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-600" />
          <span>ឆ្លើយតបរហ័ស:</span>
        </span>
        {smartChips.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSendMessage(chip.text)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-lg whitespace-nowrap transition-all shadow-2xs group shrink-0 cursor-pointer"
            title={`ចុចផ្ញើ: "${chip.text}"`}
          >
            <span>{chip.label}</span>
            <span className="text-[10px] text-indigo-500 opacity-60 group-hover:opacity-100 font-bold">↗</span>
          </button>
        ))}
      </div>

      {/* QUICK ACTION PILLS (ALWAYS VISIBLE ABOVE CHAT INPUT) */}
      <div className="px-3 py-1.5 bg-slate-50/80 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
        <button
          type="button"
          onClick={() => onSendMessage('ចាស៎បង ម៉ូដនេះមានទំហំពេញ (S, M, L, XL) ក្នុងស្តុកបងចា៎!')}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md whitespace-nowrap transition-colors shrink-0 shadow-2xs cursor-pointer"
        >
          <Zap className="w-3 h-3 text-amber-500" />
          <span>មានក្នុងស្តុក</span>
        </button>
        <button
          type="button"
          onClick={() => onSendMessage(promoPillMessage)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md whitespace-nowrap transition-colors shrink-0 shadow-2xs cursor-pointer group"
          title={`ចុចផ្ញើ៖ "${promoPillMessage}"`}
        >
          <DollarSign className="w-3 h-3 text-emerald-600" />
          <span>{promoPillLabel}</span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setDraftPromoLabel(promoPillLabel);
              setDraftPromoMessage(promoPillMessage);
              setIsEditingPromoPill((prev) => !prev);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                e.preventDefault();
                setDraftPromoLabel(promoPillLabel);
                setDraftPromoMessage(promoPillMessage);
                setIsEditingPromoPill((prev) => !prev);
              }
            }}
            className="ml-0.5 p-0.5 rounded hover:bg-emerald-100 text-slate-400 hover:text-emerald-700 transition-colors"
            title="កែប្រែអក្សរ និងសារប្រូម៉ូសិន"
          >
            <Edit3 className="w-2.5 h-2.5" />
          </span>
        </button>
        <button
          type="button"
          onClick={() => setShowKhqrModal(true)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-md whitespace-nowrap transition-colors shrink-0 shadow-2xs cursor-pointer"
        >
          <QrCode className="w-3 h-3 text-red-600" />
          <span>KHQR គណនី</span>
        </button>
        <button
          type="button"
          onClick={() => onSendMessage('សេវាដឹកភ្នំពេញ $1.50 (១ថ្ងៃដល់) ខេត្ត $2.00 (១-២ ថ្ងៃតាម J&T / វីរៈប៊ុនថាំ) បងចា៎!')}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md whitespace-nowrap transition-colors shrink-0 shadow-2xs cursor-pointer"
        >
          <Truck className="w-3 h-3 text-blue-600" />
          <span>សេវាដឹក</span>
        </button>
        <button
          type="button"
          onClick={() => onSendMessage('សូមបងជួយផ្ញើ [លេខទូរស័ព្ទ] និង [ទីតាំងទទួល] មកប្អូនរៀបចំកញ្ចប់អីវ៉ាន់ជូនបងណា៎បងចា៎!')}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md whitespace-nowrap transition-colors shrink-0 shadow-2xs cursor-pointer"
        >
          <MapPin className="w-3 h-3 text-rose-500" />
          <span>សុំទីតាំងទទួល</span>
        </button>
        <button
          type="button"
          onClick={() => chatImageInputRef.current?.click()}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-md whitespace-nowrap transition-colors shrink-0 shadow-2xs cursor-pointer"
        >
          <ImageIcon className="w-3 h-3 text-blue-600" />
          <span>បញ្ចូលរូបភាព</span>
        </button>
        <button
          type="button"
          onClick={() => setShowProductPicker(true)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md whitespace-nowrap transition-colors shrink-0 shadow-2xs cursor-pointer"
        >
          <Package className="w-3 h-3 text-indigo-600" />
          <span>ផ្ញើរូបទំនិញ</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenCreateOrder()}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white hover:bg-slate-100 text-emerald-700 border border-emerald-200 rounded-md whitespace-nowrap transition-colors shrink-0 shadow-2xs cursor-pointer"
        >
          <ShoppingBag className="w-3 h-3 text-emerald-600" />
          <span>បើកបុងអីវ៉ាន់</span>
        </button>
        <button
          type="button"
          onClick={() => onSendMessage('អរគុណច្រើនបងសម្រាប់ការគាំទ្រហាងយើងខ្ញុំ! ប្រសិនបើមានបញ្ហាអីវ៉ាន់ បងអាចទាក់ទងមកប្អូនបានគ្រប់ពេលចា៎ 💕')}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md whitespace-nowrap transition-colors shrink-0 shadow-2xs cursor-pointer"
        >
          <Heart className="w-3 h-3 text-pink-500" />
          <span>ថ្លែងអំណរគុណ</span>
        </button>
      </div>

      {/* Inline Editor Popover for Promotion Quick Pill */}
      {isEditingPromoPill && (
        <div className="px-3 py-2 bg-emerald-50/90 border-t border-emerald-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 shrink-0">
            <label className="text-[11px] font-semibold text-emerald-900 whitespace-nowrap">
              ឈ្មោះប៊ូតុង៖
            </label>
            <input
              type="text"
              value={draftPromoLabel}
              onChange={(e) => setDraftPromoLabel(e.target.value)}
              placeholder="ប្រូម៉ូសិន"
              className="w-28 px-2 py-1 text-xs bg-white border border-emerald-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <label className="text-[11px] font-semibold text-emerald-900 whitespace-nowrap">
              សារផ្ញើ៖
            </label>
            <input
              type="text"
              value={draftPromoMessage}
              onChange={(e) => setDraftPromoMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSavePromoPill();
                } else if (e.key === 'Escape') {
                  setIsEditingPromoPill(false);
                }
              }}
              placeholder="បញ្ចូលសារប្រូម៉ូសិន..."
              className="flex-1 px-2 py-1 text-xs bg-white border border-emerald-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <div className="flex items-center justify-end gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleSavePromoPill}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md flex items-center gap-1 cursor-pointer"
            >
              <Save className="w-3 h-3" />
              <span>រក្សាទុក</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditingPromoPill(false)}
              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-md cursor-pointer"
            >
              បោះបង់
            </button>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {previewImageModalUrl && (
        <div
          onClick={() => setPreviewImageModalUrl(null)}
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
        >
          <div className="relative max-w-2xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImageModalUrl(null)}
              className="self-end mb-2 px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>បិទ</span>
            </button>
            <img
              src={previewImageModalUrl}
              alt="Full preview"
              className="max-h-[80vh] w-auto rounded-2xl shadow-2xl border border-white/20 object-contain bg-white"
            />
          </div>
        </div>
      )}

      {/* Hidden File Inputs for Direct Messenger Photo & Voice Audio Upload */}
      <input
        type="file"
        ref={chatImageInputRef}
        onChange={handleChatImageUpload}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={chatAudioInputRef}
        onChange={handleChatAudioFileUpload}
        accept="audio/*"
        className="hidden"
      />

      {/* Chat Input Toolbar & Form */}
      <div className="p-2 md:p-3 bg-white border-t border-slate-200 shrink-0">
        {/* Staged Image Preview Bar (when user pastes an image or stages before sending) */}
        {stagedImageAttachment && (
          <div className="mb-2.5 p-2.5 bg-blue-50/90 border border-blue-200 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={stagedImageAttachment.url}
                alt="Preview"
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_CHAT_IMAGE_SVG;
                }}
                className="w-12 h-12 rounded-lg object-cover border border-blue-300 bg-white shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-blue-950 truncate">
                  📷 រូបភាពត្រៀមផ្ញើ៖ {stagedImageAttachment.caption}
                </p>
                <p className="text-[11px] text-blue-700">
                  ចុចប៊ូតុង «ផ្ញើសារ» ដើម្បីផ្ញើរូបភាពនេះដោយផ្ទាល់ (គ្មានសញ្ញាសួរ ?)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleSend()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-2xs cursor-pointer"
              >
                ផ្ញើរូបឥឡូវនេះ
              </button>
              <button
                type="button"
                onClick={() => setStagedImageAttachment(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Staged Recorded Live Voice Clip Preview Bar */}
        {stagedVoiceClip && !isRecordingAudioClip && (
          <div className="mb-2.5 p-2.5 bg-gradient-to-r from-indigo-50 via-purple-50 to-emerald-50 border border-indigo-200 rounded-xl flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <button
                type="button"
                onClick={handleTogglePlayStagedVoiceClip}
                className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shrink-0 shadow-xs cursor-pointer"
                title="ចុចដើម្បីស្តាប់សម្លេង Live ដែលទើបថតមុនផ្ញើទៅអតិថិជន"
              >
                {isPlayingStagedVoice ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-950">
                    🎙️ សារសម្លេង Live បានថតរួច ({stagedVoiceClip.duration})
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">
                    សម្លេងពិត 100%
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 truncate">
                  {isPlayingStagedVoice
                    ? '🔊 កំពុងចាក់សម្លេង Live ដែលទើបថត...'
                    : 'ចុចប៊ូតុង Play ដើម្បីស្តាប់សាកល្បង ឬចុច «ផ្ញើសារសម្លេង» ទៅអតិថិជន'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (stagedVoiceAudioRef.current) {
                    try {
                      stagedVoiceAudioRef.current.pause();
                    } catch {}
                  }
                  setIsPlayingStagedVoice(false);
                  setStagedVoiceClip(null);
                  handleToggleRecordAudioClip();
                }}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                title="ថតសម្លេងម្ដងទៀត"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ថតម្ដងទៀត</span>
              </button>
              <button
                type="button"
                onClick={handleSendStagedVoiceClip}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>ផ្ញើសារសម្លេង</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (stagedVoiceAudioRef.current) {
                    try {
                      stagedVoiceAudioRef.current.pause();
                    } catch {}
                  }
                  setIsPlayingStagedVoice(false);
                  setStagedVoiceClip(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                title="លុបចោល"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Active Voice Sound Clip Recording Banner with Live Microphone Waveform */}
        {isRecordingAudioClip && (
          <div className="mb-2.5 p-2.5 bg-gradient-to-r from-rose-50 via-pink-50 to-indigo-50 border border-rose-300 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-rose-900">
                    🎙️ កំពុងថតសម្លេង Live ពីម៉ៃក្រូហ្វូន... 0:{String(recordingSeconds).padStart(2, '0')}
                  </span>
                  <div className="flex items-end gap-0.5 h-4 px-1.5 py-0.5 bg-white/80 rounded border border-rose-200">
                    {liveMicBars.map((barHeight, idx) => (
                      <span
                        key={idx}
                        style={{ height: `${Math.max(20, barHeight)}%` }}
                        className="w-1 bg-rose-500 rounded-full transition-all duration-75"
                      />
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-700 truncate mt-0.5">
                  {voiceTranscript
                    ? `ស្គាល់សម្លេងកំពុងនិយាយ៖ "${voiceTranscript}"`
                    : 'សូមនិយាយសម្លេងចូលម៉ៃក្រូហ្វូន... សម្លេងពិត (Live Voice) នឹងត្រូវផ្ញើទៅអតិថិជនដោយផ្ទាល់'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCancelRecordAudioClip}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg cursor-pointer"
                title="បោះបង់ការថតសម្លេង"
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={handleStopAndStageVoiceClip}
                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                title="បញ្ឈប់ការថត ហើយស្តាប់សម្លេងសាកល្បងមុនផ្ញើ"
              >
                <Play className="w-3.5 h-3.5" />
                <span>ស្តាប់សាកមុនផ្ញើ</span>
              </button>
              <button
                type="button"
                onClick={handleToggleRecordAudioClip}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>បញ្ឈប់ & ផ្ញើ Voice</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2 overflow-x-auto scrollbar-none flex-nowrap md:flex-wrap">
          {/* Quick Reply Button */}
          <button
            type="button"
            onClick={() => {
              setShowQuickReplyMenu(!showQuickReplyMenu);
              setShowProductPicker(false);
            }}
            className={`flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 text-[11px] md:text-xs rounded-md transition-colors font-medium cursor-pointer shrink-0 whitespace-nowrap ${
              showQuickReplyMenu
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>{language === 'kh' ? 'សាររហ័ស ( / )' : 'Quick Reply'}</span>
          </button>

          {/* Direct Photo Upload Button */}
          <button
            type="button"
            onClick={() => chatImageInputRef.current?.click()}
            disabled={isUploadingImage}
            className="flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 text-[11px] md:text-xs rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors font-semibold cursor-pointer shrink-0 whitespace-nowrap"
            title="ផ្ញើរូបភាពចូលក្នុងឆាតដោយផ្ទាល់ (គ្មានសញ្ញាសួរ ?)"
          >
            <ImageIcon className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-600" />
            <span>
              {isUploadingImage
                ? 'កំពុងបញ្ចូលរូប...'
                : language === 'kh'
                ? 'ផ្ញើរូបភាព'
                : 'Send Photo'}
            </span>
          </button>

          {/* Record & Send Voice Sound Clip Button */}
          <button
            type="button"
            onClick={handleToggleRecordAudioClip}
            className={`flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 text-[11px] md:text-xs rounded-md border transition-colors font-semibold cursor-pointer shrink-0 whitespace-nowrap ${
              isRecordingAudioClip
                ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
            }`}
            title="ថតសម្លេងពិតពីម៉ៃក្រូហ្វូន ដើម្បីផ្ញើសារសម្លេង (Voice) ទៅវិញក្នុងប្រអប់សារ"
          >
            <Volume2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
            <span>
              {isRecordingAudioClip
                ? `ផ្ញើសម្លេង (0:${String(recordingSeconds).padStart(2, '0')})`
                : language === 'kh'
                ? '🎙️ ថត Voice ទៅវិញ'
                : 'Record Voice'}
            </span>
          </button>

          {/* Dedicated Instant Auto Voice-to-Text Button in Chat Toolbar */}
          <button
            type="button"
            onClick={handleAutoVoiceToTextClick}
            className={`flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 text-[11px] md:text-xs rounded-md border transition-colors font-bold cursor-pointer shrink-0 whitespace-nowrap ${
              isRecordingVoice
                ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200'
            }`}
            title="បកសម្លេងជាអក្សរភ្លាមៗ (Auto Voice-to-Text) សម្រាប់សារសម្លេងចុងក្រោយ ឬនិយាយបញ្ចូលអក្សរក្នុងប្រអប់សារ"
          >
            <Mic className="w-3 h-3 md:w-3.5 md:h-3.5 text-purple-600" />
            <span>
              {isRecordingVoice
                ? language === 'kh'
                  ? 'កំពុងស្ដាប់សម្លេង...'
                  : 'Listening...'
                : language === 'kh'
                ? '🎙️ បកសម្លេងជាអក្សរ (Auto Voice-to-Text)'
                : '🎙️ Auto Voice-to-Text'}
            </span>
          </button>

          {/* Convert Typed Text into Voice Sound Clip Button */}
          <button
            type="button"
            onClick={() => handleSendTextAsVoiceReply()}
            disabled={!inputText.trim() || isConvertingTextToVoice}
            className="flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 text-[11px] md:text-xs rounded-md bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-700 border border-emerald-200 transition-colors font-semibold cursor-pointer shrink-0 whitespace-nowrap"
            title="វាយអក្សរក្នុងប្រអប់សារ រួចចុចប៊ូតុងនេះដើម្បីផ្ញើចេញជាសារសម្លេង (Text-to-Voice)"
          >
            <Volume2 className={`w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-600 ${isConvertingTextToVoice ? 'animate-bounce' : ''}`} />
            <span>
              {isConvertingTextToVoice
                ? 'កំពុងបម្លែងសម្លេង...'
                : language === 'kh'
                ? '🔊 ផ្ញើអក្សរជាសម្លេង'
                : 'Text to Voice'}
            </span>
          </button>

          {/* Upload Audio File Button */}
          <button
            type="button"
            onClick={() => chatAudioInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-0.5 md:px-2 md:py-1 text-[11px] md:text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors font-medium cursor-pointer shrink-0 whitespace-nowrap"
            title="បញ្ចូលឯកសារសម្លេង (MP3 / WAV / Voice Clip)"
          >
            <Paperclip className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-600" />
            <span className="hidden md:inline">{language === 'kh' ? 'ឯកសារសម្លេង' : 'Audio File'}</span>
          </button>

          {/* Catalog Attach Button */}
          <button
            type="button"
            onClick={() => {
              setShowProductPicker(!showProductPicker);
              setShowQuickReplyMenu(false);
            }}
            className={`flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 text-[11px] md:text-xs rounded-md transition-colors font-medium cursor-pointer shrink-0 whitespace-nowrap ${
              showProductPicker
                ? 'bg-blue-100 text-blue-800'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Package className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-600" />
            <span>{language === 'kh' ? 'ទំនិញ' : 'Product'}</span>
          </button>

          {/* KHQR Bakong generator button */}
          <button
            type="button"
            onClick={() => setShowKhqrModal(true)}
            className="flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 text-[11px] md:text-xs rounded-md bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors font-medium cursor-pointer shrink-0 whitespace-nowrap"
          >
            <QrCode className="w-3 h-3 md:w-3.5 md:h-3.5 text-red-600" />
            <span>KHQR គណនី</span>
          </button>

          {/* AI Suggest Reply Button */}
          <button
            type="button"
            onClick={handleGenerateAIReply}
            disabled={isGeneratingAIReply}
            className="flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 text-[11px] md:text-xs rounded-md bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 border border-indigo-200 transition-colors font-medium ml-auto cursor-pointer shrink-0 whitespace-nowrap"
            title="ជំនួយការ AI Gemini 3.8 Flash ព្រាងសារ"
          >
            <Sparkles className={`w-3 h-3 md:w-3.5 md:h-3.5 text-indigo-600 ${isGeneratingAIReply ? 'animate-spin' : ''}`} />
            <span>
              {isGeneratingAIReply
                ? (language === 'kh' ? 'AI កំពុងព្រាង...' : 'AI Drafting...')
                : (language === 'kh' ? 'AI ជួយព្រាងសារ' : 'AI Suggest')}
            </span>
          </button>

          {/* AI Image Studio shortcut */}
          {onOpenImageStudio && (
            <button
              type="button"
              onClick={onOpenImageStudio}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 transition-colors font-medium cursor-pointer shrink-0 whitespace-nowrap"
              title="បង្កើតរូបភាពផលិតផលដោយ gemini-nano-banana-2.1"
            >
              <Wand2 className="w-3.5 h-3.5 text-pink-600" />
              <span>{language === 'kh' ? 'AI រូបភាព' : 'AI Image'}</span>
            </button>
          )}
        </div>

        {/* AI Suggested Response Banner */}
        {aiSuggestedText && (
          <div className="mb-2 p-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/80 rounded-xl flex items-start justify-between gap-3 text-xs animate-in fade-in duration-150">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-800 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>{language === 'kh' ? 'សារដែល Gemini បានព្រាងជូន (Gemini 3.8 Flash):' : 'Gemini Suggested Reply:'}</span>
              </div>
              <p className="text-slate-700 leading-relaxed italic">{aiSuggestedText}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 self-center">
              <button
                type="button"
                onClick={() => {
                  setInputText(aiSuggestedText);
                  setAiSuggestedText(null);
                }}
                className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-semibold transition-colors shadow-2xs cursor-pointer"
              >
                {language === 'kh' ? 'បញ្ចូល' : 'Insert'}
              </button>
              <button
                type="button"
                onClick={() => {
                  dispatchMessageFromChatWindow(aiSuggestedText);
                  setAiSuggestedText(null);
                }}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors shadow-2xs cursor-pointer"
              >
                {language === 'kh' ? 'ផ្ញើភ្លាម' : 'Send'}
              </button>
              <button
                type="button"
                onClick={() => setAiSuggestedText(null)}
                className="px-1.5 py-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Input Form with Voice Dictation, Voice Sound Recording, and Direct Image Paste */}
        <form onSubmit={handleSend} className="flex items-center gap-1 md:gap-1.5">
          {/* Speech-to-Text Dictation / Auto Voice-to-Text button */}
          <button
            type="button"
            onClick={handleAutoVoiceToTextClick}
            className={`p-1.5 md:p-2 rounded-lg border transition-all shrink-0 cursor-pointer ${
              isRecordingVoice
                ? 'bg-rose-500 text-white border-rose-600 animate-pulse ring-2 ring-rose-400/40'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
            }`}
            title={isRecordingVoice ? 'កំពុងស្តាប់... (ចុចដើម្បីបិទ)' : '🎙️ បកសម្លេងជាអក្សរ (Auto Voice-to-Text)'}
          >
            {isRecordingVoice ? <MicOff className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Mic className="w-3.5 h-3.5 md:w-4 md:h-4" />}
          </button>

          {/* Direct Voice Sound Clip Record Button in Input Bar */}
          <button
            type="button"
            onClick={handleToggleRecordAudioClip}
            className={`px-2 py-1.5 md:px-2.5 md:py-2 rounded-lg border transition-all shrink-0 flex items-center gap-1 text-[11px] md:text-xs font-bold cursor-pointer ${
              isRecordingAudioClip
                ? 'bg-rose-600 text-white border-rose-700 animate-pulse ring-2 ring-rose-400/40'
                : 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 shadow-2xs'
            }`}
            title={isRecordingAudioClip ? 'ចុចដើម្បីផ្ញើសារសម្លេង (Send Voice Sound)' : 'ថតផ្ញើសារសម្លេងទៅវិញក្នុងប្រអប់សារ (Record Voice Reply)'}
          >
            {isRecordingAudioClip ? <Square className="w-3 h-3 md:w-3.5 md:h-3.5" /> : <Volume2 className="w-3 h-3 md:w-3.5 md:h-3.5" />}
            <span className="hidden sm:inline">
              {isRecordingAudioClip ? `ផ្ញើ Voice (${recordingSeconds}s)` : 'Voice ទៅវិញ'}
            </span>
          </button>

          {/* Direct Image Upload Button in Input Bar */}
          <button
            type="button"
            onClick={() => chatImageInputRef.current?.click()}
            className="p-1.5 md:p-2 rounded-lg border bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 transition-all shrink-0 cursor-pointer"
            title="ជ្រើសរើសរូបភាពផ្ញើក្នុងឆាត (គ្មានសញ្ញាសួរ ?)"
          >
            <ImageIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onPaste={(e) => {
              const items = e.clipboardData?.items;
              if (!items) return;
              for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                  const file = items[i].getAsFile();
                  if (file) {
                    e.preventDefault();
                    processAndSendOrStageImage(file, 'pasted-image.jpg', false);
                    break;
                  }
                }
              }
            }}
            onChange={(e) => {
              setInputText(e.target.value);
              if (e.target.value === '/') {
                setShowQuickReplyMenu(true);
              }
            }}
            placeholder={
              isRecordingVoice
                ? 'កំពុងស្តាប់សម្លេងបម្លែងជាអក្សរ...'
                : isRecordingAudioClip
                ? 'កំពុងថតសារសម្លេង Voice Sound...'
                : chatSendMode === 'customer'
                ? (language === 'kh' ? `វាយសារ ឬចុច "Voice ទៅវិញ" ដើម្បីថតសម្លេងក្នុងនាមភ្ញៀវ...` : 'Type message or record voice as customer...')
                : (language === 'kh' ? 'សរសេរសារ, ឬចុច "Voice ទៅវិញ" ដើម្បីនិយាយសម្លេងឆ្លើយតប...' : 'Type a reply, paste image, or record voice...')
            }
            className={`flex-1 min-w-0 px-2.5 py-1.5 md:px-3.5 md:py-2 text-xs md:text-sm border rounded-lg focus:outline-none focus:ring-2 transition-all placeholder:text-slate-400 ${
              isRecordingVoice || isRecordingAudioClip
                ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-300/30 text-rose-900 font-medium'
                : chatSendMode === 'customer'
                ? 'bg-emerald-50/50 border-emerald-300 focus:ring-emerald-500/20 focus:border-emerald-600'
                : 'bg-slate-50 border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
            }`}
          />

          {inputText.trim() && (
            <button
              type="button"
              onClick={() => handleSendTextAsVoiceReply()}
              disabled={isConvertingTextToVoice}
              className="px-2 py-1.5 md:px-2.5 md:py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold text-[11px] md:text-xs rounded-lg transition-colors flex items-center gap-1 shadow-xs shrink-0 cursor-pointer"
              title="ផ្ញើអក្សរដែលបានវាយនេះចេញជាសារសម្លេង (Send Typed Text as Voice Sound)"
            >
              <Volume2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span className="hidden md:inline">ផ្ញើជា Voice</span>
            </button>
          )}

          <button
            type="submit"
            disabled={!inputText.trim() && !stagedImageAttachment}
            className={`px-3 py-1.5 md:px-4 md:py-2 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium text-xs md:text-sm rounded-lg transition-colors flex items-center gap-1 md:gap-1.5 shadow-xs shrink-0 cursor-pointer ${
              chatSendMode === 'customer'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">
              {chatSendMode === 'customer'
                ? (language === 'kh' ? 'ផ្ញើចូលផេក' : 'Send to Page')
                : (language === 'kh' ? 'ផ្ញើសារ' : 'Send')}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
