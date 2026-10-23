import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Cpu, 
  Copy, 
  Check, 
  RefreshCw, 
  MessageSquareShare, 
  Settings2, 
  Lightbulb, 
  Layers, 
  User, 
  ChevronDown, 
  ChevronUp, 
  SlidersHorizontal,
  ArrowRight,
  Database
} from 'lucide-react';
import { ChatThread, ProductItem, QuickReplyTemplate, AutoReplyRule, Order, Customer, BatchAutoPilotProgress } from '../types';

interface GeminiChatbotViewProps {
  language?: 'kh' | 'en';
  currentCustomer?: Customer;
  currentCustomerThread?: ChatThread;
  products: ProductItem[];
  quickReplies?: QuickReplyTemplate[];
  autoReplies?: AutoReplyRule[];
  recentOrders?: Order[];
  orders?: Order[];
  threads?: ChatThread[];
  isAutoPilot?: boolean;
  onToggleAutoPilot?: () => void;
  aiTypingThreadIds?: string[];
  onTriggerAutoReplyThread?: (threadId: string) => void;
  onAutoReplyAllPending?: () => void;
  batchAutoPilotProgress?: BatchAutoPilotProgress;
  onSimulateIncomingMessage?: () => void;
  onOpenThreadInInbox?: (threadId: string) => void;
  onSendToChat?: (text: string) => void;
}

interface ChatHistoryItem {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
  error?: boolean;
}

