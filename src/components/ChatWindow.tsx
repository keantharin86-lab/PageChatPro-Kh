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
  RotateCcw
} from 'lucide-react';
import { ChatThread, ChatMessage, QuickReplyTemplate, ProductItem, Order, PageAccount } from '../types';
import { useKhqrConfig, DEFAULT_KHQR_IMAGE, FALLBACK_KHQR_IMAGE } from '../utils/khqrSettings';

interface ChatWindowProps {
  thread: ChatThread;
  quickReplies: QuickReplyTemplate[];
  products: ProductItem[];
  orders: Order[];
  onSendMessage: (text: string, attachments?: any[]) => void;
  onOpenCreateOrder: () => void;
  onViewOrderInvoice: (orderId: string) => void;
  onEditOrderInvoice?: (orderId: string) => void;
  onEditMessage?: (threadId: string, messageId: string, newText: string) => void;
  onSimulateCustomerReply: (threadId: string, replyText?: string) => void;
  language: 'kh' | 'en';
  onOpenAIChat?: () => void;
  onOpenVoiceLive?: () => void;
  onOpenImageStudio?: () => void;
  selectedPage?: PageAccount;
  onOpenLiveModal?: () => void;
  onBack?: () => void;
  isAutoPilot?: boolean;
  onToggleAutoPilot?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  thread,
  quickReplies,
  products,
  orders,
  onSendMessage,
  onOpenCreateOrder,
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
  isAutoPilot = false,
  onToggleAutoPilot,
}) => {
  const [inputText, setInputText] = useState('');
  const [showQuickReplyMenu, setShowQuickReplyMenu] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [isGeneratingAIReply, setIsGeneratingAIReply] = useState(false);
  const [aiSuggestedText, setAiSuggestedText] = useState<string | null>(null);
  const [showKhqrModal, setShowKhqrModal] = useState(false);
  const [khqrAmount, setKhqrAmount] = useState<string>('15.00');
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [saveSuccessMsgId, setSaveSuccessMsgId] = useState<string | null>(null);

  // Dynamic KHQR Configuration (reactive across all app views)
  const { config: khqrConfig, updateKhqr, resetKhqr } = useKhqrConfig();
  const [khqrUploadSuccess, setKhqrUploadSuccess] = useState(false);
  const [isEditingKhqrDetails, setIsEditingKhqrDetails] = useState(false);
  const [editMerchantName, setEditMerchantName] = useState(khqrConfig.merchantName);
  const [editAccountNumber, setEditAccountNumber] = useState(khqrConfig.accountNumber);
  const khqrFileInputRef = useRef<HTMLInputElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const [previewImageModalUrl, setPreviewImageModalUrl] = useState<string | null>(null);

  const handleChatImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) return;

      // Compress image via canvas so it saves reliably in both localStorage and server storage
      const img = new Image();
      img.onload = () => {
        try {
          const MAX_DIM = 1000;
          let width = img.width;
          let height = img.height;
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
            ctx.drawImage(img, 0, 0, width, height);
            const compressedUrl = canvas.toDataURL('image/jpeg', 0.82);
            const captionText = inputText.trim() || file.name.replace(/\.[^/.]+$/, '') || 'រូបភាពផលិតផល';
            onSendMessage(`📷 រូបភាព: ${captionText}`, [
              {
                type: 'image',
                data: {
                  url: compressedUrl,
                  caption: captionText,
                },
              },
            ]);
            if (inputText.trim()) setInputText('');
            return;
          }
        } catch (err) {
          console.warn('Image compression fallback:', err);
        }
        const captionText = inputText.trim() || file.name || 'រូបភាព';
        onSendMessage(`📷 រូបភាព: ${captionText}`, [
          {
            type: 'image',
            data: {
              url: rawDataUrl,
              caption: captionText,
            },
          },
        ]);
        if (inputText.trim()) setInputText('');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.messages]);

  // Find the latest message sent by the customer to generate contextual 1-click smart chips
  const lastCustomerMessage = [...thread.messages].reverse().find((m) => m.sender === 'customer');

  // Compute smart suggested reply chips based on the latest customer intent
  const smartChips = React.useMemo(() => {
    if (!lastCustomerMessage) {
      return [
        { label: 'សួស្តីបង!', text: 'ជម្រាបសួរបង! តើប្អូនអាចជួយអ្វីបានដែរចា៎?' },
        { label: 'តម្លៃពិសេស $15', text: 'ម៉ូដនេះតម្លៃពេញ $18.00 ឥឡូវប្រូម៉ូសិនសល់ត្រឹម $15.00 ប៉ុណ្ណោះបងចា៎!' },
        { label: 'ផ្ញើលេខកុង KHQR ABA', text: 'បងអាចស្កេនទូទាត់តាម ABA / KHQR គណនី: 005 452 334 (Sok Chea CHHAI) បានបងចា៎!' },
      ];
    }
    const t = lastCustomerMessage.text.toLowerCase();
    if (t.includes('ថ្លៃ') || t.includes('តម្លៃ') || t.includes('តំលៃ') || t.includes('how much') || t.includes('price')) {
      return [
        { label: 'តម្លៃពិសេស $34 (ចុះពី $38)', text: 'ម៉ូដនេះតម្លៃពេញ $38.00 (ឥឡូវប្រូម៉ូសិនសល់ត្រឹម $34.00) បងស្រលាញ់ពណ៌ណាដែរចា៎?' },
        { label: 'មានគ្រប់ Size (S, M, L, XL)', text: 'ចាស៎បង ម៉ូដនេះមានទំហំ S, M, L, XL ពេញស្តុកបងចា៎!' },
        { label: 'សេវាដឹកភ្នំពេញ $1.50 / ខេត្ត $2.00', text: 'សេវាដឹកជញ្ជូនភ្នំពេញ $1.50 (១ថ្ងៃដល់) តាមខេត្ត $2.00 (១-២ថ្ងៃដល់) ណា៎បងចា៎!' },
      ];
    }
    if (t.includes('មាន') || t.includes('ស្តុក') || t.includes('size') || t.includes('ទំហំ') || t.includes('ពណ៌')) {
      return [
        { label: 'មានក្នុងស្តុកស្រាប់', text: 'ចាស៎បង មានក្នុងស្តុកស្រាប់គ្រប់ទំហំ (S, M, L, XL) សាច់ក្រណាត់សូត្រទន់រលោងត្រជាក់បងចា៎!' },
        { label: 'សុំលេខទូរស័ព្ទ និងទីតាំង', text: 'សូមបងជួយផ្ញើ [លេខទូរស័ព្ទ] និង [ទីតាំងទទួល] មកប្អូនរៀបចំកញ្ចប់អីវ៉ាន់ជូនបងភ្លាមៗណា៎!' },
        { label: 'បញ្ចុះតម្លៃពិសេសជូន', text: 'បងយកថ្ងៃនេះ ខាងប្អូនបញ្ចុះតម្លៃពិសេសជូនបង និងថែមក្រមាសូត្រមួយជូនភ្លាមៗចា៎!' },
      ];
    }
    if (t.includes('aba') || t.includes('khqr') || t.includes('កុង') || t.includes('លុយ') || t.includes('គណនី') || t.includes('pay')) {
      return [
        { label: 'ផ្ញើ ABA / KHQR', text: 'បងអាចស្កេនទូទាត់តាម ABA / KHQR គណនីលេខ: 005 452 334 (Sok Chea CHHAI) បានបងចា៎!' },
        { label: 'ទទួលអីវ៉ាន់ចាំបង់ (COD)', text: 'បងអាចជ្រើសរើសទូទាត់ប្រាក់ពេលអីវ៉ាន់ដឹកទៅដល់ដៃ (COD) ក៏បានបងចា៎!' },
        { label: 'វេលុយរួចសុំវិក្កយបត្រ', text: 'ពេលបងវេលុយរួច សូមបងជួយផ្ញើបង្កាន់ដៃមកខាងប្អូនផងណា៎បង!' },
      ];
    }
    if (t.includes('ដឹក') || t.includes('ផ្ញើ') || t.includes('សេវា') || t.includes('grab') || t.includes('ខេត្ត')) {
      return [
        { label: 'សេវាដឹក ១-២ថ្ងៃដល់', text: 'សេវាដឹកភ្នំពេញ $1.50 (១ថ្ងៃដល់) តាមខេត្ត $2.00 (១-២ ថ្ងៃតាម J&T / វីរៈប៊ុនថាំ) បងចា៎!' },
        { label: 'ផ្ញើទីតាំង និងលេខទូរស័ព្ទ', text: 'បងជួយផ្ញើទីតាំង និងលេខទូរស័ព្ទមកប្អូនរៀបចំផ្ញើជូនបងឥឡូវនេះចា៎!' },
        { label: 'ដឹក Grab ភ្លាមៗបាន', text: 'បងត្រូវការបន្ទាន់ ខាងប្អូនអាចហៅ Grab ដឹកជូនភ្លាមៗបានបងចា៎!' },
      ];
    }
    return [
      { label: 'សួស្តីបង!', text: 'ជម្រាបសួរបង! តើប្អូនអាចជួយអ្វីបានដែរចា៎?' },
      { label: 'តម្លៃពិសេស $34', text: 'ម៉ូដនេះតម្លៃពេញ $38.00 បញ្ចុះសល់ $34.00 ណា៎បងចា៎?' },
      { label: 'ផ្ញើលេខកុង KHQR ABA', text: 'បងអាចស្កេនទូទាត់តាម ABA / KHQR គណនីលេខ: 005 452 334 (Sok Chea CHHAI) បានបងចា៎!' },
      { label: 'សុំលេខទូរស័ព្ទ', text: 'សូមបងជួយផ្ញើលេខទូរស័ព្ទ និងទីតាំងទទួលមកខាងប្អូនផងណា៎បង!' },
    ];
  }, [lastCustomerMessage]);

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
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
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

  // Generate & Send Real Bakong KHQR Card
  const handleSendKhqrCard = (amount: number) => {
    const khqrData = {
      merchantName: khqrConfig.merchantName || 'Sok Chea CHHAI',
      accountNumber: khqrConfig.accountNumber || '005 452 334',
      bankName: khqrConfig.bankName || 'ABA Bank (KHQR / Bakong)',
      amount: amount,
      amountKhr: Math.round(amount * 4100),
      currency: 'USD',
      qrImage: khqrConfig.qrImage || DEFAULT_KHQR_IMAGE,
      billNumber: `BILL-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toLocaleTimeString('km-KH'),
    };

    onSendMessage(`វិក្កយបត្រស្កេនទូទាត់ KHQR ចំនួន $${amount.toFixed(2)} (${khqrData.amountKhr.toLocaleString()} រៀល) សូមស្កេនទូទាត់តាមកូដខាងក្រោម:`, [
      {
        type: 'khqr_card',
        data: khqrData,
      },
    ]);
    setShowKhqrModal(false);
  };

  // Voice Speech-to-Text handler
  const handleToggleVoiceRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const simulatedVoiceText = 'ចាស៎បង អរគុណច្រើនដែលបានទាក់ទងមកហាងយើងខ្ញុំ!';
      setInputText((prev) => (prev ? `${prev} ${simulatedVoiceText}` : simulatedVoiceText));
      return;
    }

    if (isRecordingVoice) {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      setIsRecordingVoice(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language === 'kh' ? 'km-KH' : 'en-US';

      recognition.onstart = () => {
        setIsRecordingVoice(true);
        setVoiceTranscript('');
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setVoiceTranscript(transcript);
        setInputText(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsRecordingVoice(false);
      };

      recognition.onend = () => {
        setIsRecordingVoice(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition setup error:', err);
      setIsRecordingVoice(false);
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
          systemInstruction: 'You are a warm, helpful Cambodian social shop administrator (MALIS BOUTIQUE). Write a polite, concise reply in natural Khmer addressing the customer\'s latest message directly. Keep it under 2 sentences with an encouraging polite tone ("បាទ/ចា៎", "ណា៎បង").',
          messages: recentMessages.length > 0 ? recentMessages : [{ role: 'user', text: 'Hello' }],
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
    <div className="flex-1 flex flex-col h-full bg-slate-50 relative">
      {/* Top Chat Header */}
      <div className="h-16 px-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 -ml-1 rounded-lg hover:bg-slate-100 text-slate-600 md:hidden transition-colors"
              aria-label="Back to conversations"
              title="ត្រឡប់ទៅប្រអប់សារ"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
          )}

          <div className="relative shrink-0">
            <img
              src={thread.customer.avatarUrl}
              alt={thread.customer.name}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full object-cover border border-slate-200"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute bottom-0 right-0 border-2 border-white"></span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 truncate">
                {thread.customer.name}
              </h2>
              {thread.customer.isRealFacebookUser || (thread.customer.psid && !thread.customer.id.startsWith('cust_')) ? (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                  <span>Meta Messenger Live</span>
                </span>
              ) : (
                <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full shrink-0" title="គណនីគំរូសាកល្បង">
                  Demo
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="capitalize">{thread.customer.platform}</span>
              <span aria-hidden="true">•</span>
              <span>{thread.customer.province}</span>
              {thread.customer.psid && (
                <>
                  <span aria-hidden="true">•</span>
                  <span className="font-mono text-[10px] text-blue-600">PSID: {thread.customer.psid.slice(0, 10)}...</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2">
          {/* AI Auto-Pilot 24/7 Toggle */}
          {onToggleAutoPilot && (
            <button
              onClick={onToggleAutoPilot}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                isAutoPilot
                  ? 'bg-purple-50 text-purple-800 border-purple-300 shadow-xs ring-2 ring-purple-400/20'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title={isAutoPilot ? 'AI Auto-Pilot កំពុងបើក (ឆ្លើយតបអូតូ)' : 'ចុចបើក AI Auto-Pilot'}
            >
              <Bot className={`w-3.5 h-3.5 ${isAutoPilot ? 'text-purple-600 animate-pulse' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">AI Auto-Pilot</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isAutoPilot ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {isAutoPilot ? 'បើក' : 'បិទ'}
              </span>
            </button>
          )}

          {/* Facebook Live Online Status Badge & Modal Trigger */}
          {selectedPage && onOpenLiveModal && (
            <button
              onClick={onOpenLiveModal}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                (selectedPage.isLiveOnline || selectedPage.accessToken)
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-2xs'
              }`}
              title={(selectedPage.isLiveOnline || selectedPage.accessToken) ? 'បានតភ្ជាប់ Live Online ជាមួយ Meta Messenger' : 'ចុចបើក Live Online ជាមួយ Facebook'}
            >
              <span className={`w-2 h-2 rounded-full ${(selectedPage.isLiveOnline || selectedPage.accessToken) ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
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

          {/* Fast Create Order Button */}
          <button
            onClick={onOpenCreateOrder}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-2xs"
            title="បង្កើតការបញ្ជាទិញរហ័ស"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{language === 'kh' ? 'កុម្ម៉ង់' : 'Order'}</span>
          </button>
        </div>
      </div>

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
            <span className="text-[10px] text-purple-200 hidden lg:inline">សាកល្បង៖</span>
            <button
              type="button"
              onClick={() => onSimulateCustomerReply(thread.id, 'រ៉ូបនេះតម្លៃប៉ុន្មានបង?')}
              className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] font-bold transition-colors cursor-pointer"
              title="សាកល្បងសួរសារជាភាសាខ្មែរ"
            >
              🇰🇭 តម្លៃប៉ុន្មាន?
            </button>
            <button
              type="button"
              onClick={() => onSimulateCustomerReply(thread.id, 'Hello! Do you deliver to Phnom Penh and how much is shipping?')}
              className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] font-bold transition-colors cursor-pointer"
              title="Test incoming message in English"
            >
              🇺🇸 English
            </button>
            <button
              type="button"
              onClick={() => onSimulateCustomerReply(thread.id, 'bong mean ivan nis ot? price man hz som acc aba phong!')}
              className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] font-bold transition-colors cursor-pointer"
              title="សាកល្បងសួរជាខ្មែរឡាតាំង"
            >
              💬 ខ្មែរឡាតាំង
            </button>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {thread.messages.map((msg) => {
          const isMe = msg.sender === 'admin' || msg.sender === 'bot';
          const isBot = msg.sender === 'bot';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                {isBot && (
                  <span className="inline-flex items-center gap-0.5 text-purple-700 font-semibold bg-purple-50 px-1.5 py-0.5 rounded text-[10px]">
                    <Bot className="w-3 h-3 text-purple-600" />
                    <span>AI Auto-Pilot</span>
                  </span>
                )}
                <span className="font-medium text-slate-600">{msg.senderName}</span>
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs relative group ${
                  isMe
                    ? isBot
                      ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white rounded-br-xs'
                      : 'bg-blue-600 text-white rounded-br-xs'
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                }`}
              >
                {editingMessageId === msg.id ? (
                  <div className="space-y-2 py-0.5 min-w-[240px] sm:min-w-[320px]">
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
                      <p className="whitespace-pre-wrap flex-1 leading-relaxed">{msg.text}</p>
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

                {/* Render Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {msg.attachments.map((att, idx) => {
                      if (att.type === 'product') {
                        const prod = att.data as ProductItem;
                        return (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl bg-white text-slate-900 border border-slate-200 flex items-center gap-3"
                          >
                            <img
                              src={prod.imageUrl}
                              alt={prod.nameKh}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 rounded-lg object-cover border border-slate-100"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold truncate">{prod.nameKh}</p>
                              <p className="text-[11px] text-blue-600 font-bold tabular-nums">
                                ${prod.price.toFixed(2)} ({prod.priceKhr.toLocaleString()} រៀល)
                              </p>
                              <p className="text-[10px] text-slate-500">ស្តុកនៅសល់: {prod.stock}</p>
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
                        const imgUrl = imgData.url || (att as any).url || '';
                        const imgCaption = imgData.caption || '';
                        if (!imgUrl) return null;
                        return (
                          <div
                            key={idx}
                            className="rounded-xl overflow-hidden bg-white text-slate-900 border border-slate-200 shadow-sm max-w-xs"
                          >
                            <div
                              onClick={() => setPreviewImageModalUrl(imgUrl)}
                              className="relative group/img cursor-pointer bg-slate-100"
                            >
                              <img
                                src={imgUrl}
                                alt={imgCaption || 'Chat Image'}
                                referrerPolicy="no-referrer"
                                className="w-full max-h-64 object-cover block hover:opacity-95 transition-opacity"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/25 transition-colors flex items-center justify-center">
                                <span className="opacity-0 group-hover/img:opacity-100 bg-black/70 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full transition-opacity">
                                  🔍 ចុចមើលរូបធំ
                                </span>
                              </div>
                            </div>
                            {imgCaption && (
                              <div className="px-3 py-1.5 bg-white text-xs text-slate-700 font-medium flex items-center justify-between gap-2 border-t border-slate-100">
                                <span className="truncate">{imgCaption}</span>
                                <a
                                  href={imgUrl}
                                  download={`image-${Date.now()}.jpg`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] text-blue-600 hover:underline shrink-0 font-semibold"
                                >
                                  ទាញយក
                                </a>
                              </div>
                            )}
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
                            className="p-3.5 rounded-xl bg-slate-900 text-white border border-slate-700 flex flex-col gap-2.5 shadow-md min-w-[240px]"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                                  📄
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-bold text-white">
                                      វិក្កយបត្រ #{displayOrd.orderNumber || 'ORD'}
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
                )}
              </div>

              {/* Delivery status indicator for admin messages */}
              {isMe && !isBot && (
                <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px]">
                  {msg.deliveryStatus === 'sent_meta' && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-medium" title="ផ្ញើទៅកាន់ Meta Business Messenger (Facebook) បានជោគជ័យ">
                      <CheckCheck className="w-3 h-3 text-emerald-500" />
                      <span>Meta Messenger</span>
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
                  {(!msg.deliveryStatus || msg.deliveryStatus === 'sent_local') && (
                    <span className="inline-flex items-center gap-1 text-slate-400" title="សារក្នុងប្រព័ន្ធ (Demo contact)">
                      <Check className="w-2.5 h-2.5" />
                      <span>Demo local</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
              <button
                key={p.id}
                type="button"
                onClick={() => handleSendProduct(p)}
                className="w-full p-2 flex items-center justify-between rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200 text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={p.imageUrl}
                    alt={p.nameKh}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-lg object-cover border border-slate-100 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{p.nameKh}</p>
                    <p className="text-[10px] text-slate-500">ស្តុកនៅសល់ {p.stock} | {p.category}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-blue-600 tabular-nums">${p.price.toFixed(2)}</p>
                  <span className="text-[10px] text-emerald-600 font-medium">ចុចផ្ញើ ↗</span>
                </div>
              </button>
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
              onClick={onOpenCreateOrder}
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
          onClick={() => onSendMessage('ម៉ូដនេះតម្លៃពេញ $38.00 បញ្ចុះតម្លៃសល់ត្រឹម $34.00 ណា៎បងចា៎!')}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md whitespace-nowrap transition-colors shrink-0 shadow-2xs cursor-pointer"
        >
          <DollarSign className="w-3 h-3 text-emerald-600" />
          <span>ប្រូម៉ូសិន $34</span>
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
          onClick={onOpenCreateOrder}
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

      {/* Hidden File Input for Direct Messenger Photo Upload */}
      <input
        type="file"
        ref={chatImageInputRef}
        onChange={handleChatImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Chat Input Toolbar & Form */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {/* Quick Reply Button */}
          <button
            type="button"
            onClick={() => {
              setShowQuickReplyMenu(!showQuickReplyMenu);
              setShowProductPicker(false);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors font-medium cursor-pointer ${
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
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors font-medium cursor-pointer"
            title="បញ្ចូល និងផ្ញើរូបភាពក្នុងឆាត Messenger"
          >
            <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>{language === 'kh' ? 'រូបភាព' : 'Photo'}</span>
          </button>

          {/* Catalog Attach Button */}
          <button
            type="button"
            onClick={() => {
              setShowProductPicker(!showProductPicker);
              setShowQuickReplyMenu(false);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors font-medium cursor-pointer ${
              showProductPicker
                ? 'bg-blue-100 text-blue-800'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-blue-600" />
            <span>{language === 'kh' ? 'ទំនិញ' : 'Product'}</span>
          </button>

          {/* KHQR Bakong generator button */}
          <button
            type="button"
            onClick={() => setShowKhqrModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors font-medium cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5 text-red-600" />
            <span>KHQR គណនី</span>
          </button>

          {/* AI Suggest Reply Button */}
          <button
            type="button"
            onClick={handleGenerateAIReply}
            disabled={isGeneratingAIReply}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 border border-indigo-200 transition-colors font-medium ml-auto cursor-pointer"
            title="ជំនួយការ AI Gemini 3.8 Flash ព្រាងសារ"
          >
            <Sparkles className={`w-3.5 h-3.5 text-indigo-600 ${isGeneratingAIReply ? 'animate-spin' : ''}`} />
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
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 transition-colors font-medium cursor-pointer"
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
                  onSendMessage(aiSuggestedText);
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

        {/* Input Form with Voice Dictation */}
        <form onSubmit={handleSend} className="flex items-center gap-2">
          {/* Voice to text button */}
          <button
            type="button"
            onClick={handleToggleVoiceRecording}
            className={`p-2 rounded-lg border transition-all shrink-0 cursor-pointer ${
              isRecordingVoice
                ? 'bg-rose-500 text-white border-rose-600 animate-pulse ring-2 ring-rose-400/40'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
            }`}
            title={isRecordingVoice ? 'កំពុងស្តាប់... (ចុចដើម្បីបិទ)' : 'និយាយដើម្បីបម្លែងជាអក្សរ (Khmer/English Speech-to-Text)'}
          >
            {isRecordingVoice ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (e.target.value === '/') {
                setShowQuickReplyMenu(true);
              }
            }}
            placeholder={
              isRecordingVoice
                ? 'កំពុងស្តាប់សម្លេងរបស់អ្នក...'
                : (language === 'kh' ? 'សរសេរសារឆ្លើយតប... (វាយ / សម្រាប់សាររហ័ស)' : 'Type a reply... (type / for shortcuts)')
            }
            className={`flex-1 px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-all placeholder:text-slate-400 ${
              isRecordingVoice
                ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-300/30 text-rose-900 font-medium'
                : 'bg-slate-50 border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
            }`}
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium text-sm rounded-lg transition-colors flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'kh' ? 'ផ្ញើសារ' : 'Send'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