export const GeminiChatbotView: React.FC<GeminiChatbotViewProps> = ({
  language = 'kh',
  currentCustomer,
  currentCustomerThread,
  products,
  quickReplies = [],
  autoReplies = [],
  recentOrders = [],
  threads = [],
  isAutoPilot = true,
  onToggleAutoPilot,
  aiTypingThreadIds = [],
  onTriggerAutoReplyThread,
  onAutoReplyAllPending,
  batchAutoPilotProgress,
  onSimulateIncomingMessage,
  onOpenThreadInInbox,
  onSendToChat,
}) => {
  // Model state: gemini-4-argon (complex), gemini-3.8-flash (general), gemini-3.1-flash-lite (fast)
  const [selectedModel, setSelectedModel] = useState<
    'gemini-4-argon' | 'gemini-3.8-flash' | 'gemini-3.1-flash-lite'
  >('gemini-3.8-flash');

  // Role templates
  const roleTemplates = [
    {
      id: 'sales_agent',
      nameKh: 'ជំនួយការលក់ & បម្រើអតិថិជន (Sales & Concierge)',
      nameEn: 'Sales & Customer Concierge',
      instructionKh:
        'អ្នកគឺជាជំនួយការ AI Gemini ផ្នែកលក់សម្រាប់ PageChat Pro។ ច្បាប់តឹងរ៉ឹងបំផុត៖ អ្នកអាចប្រាប់តម្លៃក្នុង [ទំនិញ] និងប្រាប់ពីតម្លៃក្នុងប្រអប់ [សាររហ័ស & Bot] តែប៉ុណ្ណោះ! ហាមប្រឌិត ឬប្រាប់តម្លៃផ្សេងក្រៅពីតម្លៃដែលមានក្នុង [ទំនិញ] និងប្រអប់ [សាររហ័ស & Bot] ជាដាច់ខាត។',
      instructionEn:
        'You are the Gemini AI sales concierge for PageChat Pro. STRICT RULE: You must ONLY state prices listed in the [Products (ទំនិញ)] catalog and the [Quick Replies & Bot (សាររហ័ស & Bot)] box. Never invent or quote any other prices.',
      recommendedModel: 'gemini-3.8-flash' as const,
    },
    {
      id: 'dispute_resolver',
      nameKh: 'អ្នកដោះស្រាយវិវាទ & តថ្លៃ (Negotiation & Dispute)',
      nameEn: 'Dispute & Negotiation Specialist',
      instructionKh: 'អ្នកគឺជាអ្នកជំនាញចរចា និងដោះស្រាយវិវាទជាមួយអតិថិជន។ ដោះស្រាយអតិថិជនដែលមានការមិនពេញចិត្ត ការដឹកជញ្ជូនយឺតយ៉ាវ ឬការសុំបញ្ចុះតម្លៃច្រើន ដោយសន្តិវិធី និងឆ្លាតវៃ។',
      instructionEn: 'You are a senior customer dispute and negotiation specialist. Handle upset buyers, delivery delays, refund/exchange requests, or aggressive price negotiations with empathy, sound reasoning, policy adherence, and win-win solutions.',
      recommendedModel: 'gemini-4-argon' as const,
    },
    {
      id: 'speed_support',
      nameKh: 'ឆ្លើយតបរហ័សទាន់ចិត្ត (Instant Speed Support)',
      nameEn: 'Instant Speed Support',
      instructionKh: 'អ្នកគឺជាជំនួយការឆ្លើយតបរហ័សខ្លីខ្លឹម។ ផ្តល់ចម្លើយត្រង់ចំណុច (ព័ត៌មានកុង ABA, តម្លៃសេវាដឹក, ទំហំដែលមានក្នុងស្តុក) ដោយសង្ខេបជាចំណុចៗ។',
      instructionEn: 'You are an ultra-fast support assistant. Provide concise, direct answers with essential information (ABA payment, shipping rates, stock status) in brief bullet points.',
      recommendedModel: 'gemini-3.1-flash-lite' as const,
    },
    {
      id: 'content_creator',
      nameKh: 'អ្នកសរសេរ Caption & កម្មវិធីលក់ (Social Copywriter)',
      nameEn: 'Social Copywriter & Promo Planner',
      instructionKh: 'អ្នកគឺជាអ្នកសរសេរមាតិកាលក់ទំនិញ (Copywriter) ប្រកបដោយភាពទាក់ទាញសម្រាប់ទំព័រហ្វេសប៊ុក និងបណ្តាញសង្គម។ បង្កើត Caption ផ្សាយពាណិជ្ជកម្ម និងប្រូម៉ូសិនប្លែកៗទាក់ទាញអតិថិជន។',
      instructionEn: 'You are an e-commerce copywriter. Craft compelling promotional captions, irresistible discount hooks, and persuasive sales offers tailored for social commerce.',
      recommendedModel: 'gemini-3.8-flash' as const,
    },
  ];

  const [selectedRoleId, setSelectedRoleId] = useState<string>('sales_agent');
  const [customSystemInstruction, setCustomSystemInstruction] = useState<string>(
    roleTemplates[0].instructionKh
  );
  const [showConfig, setShowConfig] = useState(false);

  // Chat message history
  const [messages, setMessages] = useState<ChatHistoryItem[]>([
    {
      id: 'msg_welcome',
      role: 'model',
      text: language === 'kh' 
        ? 'ជម្រាបសួរ! ខ្ញុំជាជំនួយការ AI Gemini សម្រាប់ហាងរបស់អ្នក។ ខ្ញុំអាចជួយព្រាងសារឆ្លើយតបអតិថិជន, សរសេរ Caption ប្រូម៉ូសិន, ជួយដោះស្រាយបណ្តឹងអតិថិជន និងគណនាទំនិញបានគ្រប់ពេល។'
        : 'Hello! I am your Gemini AI assistant for PageChat Pro. I can draft customer replies, resolve disputes, write sales copy, and analyze orders for your store.',
      timestamp: 'Just now',
      modelUsed: 'gemini-3.8-flash',
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sentSuccessId, setSentSuccessId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Handle role change
  const handleRoleSelect = (roleId: string) => {
    setSelectedRoleId(roleId);
    const role = roleTemplates.find((r) => r.id === roleId);
    if (role) {
      setCustomSystemInstruction(language === 'kh' ? role.instructionKh : role.instructionEn);
      setSelectedModel(role.recommendedModel);
    }
  };

  // Inject context helpers
  const handleInjectProducts = () => {
    const productSummary = products
      .map((p) => `- ${p.nameKh} ($${p.price.toFixed(2)} / ${(p.priceKhr || Math.round(p.price * 4100)).toLocaleString()} រៀល, ស្តុក ${p.stock})`)
      .join('\n');
    const qrSummary = quickReplies
      .map((q) => `- [${q.shortcut}] ${q.titleKh || q.title}: ${q.content}`)
      .join('\n');
    const botSummary = autoReplies
      .filter((r) => r.enabled)
      .map((r) => `- Keywords (${r.triggerKeywords.join(', ')}): ${r.responseKh}`)
      .join('\n');
    setInputPrompt((prev) =>
      `${prev ? prev + '\n\n' : ''}[ទំនិញក្នុងហាង (ទំនិញ)]:\n${productSummary}\n\n[ប្រអប់ សាររហ័ស & Bot]:\n${qrSummary}\n${botSummary}\n\nសូមឆ្លើយតបអតិថិជនដោយប្រើតែតម្លៃក្នុង [ទំនិញ] និងក្នុងប្រអប់ [សាររហ័ស & Bot] នេះប៉ុណ្ណោះ:`
    );
  };

  const handleInjectCustomer = () => {
    if (!currentCustomer) return;
    const historySnippet = currentCustomerThread?.messages?.slice(-3)
      .map((m) => `${m.sender}: ${m.text}`)
      .join('\n') || '';
    setInputPrompt((prev) => 
      `${prev ? prev + '\n\n' : ''}[អតិថិជន]: ${currentCustomer.name} (ទូរស័ព្ទ: ${currentCustomer.phone}, ខេត្ត: ${currentCustomer.province})\n[សារចុងក្រោយ]:\n${historySnippet}\n\nសូមជួយព្រាងសារឆ្លើយតបទៅកាន់អតិថិជននេះ (ប្រាប់តែតម្លៃក្នុង ទំនិញ និង សាររហ័ស & Bot ប៉ុណ្ណោះ):`
    );
  };

  // Send message to Gemini server endpoint
  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || isLoading) return;

    const userMsgId = `usr_${Date.now()}`;
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newHistory = [
      ...messages,
      {
        id: userMsgId,
        role: 'user' as const,
        text,
        timestamp: timeStr,
      },
    ];
    setMessages(newHistory);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const payloadMessages = newHistory
        .filter((m) => !m.error)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          systemInstruction: customSystemInstruction,
          products,
          quickReplies,
          autoReplies,
          messages: payloadMessages,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server error from Gemini API');
      }

      const modelMsgId = `mod_${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: modelMsgId,
          role: 'model',
          text: data.text || 'No response generated.',
          timestamp: timeStr,
          modelUsed: data.model || selectedModel,
        },
      ]);
    } catch (err: any) {
      console.error('Gemini chat error:', err);
      const errorMsgId = `err_${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: errorMsgId,
          role: 'model',
          text: `⚠️ Error: ${err.message || 'Could not connect to Gemini service.'}`,
          timestamp: timeStr,
          error: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Copy to clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Send directly to customer chat
  const handleSendToCustomerChat = (id: string, text: string) => {
    if (onSendToChat) {
      onSendToChat(text);
      setSentSuccessId(id);
      setTimeout(() => setSentSuccessId(null), 2500);
    }
  };

  // Sample prompt chips
  const samplePrompts = [
    {
      titleKh: 'បញ្ចុះតម្លៃ 10% ជូនអតិថិជនចាស់',
      titleEn: 'Draft 10% discount for repeat customer',
      prompt: 'សូមជួយព្រាងសារផ្តល់ជូនការបញ្ចុះតម្លៃ ១០% ជូនអតិថិជនចាស់ VIP យ៉ាងផ្អែមល្ហែម និងទាក់ទាញ:',
    },
    {
      titleKh: 'ដោះស្រាយអីវ៉ាន់ដឹកយឺត',
      titleEn: 'Handle delayed delivery complaint',
      prompt: 'អតិថិជនខឹងដោយសារអីវ៉ាន់ផ្ញើទៅខេត្តយឺត ១ ថ្ងៃ សូមជួយព្រាងសារសុំទោស និងពន្យល់ដោយសមរម្យ:',
    },
    {
      titleKh: 'ណែនាំកាស Sonos Pro',
      titleEn: 'Pitch Sonos Pro Earbuds',
      prompt: 'សរសេរសារណែនាំលក្ខណៈពិសេសកាសឥតខ្សែ Sonos Pro Wireless Earbuds (កាត់សម្លេងរំខាន, ថ្មកាន់ 36 ម៉ោង, តម្លៃ $49.00):',
    },
    {
      titleKh: 'ណែនាំការបង់លុយ ABA KHQR',
      titleEn: 'Explain ABA KHQR payment instructions',
      prompt: 'សូមពន្យល់ពីរបៀបស្កេនទូទាត់តាម ABA KHQR យ៉ាងងាយស្រួល និងសុវត្ថិភាព:',
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header & Model Selector */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-800">
                {language === 'kh' ? 'ជំនួយការ AI Gemini Multi-Turn' : 'Gemini Multi-Turn AI Co-Pilot'}
              </h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {language === 'kh'
                ? 'ជួយព្រាងសារឆ្លើយតប ដោះស្រាយវិវាទ និងសរសេរ Caption ផ្សាយពាណិជ្ជកម្ម'
                : 'Intelligent multi-turn chatbot with role-specific system instructions'}
            </p>
          </div>
        </div>

        {/* Model Selection Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setSelectedModel('gemini-4-argon')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedModel === 'gemini-4-argon'
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-500" />
              <span>gemini-4-argon</span>
              <span className="text-[10px] px-1 py-0.2 bg-indigo-50 text-indigo-600 rounded">
                {language === 'kh' ? 'ឆ្លាតវៃ' : 'Complex'}
              </span>
            </button>
            <button
              onClick={() => setSelectedModel('gemini-3.8-flash')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedModel === 'gemini-3.8-flash'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>gemini-3.8-flash</span>
              <span className="text-[10px] px-1 py-0.2 bg-blue-50 text-blue-600 rounded">
                {language === 'kh' ? 'ទូទៅ' : 'General'}
              </span>
            </button>
            <button
              onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedModel === 'gemini-3.1-flash-lite'
                  ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
              <span>gemini-3.1-flash-lite</span>
              <span className="text-[10px] px-1 py-0.2 bg-emerald-50 text-emerald-600 rounded">
                {language === 'kh' ? 'លឿន' : 'Fast'}
              </span>
            </button>
          </div>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`p-2 rounded-lg border transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer ${
              showConfig
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="System Instructions & Role Settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{language === 'kh' ? 'តួនាទី AI' : 'Role & System'}</span>
            {showConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Role & System Instructions Drawer */}
      {showConfig && (
        <div className="bg-slate-50 border-b border-slate-200 p-4 shrink-0 transition-all">
          <div className="max-w-5xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-blue-600" />
                {language === 'kh' ? 'ជ្រើសរើសតួនាទី Chatbot (Chatbot Role Preset)' : 'Select Chatbot Role Preset'}
              </span>
              <span className="text-xs text-slate-500">
                {language === 'kh'
                  ? 'កំណត់អត្តសញ្ញាណ និងរបៀបឆ្លើយតាមរយៈ System Instruction'
                  : 'Controls the persona and behavior via systemInstruction'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {roleTemplates.map((role) => (
                <button
                  key={role.id}
                  onClick={() => handleRoleSelect(role.id)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    selectedRoleId === role.id
                      ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/10 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-800 line-clamp-1">
                    {language === 'kh' ? role.nameKh : role.nameEn}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {language === 'kh' ? role.instructionKh : role.instructionEn}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                    <span>Rec. Model:</span>
                    <span className="font-semibold text-blue-600">{role.recommendedModel}</span>
                  </div>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {language === 'kh' ? 'កែប្រែ System Instruction (សេចក្តីណែនាំផ្ទាល់ខ្លួន):' : 'Custom System Instruction:'}
              </label>
              <textarea
                value={customSystemInstruction}
                onChange={(e) => setCustomSystemInstruction(e.target.value)}
                rows={2}
                className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6" ref={scrollRef}>
        <div className="max-w-4xl mx-auto space-y-4">
          {/* LIVE AI GEMINI AUTO-CHAT ENGINE FOR INCOMING MESSAGES */}
          <div className="bg-white border-2 border-indigo-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 ${
                    isAutoPilot
                      ? 'bg-gradient-to-tr from-emerald-500 to-teal-600'
                      : 'bg-slate-400'
                  }`}
                >
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900">
                      {language === 'kh'
                        ? 'ប្រព័ន្ធ ជំនួយការ AI Gemini ឆាត Auto ពេលមានសារចូល'
                        : 'Gemini AI Auto-Chat Engine for Incoming Messages'}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        isAutoPilot
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isAutoPilot ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                        }`}
                      />
                      <span>
                        {isAutoPilot
                          ? language === 'kh'
                            ? 'ឆាត Auto កំពុងដំណើរការ 24/7'
                            : 'Auto-Chat Active 24/7'
                          : language === 'kh'
                          ? 'បានបិទ ឆាត Auto'
                          : 'Auto-Chat Paused'}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {language === 'kh'
                      ? 'ពេលមានសារអតិថិជនចូលកម្មវិធី ជំនួយការ AI Gemini នឹងចាប់យកសារ និងឆ្លើយតបទៅអតិថិជនដោយស្វ័យប្រវត្តិភ្លាមៗ'
                      : 'Automatically detects incoming customer messages and replies via Gemini AI'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {onToggleAutoPilot && (
                  <button
                    type="button"
                    onClick={onToggleAutoPilot}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                      isAutoPilot
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-800 hover:bg-slate-900 text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {isAutoPilot
                        ? language === 'kh'
                          ? 'បើកឆាត Auto (ON)'
                          : 'Auto-Chat: ON'
                        : language === 'kh'
                        ? 'ចុចបើក ឆាត Auto ឥឡូវ'
                        : 'Turn ON Auto-Chat'}
                    </span>
                  </button>
                )}

                {onAutoReplyAllPending && (
                  <button
                    type="button"
                    onClick={() => onAutoReplyAllPending()}
                    disabled={batchAutoPilotProgress?.isRunning}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                      batchAutoPilotProgress?.isRunning
                        ? 'bg-indigo-400 text-white cursor-wait'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                    }`}
                    title={
                      language === 'kh'
                        ? 'ចុចដើម្បីដំណើរការឆាត Auto លើគ្រប់សាររង់ចាំទាំងអស់ក្នុងពេលតែមួយ'
                        : 'Click to process all pending threads in a single click'
                    }
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${batchAutoPilotProgress?.isRunning ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {batchAutoPilotProgress?.isRunning
                        ? language === 'kh'
                          ? `កំពុងដំណើរការ (${batchAutoPilotProgress.completed}/${batchAutoPilotProgress.total})...`
                          : `Processing (${batchAutoPilotProgress.completed}/${batchAutoPilotProgress.total})...`
                        : language === 'kh'
                        ? '⚡ ឆាត Auto គ្រប់សារឥឡូវនេះ'
                        : '⚡ Auto-Reply All Now'}
                    </span>
                  </button>
                )}

                {onSimulateIncomingMessage && (
                  <button
                    type="button"
                    onClick={onSimulateIncomingMessage}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>
                      {language === 'kh'
                        ? '+ សាកល្បងសារចូលថ្មី (Test Auto-Chat)'
                        : '+ Simulate Incoming Msg'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Batch Auto-Pilot Operation Progress Indicator */}
            {(batchAutoPilotProgress?.isRunning || batchAutoPilotProgress?.finishedMessage) && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 border border-indigo-200 space-y-2">
                {batchAutoPilotProgress.isRunning ? (
                  <>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 font-bold text-indigo-950 min-w-0">
                        <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                        <span className="truncate">
                          {language === 'kh'
                            ? `កំពុងដំណើរការឆាត Auto ជាក្រុម — ឆ្លើយតបទៅ៖ ${batchAutoPilotProgress.currentCustomerName || 'អតិថិជន'}`
                            : `Batch Auto-Pilot Running — Replying to: ${batchAutoPilotProgress.currentCustomerName || 'Customer'}`}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold text-indigo-700 bg-white px-2.5 py-0.5 rounded-full border border-indigo-200 tabular-nums shrink-0">
                        {batchAutoPilotProgress.completed} / {batchAutoPilotProgress.total} (
                        {Math.round(
                          (batchAutoPilotProgress.completed / Math.max(1, batchAutoPilotProgress.total)) * 100
                        )}
                        %)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-indigo-200/70 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 transition-all duration-300 rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              8,
                              Math.round(
                                (batchAutoPilotProgress.completed / Math.max(1, batchAutoPilotProgress.total)) * 100
                              )
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-emerald-800">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{batchAutoPilotProgress.finishedMessage}</span>
                    </div>
                    {batchAutoPilotProgress.total > 0 && (
                      <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full tabular-nums">
                        100% ({batchAutoPilotProgress.completed}/{batchAutoPilotProgress.total})
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Live Incoming Threads & AI Auto-Reply Status List */}
            {threads.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span>📩 សារអតិថិជនក្នុងកម្មវិធី និងចម្លើយឆាត Auto របស់ AI Gemini ({threads.length})</span>
                  </span>
                  <span className="text-emerald-700 font-semibold">
                    {
                      threads.filter((t) =>
                        t.messages.some((m) => m.sender === 'bot')
                      ).length
                    }{' '}
                    / {threads.length} ឆ្លើយតបដោយ AI រួចរាល់
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {threads.slice(0, 6).map((t) => {
                    const lastCustMsg = [...t.messages].reverse().find((m) => m.sender === 'customer');
                    const lastBotMsg = [...t.messages].reverse().find((m) => m.sender === 'bot');
                    const isCurrentlyReplying = aiTypingThreadIds.includes(t.id);
                    const lastOverall = t.messages[t.messages.length - 1];
                    const needsAiReply = lastOverall?.sender === 'customer';

                    return (
                      <div
                        key={t.id}
                        className={`p-3 rounded-xl border text-xs flex flex-col justify-between gap-2 transition-all ${
                          isCurrentlyReplying
                            ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/15'
                            : needsAiReply
                            ? 'bg-amber-50/50 border-amber-200'
                            : 'bg-slate-50/80 border-slate-200'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 truncate">
                              👤 {t.customer.name}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                isCurrentlyReplying
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : !needsAiReply && lastBotMsg
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isCurrentlyReplying
                                ? '🤖 កំពុងឆាត Auto...'
                                : !needsAiReply && lastBotMsg
                                ? '✓ AI ឆាត Auto រួចរាល់'
                                : 'កំពុងរង់ចាំឆាត Auto'}
                            </span>
                          </div>

                          {lastCustMsg && (
                            <p className="text-[11px] text-slate-600 line-clamp-1 bg-white px-2 py-1 rounded border border-slate-200/70">
                              <span className="font-semibold text-slate-800">សារភ្ញៀវ:</span> {lastCustMsg.text}
                            </p>
                          )}

                          {lastBotMsg && (
                            <p className="text-[11px] text-indigo-900 line-clamp-2 bg-indigo-50/80 px-2 py-1 rounded border border-indigo-100">
                              <span className="font-bold text-indigo-700">🤖 AI Gemini:</span> {lastBotMsg.text}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-200/60">
                          {onTriggerAutoReplyThread && (
                            <button
                              type="button"
                              onClick={() => onTriggerAutoReplyThread(t.id)}
                              disabled={isCurrentlyReplying}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <Bot className="w-3 h-3" />
                              <span>{isCurrentlyReplying ? 'កំពុងឆ្លើយ...' : 'ឱ្យ AI ឆាត Auto ឥឡូវ'}</span>
                            </button>
                          )}
                          {onOpenThreadInInbox && (
                            <button
                              type="button"
                              onClick={() => onOpenThreadInInbox(t.id)}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <span>មើលឆាត</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Context Injection Banner */}
          <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200/60 rounded-xl p-3 text-xs text-slate-700 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                {language === 'kh'
                  ? 'បញ្ចូលទិន្នន័យជាក់ស្តែងទៅក្នុងសំណួរ:'
                  : 'Inject live store context into chat:'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={handleInjectProducts}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-md border border-slate-200 font-medium transition-colors cursor-pointer"
              >
                + {language === 'kh' ? 'ទំនិញក្នុងស្តុក' : 'Products'} ({products.length})
              </button>
              {currentCustomer && (
                <button
                  onClick={handleInjectCustomer}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-md border border-slate-200 font-medium transition-colors cursor-pointer"
                >
                  + {language === 'kh' ? 'អតិថិជនសកម្ម' : 'Active Customer'} ({currentCustomer.name})
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[11px] font-semibold text-slate-600">
                      {isUser ? (language === 'kh' ? 'Admin ហាង' : 'Store Admin') : 'Gemini AI'}
                    </span>
                    {msg.modelUsed && (
                      <span className="text-[10px] text-blue-600 font-mono bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                        {msg.modelUsed}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                  </div>

                  <div
                    className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-xs shadow-xs'
                        : msg.error
                        ? 'bg-red-50 text-red-700 border border-red-200 rounded-tl-xs'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs shadow-xs'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Actions on Model Messages */}
                  {!isUser && !msg.error && (
                    <div className="flex items-center gap-2 mt-1.5 px-1">
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-200/60 cursor-pointer"
                        title="Copy text"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600 font-medium">
                              {language === 'kh' ? 'ចម្លងរួច' : 'Copied'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{language === 'kh' ? 'ចម្លង' : 'Copy'}</span>
                          </>
                        )}
                      </button>

                      {onSendToChat && (
                        <button
                          onClick={() => handleSendToCustomerChat(msg.id, msg.text)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-blue-50 cursor-pointer"
                          title="Send directly into customer conversation"
                        >
                          {sentSuccessId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600 font-medium">
                                {language === 'kh' ? 'បានផ្ញើរួចរាល់!' : 'Sent to Chat!'}
                              </span>
                            </>
                          ) : (
                            <>
                              <MessageSquareShare className="w-3 h-3" />
                              <span>{language === 'kh' ? 'ផ្ញើទៅឆាតអតិថិជន' : 'Send to Customer Chat'}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-3.5 text-xs text-slate-500 shadow-xs flex items-center gap-2">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]"></span>
                </span>
                <span>
                  {language === 'kh'
                    ? `Gemini (${selectedModel}) កំពុងគិត និងព្រាងចម្លើយ...`
                    : `Gemini (${selectedModel}) is reasoning...`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="bg-white border-t border-slate-200 px-4 py-2 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 flex items-center gap-1 shrink-0">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">{language === 'kh' ? 'គំរូសួរ:' : 'Prompt ideas:'}</span>
          </span>
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p.prompt)}
              className="shrink-0 px-2.5 py-1 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-full transition-colors border border-slate-200/60 cursor-pointer"
            >
              {language === 'kh' ? p.titleKh : p.titleEn}
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <div className="bg-white border-t border-slate-200 p-4 shrink-0 shadow-lg">
        <div className="max-w-3xl mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1 bg-slate-50 border border-slate-300 rounded-xl focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all p-1.5">
              <textarea
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  language === 'kh'
                    ? `សួរសំណួរទៅកាន់ Gemini ${selectedModel} (ចុច Enter ដើម្បីផ្ញើ, Shift+Enter ចុះបន្ទាត់)...`
                    : `Ask Gemini ${selectedModel} (Press Enter to send)...`
                }
                rows={2}
                className="w-full bg-transparent border-0 text-slate-800 text-xs sm:text-sm p-1.5 focus:outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !inputPrompt.trim()}
              className="h-11 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-600/20 disabled:shadow-none shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'kh' ? 'ផ្ញើ' : 'Send'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
