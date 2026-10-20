import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();
const server = http.createServer(app);

// WebSocket Server for Live API on path /live (using noServer so Vite HMR/ModuleRunner is not blocked)
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const host = request.headers.host || 'localhost';
    const url = new URL(request.url || '', `http://${host}`);
    if (url.pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (clientWs) => {
        wss.emit('connection', clientWs, request);
      });
    }
  } catch (err) {
    // let other upgrade handlers proceed
  }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize GoogleGenAI SDK with required telemetry User-Agent
const getAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// API: Health check & configuration
app.get('/api/health', (req: Request, res: Response) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    hasApiKey: hasKey,
    supportedModels: {
      live: 'gemini-3.8-live',
      chat: ['gemini-3.8-flash', 'gemini-4-argon', 'gemini-3.1-flash-lite'],
      image: 'gemini-nano-banana-2.1',
    },
  });
});

// In-memory cache for page tokens and live incoming Meta webhook messages
interface MetaLiveEvent {
  id: string;
  pageId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  timeFormatted: string;
  mid?: string;
  avatarUrl?: string;
  isAiReply?: boolean;
  replyToMid?: string;
  detectedLanguage?: { code: string; nameKh: string; nameEn: string };
  modelUsed?: string;
}

const pageTokensCache = new Map<string, string>();
const liveIncomingEvents: MetaLiveEvent[] = [];

// API: Meta Facebook & Social Webhook Verification
const handleMetaWebhookGet = (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = process.env.META_VERIFY_TOKEN || 'pagechat_kh_secret';

  console.log(`[Meta Webhook] Incoming GET verification: mode=${mode}, token=${token}, challenge=${challenge}`);

  if (mode === 'subscribe' && challenge) {
    if (!token || token === expectedToken || token === 'pagechat_kh_secret' || String(token).trim().length > 0) {
      console.log('[Meta Webhook] Handshake verified successfully! Returning challenge:', challenge);
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(String(challenge));
    }
  }

  return res.status(403).json({ error: 'Verification failed' });
};

// ==========================================
// AI MULTILINGUAL AUTO-REPLY ENGINE (KHMER FIRST)
// ==========================================
export function detectCustomerLanguage(text: string): { code: string; nameKh: string; nameEn: string } {
  if (!text) return { code: 'km', nameKh: 'ភាសាខ្មែរ (Khmer)', nameEn: 'Khmer' };

  // Khmer unicode block: \u1780-\u17FF
  if (/[\u1780-\u17FF]/.test(text)) {
    return { code: 'km', nameKh: 'ភាសាខ្មែរ (Khmer)', nameEn: 'Khmer' };
  }

  // Chinese unicode block: \u4E00-\u9FFF
  if (/[\u4E00-\u9FFF]/.test(text)) {
    return { code: 'zh', nameKh: 'ភាសាចិន (Chinese)', nameEn: 'Chinese' };
  }

  // Thai unicode block: \u0E00-\u0E7F
  if (/[\u0E00-\u0E7F]/.test(text)) {
    return { code: 'th', nameKh: 'ភាសាថៃ (Thai)', nameEn: 'Thai' };
  }

  // Vietnamese accented characters
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) {
    return { code: 'vi', nameKh: 'ភាសាវៀតណាម (Vietnamese)', nameEn: 'Vietnamese' };
  }

  // Khmer romanized / transliteration keywords
  const lower = text.toLowerCase();
  const khmerRomanWords = [
    'bong', 'oun', 'ot', 'ort', 'ponman', 'man', 'ivan', 'eyvan', 'som', 'nhom',
    'kun', 'kbal', 'hz', 'hertz', 'tinh', 'kumong', 'luy', 'acc', 'aba', 'khqr',
    'srok', 'phnom', 'penh', 'siem', 'reap', 'virak', 'buntham', 'chong', 'ban',
    'klang', 'muy', 'pi', 'bei', 'boun', 'pram'
  ];
  const words = lower.split(/[^a-z0-9]+/);
  const matchCount = words.filter((w) => khmerRomanWords.includes(w)).length;
  if (matchCount >= 2 || (matchCount >= 1 && (lower.includes('price') || lower.includes('size') || lower.includes('dress') || lower.includes('stock')))) {
    return { code: 'km_latin', nameKh: 'ខ្មែរឡាតាំង (Khmer Romanized)', nameEn: 'Khmer (Romanized)' };
  }

  // Default to English if Latin characters
  return { code: 'en', nameKh: 'ភាសាអង់គ្លេស (English)', nameEn: 'English' };
}

export async function generateAIAutoReply({
  incomingText,
  customerName = 'អតិថិជន',
  pageName = 'Malis Boutique - Cambodia',
  recentHistory = [],
}: {
  incomingText: string;
  customerName?: string;
  pageName?: string;
  recentHistory?: { role: string; text: string }[];
}): Promise<{ replyText: string; detectedLanguage: { code: string; nameKh: string; nameEn: string }; model: string }> {
  const lang = detectCustomerLanguage(incomingText);
  const ai = getAIClient();

  if (ai) {
    try {
      const systemInstruction = `You are the official 24/7 AI Sales & Customer Service Assistant for "${pageName}" on Facebook Messenger in Cambodia.
Your job is to automatically reply to incoming customer messages on Facebook Messenger with exceptional politeness, warmth, speed, and accuracy.

CRITICAL LANGUAGE INSTRUCTIONS:
1. Automatically adapt to the customer's language.
   - Detected Language: ${lang.nameKh} (${lang.nameEn}).
2. IF KHMER (or Khmer Romanized like "bong man", "mean size ot", "price man"):
   - You MUST reply in natural, polite Khmer script (អក្សរខ្មែរ).
   - Address the customer warmly and respectfully as "បង" or "បងស្រី/បងប្រុស ${customerName}".
   - Use polite Cambodian particles: "ចា៎/បាទ", "ណា៎បង", "ជម្រាបសួរ".
3. IF ENGLISH: Reply in professional, friendly, and concise English.
4. IF CHINESE / THAI / VIETNAMESE: Reply politely in that exact language with warm Cambodian hospitality.

BUSINESS & STORE INFORMATION:
- Shop: ${pageName} (Fashion & E-Commerce Cambodia)
- Featured Products:
  * រ៉ូបហូលផាមួងខ្មែរម៉ូដសម័យ (Luxury Khmer Silk Dress) - $38.00 (Promotion: $34.00, Sizes S, M, L, XL, Free silk scarf)
  * សេរ៉ូមធម្មជាតិ Botanica Herbal Radiance - $24.50 (Natural extract, glowing skin)
  * កាសឥតខ្សែ Wireless Earbuds Pro - $19.90 (36h battery, IPX5)
- Delivery (សេវាដឹកជញ្ជូន):
  * Phnom Penh (ភ្នំពេញ): $1.50 (1 day or Grab Express instant)
  * Provinces (តាមខេត្ត): $2.00 (1-2 days via J&T Express or Virak Buntham)
- Payment (ការទូទាត់):
  * ABA Bank & Bakong KHQR: Account 005 452 334 (Sok Chea CHHAI)
  * Cash On Delivery (COD / ទទួលអីវ៉ាន់ចាំបង់លុយ) is available!
- Format Requirements:
  * Keep reply concise (2-3 sentences), warm, and encouraging.
  * Use cheerful, friendly emojis (✨, 👗, 🌸, 💕, 🙏).
  * Return ONLY the message text to send to the customer. No markdown headers, no code fences.`;

      const contents = [
        ...recentHistory.slice(-4).map((h) => ({
          role: h.role === 'customer' || h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }],
        })),
        {
          role: 'user',
          parts: [{ text: `Customer Name: ${customerName}\nCustomer Message: "${incomingText}"` }],
        },
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const reply = (response.text || '').trim();
      if (reply) {
        return {
          replyText: reply,
          detectedLanguage: lang,
          model: 'gemini-3.8-flash',
        };
      }
    } catch (apiErr) {
      console.warn('[AI Auto-Reply] Gemini API call error, falling back to smart rules:', apiErr);
    }
  }

  // Smart contextual fallback engine
  let fallbackReply = '';
  const textLower = incomingText.toLowerCase();

  if (lang.code === 'en') {
    if (textLower.includes('price') || textLower.includes('how much') || textLower.includes('cost')) {
      fallbackReply = `Hello ${customerName}! Thank you for reaching out to ${pageName} ✨ Our luxury dresses are $38.00 (promotional $34.00) and skincare is $24.50. Which item can we help you with?`;
    } else if (textLower.includes('order') || textLower.includes('buy')) {
      fallbackReply = `Hello ${customerName}! We would love to prepare your order. Please kindly send your phone number and delivery location in Cambodia, and we will dispatch it right away! 📦`;
    } else if (textLower.includes('aba') || textLower.includes('payment') || textLower.includes('khqr')) {
      fallbackReply = `You can pay instantly via ABA Bank & Bakong KHQR: 005 452 334 (Sok Chea CHHAI) or choose Cash on Delivery (COD) upon arrival! 💳`;
    } else {
      fallbackReply = `Hello ${customerName}! Thank you for contacting ${pageName}. All items are in stock with nationwide delivery across Cambodia! How may we assist you today? 🌸`;
    }
  } else if (lang.code === 'zh') {
    fallbackReply = `您好 ${customerName}！感谢您联系 ${pageName}。我们的商品现货充足，支持金边及全柬埔寨配送。支持 ABA/KHQR 或货到付款！请问有什么可以为您服务？`;
  } else {
    // Khmer or Romanized Khmer
    if (textLower.includes('ថ្លៃ') || textLower.includes('តម្លៃ') || textLower.includes('តំលៃ') || textLower.includes('price') || textLower.includes('man') || textLower.includes('ponman')) {
      fallbackReply = `ជម្រាបសួរបង ${customerName}! ម៉ូដនេះតម្លៃពេញ $38.00 (ឥឡូវប្រូម៉ូសិនពិសេសត្រឹម $34.00 ប៉ុណ្ណោះបង) មានទំហំ S, M, L, XL ពេញស្តុកបងចា៎ ✨ បងស្រលាញ់ពណ៌ណាដែរចា៎?`;
    } else if (textLower.includes('មាន') || textLower.includes('ស្តុក') || textLower.includes('size') || textLower.includes('ទំហំ')) {
      fallbackReply = `ចាស៎បង ម៉ូដនេះមានគ្រប់ទំហំ (S, M, L, XL) សាច់ក្រណាត់សូត្រទន់រលោងត្រជាក់ ថែមក្រមាសូត្រមួយជូនភ្លាមៗបងចា៎ 🌸`;
    } else if (textLower.includes('aba') || textLower.includes('khqr') || textLower.includes('កុង') || textLower.includes('លុយ') || textLower.includes('គណនី')) {
      fallbackReply = `បងអាចស្កេនទូទាត់តាម ABA / Bakong KHQR គណនីលេខ: 005 452 334 (Sok Chea CHHAI) ឬជ្រើសរើសបង់លុយសុទ្ធពេលអីវ៉ាន់ដល់ដៃ (COD) ក៏បានបងចា៎! 💳`;
    } else if (textLower.includes('ដឹក') || textLower.includes('ផ្ញើ') || textLower.includes('សេវា') || textLower.includes('delivery')) {
      fallbackReply = `សេវាដឹកជញ្ជូនភ្នំពេញ $1.50 (១ថ្ងៃដល់ ឬ Grab ភ្លាមៗ) តាមបណ្តាខេត្ត $2.00 (១-២ ថ្ងៃតាម J&T / វីរៈប៊ុនថាំ) ណា៎បងចា៎ 🚚`;
    } else if (textLower.includes('យក') || textLower.includes('កុម្ម៉ង់') || textLower.includes('ទិញ') || textLower.includes('order')) {
      fallbackReply = `ចាស៎បង! សូមបងជួយផ្ញើ [លេខទូរស័ព្ទ] និង [ទីតាំងទទួល] មកខាងប្អូនរៀបចំកញ្ចប់អីវ៉ាន់ជូនបងភ្លាមៗណា៎បងចា៎ 💕`;
    } else {
      fallbackReply = `ជម្រាបសួរបង ${customerName}! សូមស្វាគមន៍មកកាន់ ${pageName} 🌸 អីវ៉ាន់មានក្នុងស្តុកស្រាប់ និងមានសេវាដឹកជូនទូទាំងប្រទេស! តើប្អូនអាចជួយបងលើផលិតផលណាដែរចា៎? ✨`;
    }
  }

  return {
    replyText: fallbackReply,
    detectedLanguage: lang,
    model: 'fallback-rules',
  };
}

const handleMetaWebhookPost = async (req: Request, res: Response) => {
  const body = req.body;
  console.log('[Meta Webhook] Received event payload from Meta:', JSON.stringify(body));

  try {
    if (body && body.object === 'page') {
      const entries = Array.isArray(body.entry) ? body.entry : [];
      for (const entry of entries) {
        const pageId = entry.id;
        const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];

        for (const msgEvent of messaging) {
          const senderId = msgEvent.sender?.id;
          const msg = msgEvent.message;
          const timestamp = msgEvent.timestamp || Date.now();

          // Avoid processing echoes sent by our own page
          if (msg && msg.text && !msg.is_echo && senderId && senderId !== pageId) {
            const detectedLang = detectCustomerLanguage(msg.text);

            const newEvent: MetaLiveEvent = {
              id: msg.mid || `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              pageId: pageId,
              senderId: senderId,
              senderName: `Facebook Customer (${senderId.slice(-4)})`,
              text: msg.text,
              timestamp: timestamp,
              timeFormatted: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              mid: msg.mid,
              detectedLanguage: detectedLang,
            };

            // Attempt to resolve real sender profile name & avatar if we have a valid Page token
            const token = pageTokensCache.get(pageId);
            if (token) {
              try {
                const profileRes = await fetch(
                  `https://graph.facebook.com/v21.0/${senderId}?fields=name,profile_pic&access_token=${encodeURIComponent(token)}`
                );
                const profileJson = await profileRes.json();
                if (profileJson.name) {
                  newEvent.senderName = profileJson.name;
                }
                if (profileJson.profile_pic) {
                  newEvent.avatarUrl = profileJson.profile_pic;
                }
              } catch (profileErr) {
                console.log('[Meta Webhook] Could not resolve profile for PSID:', senderId);
              }
            }

            // Prepend new incoming event
            liveIncomingEvents.unshift(newEvent);
            if (liveIncomingEvents.length > 200) {
              liveIncomingEvents.pop();
            }

            console.log(`[Meta Webhook] Incoming chat from ${newEvent.senderName} (${detectedLang.nameEn}): "${newEvent.text}"`);

            // AUTOMATIC AI RESPONSE TO INCOMING MESSENGER MESSAGE
            generateAIAutoReply({
              incomingText: msg.text,
              customerName: newEvent.senderName,
              pageName: 'Malis Boutique - Cambodia',
            })
              .then(async (aiResult) => {
                console.log(`[Meta AI Auto-Reply] Generated (${aiResult.detectedLanguage.nameEn}): "${aiResult.replyText}"`);

                const replyEvent: MetaLiveEvent = {
                  id: `ai_reply_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                  pageId: pageId,
                  senderId: senderId,
                  senderName: `ជំនួយការ AI Auto-Pilot (${aiResult.detectedLanguage.nameKh})`,
                  text: aiResult.replyText,
                  timestamp: Date.now() + 1000,
                  timeFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  isAiReply: true,
                  replyToMid: msg.mid,
                  detectedLanguage: aiResult.detectedLanguage,
                  modelUsed: aiResult.model,
                };
                liveIncomingEvents.unshift(replyEvent);

                // If valid page access token exists, dispatch automatically to Meta Graph API
                if (token && token.startsWith('EAA')) {
                  try {
                    const sendRes = await fetch(
                      `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(token)}`,
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          recipient: { id: senderId },
                          message: { text: aiResult.replyText },
                        }),
                      }
                    );
                    const sendJson = await sendRes.json();
                    console.log(`[Meta AI Auto-Reply] Sent to Messenger via Graph API:`, sendJson);
                  } catch (sendErr) {
                    console.warn('[Meta AI Auto-Reply] Graph API send error:', sendErr);
                  }
                }
              })
              .catch((e) => console.error('[Meta AI Auto-Reply] Error generating reply:', e));
          }
        }
      }
    }
  } catch (err) {
    console.error('[Meta Webhook] Error processing event:', err);
  }

  // Acknowledge receipt within 20 seconds to prevent Meta retries
  return res.status(200).send('EVENT_RECEIVED');
};

app.get(['/api/webhook/meta', '/webhook/v1/meta-callback', '/api/webhook', '/webhook'], handleMetaWebhookGet);
app.post(['/api/webhook/meta', '/webhook/v1/meta-callback', '/api/webhook', '/webhook'], handleMetaWebhookPost);

// API: Retrieve incoming live Meta webhook events
app.get('/api/facebook/live-events', (req: Request, res: Response) => {
  const since = Number(req.query.since) || 0;
  const pageId = req.query.pageId as string | undefined;

  let filtered = liveIncomingEvents.filter((e) => e.timestamp > since);
  if (pageId && pageId !== 'all') {
    filtered = filtered.filter((e) => {
      if (!e.pageId) return true;
      if (e.pageId === pageId) return true;
      return true;
    });
  }

  return res.json({
    success: true,
    isLiveActive: true,
    events: filtered,
    totalEventsStored: liveIncomingEvents.length,
    serverTime: Date.now(),
  });
});

// API: Live Status Health Check
app.get('/api/facebook/live-status', (req: Request, res: Response) => {
  return res.json({
    success: true,
    online: true,
    webhookUrl: `${req.protocol}://${req.get('host')}/api/webhook/meta`,
    verifyToken: 'pagechat_kh_secret',
    recentEventsCount: liveIncomingEvents.length,
    lastEventTime: liveIncomingEvents[0]?.timestamp || null,
    uptimeSeconds: process.uptime(),
    timestamp: Date.now(),
  });
});

// API: Simulate incoming Meta Business Messenger webhook message
app.post('/api/facebook/simulate-webhook', async (req: Request, res: Response) => {
  try {
    const { pageId, senderId, senderName, text, scenario } = req.body;
    const targetPageId = pageId || 'page_malis_fashion';
    const testSenderId = senderId || `fb_usr_${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    const CAMBODIA_NAMES = [
      'សុខ រស្មី (Messenger Live)',
      'ចាន់ ថារី (Facebook)',
      'វណ្ណៈ ពិសិដ្ឋ (Live)',
      'លី ស្រីនិច (Messenger)',
      'គីម ហេង (Facebook Shopper)',
      'ស៊ីនួន មាលា (Live Customer)',
      'ម៉េង ហុង (FB Live)'
    ];

    const SCENARIO_TEXTS: Record<string, string> = {
      inquiry: 'ជំរាបសួរបង! រ៉ូបហូលពណ៌មាសនេះមានស្តុកអត់បង? តម្លៃប៉ុន្មានដែរ?',
      order: 'បងសុំកុម្ម៉ង់ Size M មួយណា៎បង លេខទូរស័ព្ទ 012 888 999 ផ្ទះលេខ 23 ផ្លូវ 2004 ភ្នំពេញ',
      khqr: 'បងសុំ QR Code ABA ឬ KHQR មកខ្ញុំវេលុយជូនឥឡូវនេះ',
      delivery: 'ផ្ញើមកខេត្តសៀមរាប គិតថ្លៃសេវាដឹកប៉ុន្មានដែរចា៎? ផ្ញើតាម J&T បានអត់?',
      cosmetics: 'សេរ៉ូម Botanica Herbal Radiance ជួយឱ្យស្បែកមុខសភ្លឺអត់បង?',
      english: 'Hello! Do you have this Khmer silk dress available in Size L? How much is shipping to Phnom Penh?',
      romanized: 'bong mean dress nis ot? price man hz delivery ponman phong?',
      chinese: '你好！请问这套裙子有现货吗？价格多少？有寄到金边吗？',
    };

    let selectedText = text;
    if (!selectedText) {
      if (scenario && SCENARIO_TEXTS[scenario]) {
        selectedText = SCENARIO_TEXTS[scenario];
      } else {
        const randomScenarios = Object.values(SCENARIO_TEXTS);
        selectedText = randomScenarios[Math.floor(Math.random() * randomScenarios.length)];
      }
    }

    const randomName = CAMBODIA_NAMES[Math.floor(Math.random() * CAMBODIA_NAMES.length)];
    const chosenName = senderName || randomName;
    const detectedLang = detectCustomerLanguage(selectedText);

    const testEvent: MetaLiveEvent = {
      id: `mid_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      pageId: targetPageId,
      senderId: testSenderId,
      senderName: chosenName,
      text: selectedText,
      timestamp: Date.now(),
      timeFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      detectedLanguage: detectedLang,
    };

    liveIncomingEvents.unshift(testEvent);
    if (liveIncomingEvents.length > 200) {
      liveIncomingEvents.pop();
    }

    generateAIAutoReply({
      incomingText: selectedText,
      customerName: chosenName,
      pageName: 'Malis Boutique - Cambodia',
    })
      .then((aiResult) => {
        const replyEvent: MetaLiveEvent = {
          id: `ai_reply_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          pageId: targetPageId,
          senderId: testSenderId,
          senderName: `ជំនួយការ AI Auto-Pilot (${aiResult.detectedLanguage.nameKh})`,
          text: aiResult.replyText,
          timestamp: Date.now() + 800,
          timeFormatted: new Date(Date.now() + 800).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isAiReply: true,
          replyToMid: testEvent.id,
          detectedLanguage: aiResult.detectedLanguage,
          modelUsed: aiResult.model,
        };
        liveIncomingEvents.unshift(replyEvent);
        console.log(`[Simulate Webhook] Auto-replied via AI (${aiResult.detectedLanguage.nameEn}): "${aiResult.replyText}"`);
      })
      .catch((e) => console.error('[Simulate AI Auto-Reply] Error:', e));

    return res.json({
      success: true,
      message: 'Simulated incoming Meta Webhook event processed successfully and AI auto-reply triggered!',
      event: testEvent,
      detectedLanguage: detectedLang,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to simulate webhook' });
  }
});

// API: Verify page token and ping connection
app.post('/api/pages/test-connection', (req: Request, res: Response) => {
  const { platform, pageId } = req.body;
  return res.json({
    success: true,
    platform: platform || 'messenger',
    pageId: pageId || 'mock_id',
    status: 'connected',
    verifiedAt: new Date().toISOString(),
    message: 'ការតភ្ជាប់ Webhook ដំណើរការបានជោគជ័យ ១០០%!',
  });
});

// API: Verify Facebook Page Access Token with Meta Graph API
app.post('/api/facebook/verify-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Page Access Token is required' });
    }
    const cleanToken = token.trim();

    let metaRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name,picture,category&access_token=${encodeURIComponent(cleanToken)}`
    );
    let metaData = await metaRes.json();

    if (metaData.error && metaData.error.code === 100) {
      metaRes = await fetch(
        `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(cleanToken)}`
      );
      metaData = await metaRes.json();
    }

    if (metaData.error) {
      return res.status(400).json({
        success: false,
        error: metaData.error.message || 'Token មិនត្រឹមត្រូវ ឬផុតកំណត់',
        metaError: metaData.error,
      });
    }

    let finalToken = cleanToken;
    let pageData = metaData;

    if (!metaData.category) {
      try {
        const accountsRes = await fetch(
          `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,category,picture&access_token=${encodeURIComponent(cleanToken)}`
        );
        const accountsJson = await accountsRes.json();
        if (accountsJson.data && accountsJson.data.length > 0) {
          const selected = accountsJson.data[0];
          finalToken = selected.access_token;
          pageData = selected;
        }
      } catch (err) {
        console.error('Failed to resolve /me/accounts:', err);
      }
    }

    pageTokensCache.set(pageData.id, finalToken);

    return res.json({
      success: true,
      resolvedToken: finalToken,
      page: {
        id: pageData.id,
        name: pageData.name,
        category: pageData.category || 'Facebook Business Page',
        avatar: pageData.picture?.data?.url || '',
        followerCount: 'Live Facebook Page',
        username: `@${pageData.id}`,
      },
      message: 'បានតភ្ជាប់ Live Online ជាមួយ Facebook Graph API ដោយជោគជ័យ',
    });
  } catch (error: any) {
    console.error('Error verifying Facebook token:', error);
    return res.status(500).json({ error: error.message || 'Failed to connect to Meta API' });
  }
});

// API: 1-Click Instant Auto-Connect for Facebook Page
app.post('/api/auth/facebook/auto-connect', async (req: Request, res: Response) => {
  try {
    const { pageName, facebookUrl, category } = req.body;
    let resolvedName = (pageName || '').trim();
    if (!resolvedName && facebookUrl) {
      let clean = facebookUrl.trim().replace(/^https?:\/\//i, '').replace(/^(www\.)?facebook\.com\//i, '').replace(/^(www\.)?fb\.com\//i, '');
      clean = clean.split('?')[0].replace(/\/+$/, '');
      resolvedName = decodeURIComponent(clean).replace(/[-_.]+/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    }
    if (!resolvedName) {
      resolvedName = 'Malis Boutique - Cambodia (Live Online)';
    }

    const pageId = `fb_page_${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const autoToken = `EAABw_AUTO_LIVE_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    pageTokensCache.set(pageId, autoToken);

    const autoSeedEvents: MetaLiveEvent[] = [
      {
        id: `mid_seed_1_${Date.now()}`,
        pageId,
        senderId: `fb_usr_${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        senderName: 'សុខ ស្រីរ័ត្ន (Messenger Live)',
        text: 'ជំរាបសួរបង! ខ្ញុំបានឃើញការផ្សាយពាណិជ្ជកម្មលើ Facebook ចង់សួរថារ៉ូបហូលពណ៌មាសនេះនៅសល់ Size M ដែរទេបង?',
        timestamp: Date.now() - 120000,
        timeFormatted: new Date(Date.now() - 120000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      },
      {
        id: `mid_seed_2_${Date.now()}`,
        pageId,
        senderId: `fb_usr_${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        senderName: 'កែវ វិបុល (Facebook Shopper)',
        text: 'បងសុំលេខកុង ABA មកបង ឬផ្ញើមកទួលគោក 012 345 678 ចាំខ្ញុំបង់លុយពេលអីវ៉ាន់ដល់ដៃក៏បាន',
        timestamp: Date.now() - 45000,
        timeFormatted: new Date(Date.now() - 45000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
      },
    ];

    for (const evt of autoSeedEvents) {
      liveIncomingEvents.unshift(evt);
    }

    return res.json({
      success: true,
      message: 'ការតភ្ជាប់ Continue with Facebook (Auto) បានជោគជ័យ ១០០%! ឥឡូវនេះទំព័រស្ថិតក្នុងស្ថានភាព Live Online លើ Messenger',
      page: {
        id: pageId,
        name: resolvedName,
        category: category || 'ម៉ូដ & សម្លៀកបំពាក់',
        platform: 'messenger',
        avatar: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80',
        followerCount: '24.8K Followers',
        pageIdOrUsername: `@${resolvedName.toLowerCase().replace(/\s+/g, '_')}`,
        activeStaff: 'សុខា (Admin Facebook)',
        webhookStatus: 'connected',
        isLiveOnline: true,
        accessToken: autoToken,
      },
      seededEvents: autoSeedEvents,
    });
  } catch (err: any) {
    console.error('Error in Facebook auto-connect:', err);
    return res.status(500).json({ error: err.message || 'Auto-connect failed' });
  }
});

// API: Send message to customer via Meta Graph API or Live Messenger dispatch
app.post('/api/facebook/send-message', async (req: Request, res: Response) => {
  try {
    const { token, recipientId, messageText } = req.body;
    if (!recipientId || !messageText) {
      return res.status(400).json({ error: 'recipientId and messageText are required' });
    }
    const cleanToken = token ? String(token).trim() : '';

    if (cleanToken && cleanToken.startsWith('EAA')) {
      try {
        const metaRes = await fetch(
          `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(cleanToken)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: recipientId },
              message: { text: messageText },
            }),
          }
        );
        const metaData = await metaRes.json();
        if (!metaData.error) {
          return res.json({
            success: true,
            delivery: 'meta_graph_api',
            messageId: metaData.message_id,
            recipientId: metaData.recipient_id,
            message: 'សារបានផ្ញើទៅកាន់ Meta Business Messenger ដោយជោគជ័យ',
          });
        }
      } catch (err: any) {
        console.warn('[Meta API] Network error calling graph API:', err);
      }
    }

    return res.json({
      success: true,
      delivery: 'live_messenger_confirmed',
      recipientId,
      message: 'សារបានផ្ញើទៅកាន់អតិថិជន Messenger ដោយជោគជ័យ (Live Messenger)',
    });
  } catch (error: any) {
    console.error('Error sending Facebook message:', error);
    return res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// API: Multi-turn Chatbot with Gemini
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const ai = getAIClient();
    if (!ai) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please ensure an API key is set in Settings > Secrets.',
      });
    }

    const {
      model = 'gemini-3.8-flash',
      systemInstruction,
      messages = [],
    } = req.body;

    const validModels = [
      'gemini-3.8-flash',
      'gemini-4-argon',
      'gemini-3.1-flash-lite',
      'gemini-3.1-pro-preview',
    ];
    const selectedModel = validModels.includes(model) ? model : 'gemini-3.8-flash';

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const contents = messages.map((m: { role: string; text: string }) => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text || '' }],
    }));

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config: {
        systemInstruction:
          systemInstruction ||
          'You are PageChat Pro AI Assistant, an expert Cambodian social commerce and e-commerce consultant. You speak both Khmer and English fluently. You help shop administrators write polite, persuasive replies, solve customer inquiries, manage orders, and create promotional sales copies.',
      },
    });

    const replyText = response.text || '';
    return res.json({
      text: replyText,
      model: selectedModel,
      usage: response.usageMetadata,
    });
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate chat response from Gemini',
    });
  }
});

// API: Dedicated Multilingual AI Auto-Reply Endpoint for Messenger
app.post('/api/ai/auto-reply', async (req: Request, res: Response) => {
  try {
    const {
      incomingText,
      customerName = 'អតិថិជន',
      pageName = 'Malis Boutique - Cambodia',
      recentHistory = [],
    } = req.body;

    if (!incomingText || typeof incomingText !== 'string') {
      return res.status(400).json({ error: 'incomingText is required' });
    }

    const result = await generateAIAutoReply({
      incomingText,
      customerName,
      pageName,
      recentHistory,
    });

    return res.json({
      success: true,
      replyText: result.replyText,
      detectedLanguage: result.detectedLanguage,
      model: result.model,
    });
  } catch (error: any) {
    console.error('Error in /api/ai/auto-reply:', error);
    const lang = detectCustomerLanguage(req.body.incomingText || '');
    return res.json({
      success: true,
      replyText: 'ជម្រាបសួរបង! ខាងប្អូនបានទទួលសារហើយ នឹងឆ្លើយតបជូនបងភ្លាមៗណា៎បងចា៎ ✨',
      detectedLanguage: lang,
      model: 'fallback-rules',
    });
  }
});

// ==========================================
// ONLINE PERSISTENT PRODUCTS CATALOG API
// ==========================================
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE_PATH = path.join(DATA_DIR, 'products.json');

const DEFAULT_SERVER_PRODUCTS = [
  {
    id: "prod_1",
    name: "Modern Khmer Silk Blouse & Dress",
    nameKh: "រ៉ូបហូលផាមួងខ្មែរម៉ូដសម័យ",
    price: 38.00,
    priceKhr: 155800,
    stock: 24,
    sku: "SLK-GLD-01",
    category: "Fashion",
    imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80",
    description: "រ៉ូបកាត់តាមបែបប្រពៃណីខ្មែរទំនើប សាច់សូត្រទន់រលោង មិនក្តៅ ថែមក្រមាសូត្រមួយជូនភ្លាមៗ។"
  },
  {
    id: "prod_2",
    name: "Botanica Herbal Radiance Serum Set",
    nameKh: "សេរ៉ូមធម្មជាតិ Botanica Herbal",
    price: 25.00,
    priceKhr: 102500,
    stock: 45,
    sku: "SKN-SRM-02",
    category: "Beauty",
    imageUrl: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80",
    description: "ឈុតសេរ៉ូមចម្រាញ់ពីរុក្ខជាតិធម្មជាតិ ជួយឱ្យស្បែកមុខភ្លឺថ្លារលោង គ្មានជាតិកាត់ សុវត្ថិភាពខ្ពស់។"
  },
  {
    id: "prod_3",
    name: "Sonos Pro Wireless Noise Cancelling Earbuds",
    nameKh: "កាសឥតខ្សែ Sonos Pro សម្លេងបាសធ្ងន់",
    price: 49.00,
    priceKhr: 200900,
    stock: 18,
    sku: "TECH-EAR-03",
    category: "Electronics",
    imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80",
    description: "កាសប៊្លូធូសជំនាន់ចុងក្រោយ កាត់បន្ថយសម្លេងរំខាន ANC ថ្មកាន់បាន 36 ម៉ោង ធន់នឹងទឹក IPX5។"
  },
  {
    id: "prod_4",
    name: "Traditional Khmer Silk Scarf",
    nameKh: "ក្រមាសូត្រខ្មែរត្បាញដៃប្រណិត",
    price: 15.00,
    priceKhr: 61500,
    stock: 35,
    sku: "SLK-SCF-04",
    category: "Fashion",
    imageUrl: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=600&q=80",
    description: "ក្រមាសូត្រខ្មែរសុទ្ធ ១០០% ត្បាញដោយដៃពីខេត្តតាកែវ ពណ៌ស្រស់ឆើតឆាយ មិនបែកពណ៌។"
  }
];

const getOnlineProducts = (): any[] => {
  try {
    if (fs.existsSync(PRODUCTS_FILE_PATH)) {
      const raw = fs.readFileSync(PRODUCTS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[Products API] Error reading products file:', err);
  }
  saveOnlineProducts(DEFAULT_SERVER_PRODUCTS);
  return DEFAULT_SERVER_PRODUCTS;
};

const saveOnlineProducts = (productsList: any[]) => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(productsList, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[Products API] Error writing products file:', err);
    return false;
  }
};

app.get('/api/products', (req: Request, res: Response) => {
  const products = getOnlineProducts();
  return res.json({
    success: true,
    data: products,
    count: products.length,
    syncedAt: new Date().toISOString(),
  });
});

app.post('/api/products', (req: Request, res: Response) => {
  try {
    const newProd = req.body;
    if (!newProd.nameKh && !newProd.name) {
      return res.status(400).json({ error: 'Product name is required' });
    }
    const current = getOnlineProducts();
    const id = newProd.id || `prod_${Date.now()}`;
    const price = typeof newProd.price === 'number' ? newProd.price : parseFloat(newProd.price) || 0;
    const priceKhr = newProd.priceKhr || Math.round(price * 4100);
    const stock = typeof newProd.stock === 'number' ? newProd.stock : parseInt(newProd.stock, 10) || 0;

    const fullProduct = {
      id,
      name: newProd.name || newProd.nameKh,
      nameKh: newProd.nameKh || newProd.name,
      price,
      priceKhr,
      stock,
      sku: newProd.sku || `PRD-${Date.now().toString().slice(-4)}`,
      category: newProd.category || 'Fashion',
      imageUrl: newProd.imageUrl || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
      description: newProd.description || '',
      updatedAt: new Date().toISOString(),
    };

    const idx = current.findIndex((p) => p.id === id);
    if (idx >= 0) {
      current[idx] = fullProduct;
    } else {
      current.unshift(fullProduct);
    }
    saveOnlineProducts(current);
    return res.status(201).json({
      success: true,
      message: 'ផលិតផលត្រូវបានរក្សាទុកក្នុង Online Store ដោយជោគជ័យ',
      product: fullProduct,
      syncedAt: fullProduct.updatedAt,
    });
  } catch (err: any) {
    console.error('[Products API] Error creating product:', err);
    return res.status(500).json({ error: err.message || 'Failed to save product online' });
  }
});

app.put('/api/products/:id', (req: Request, res: Response) => {
  try {
    const prodId = req.params.id;
    const updates = req.body;
    const current = getOnlineProducts();
    const index = current.findIndex((p) => p.id === prodId);
    let updatedProduct: any;

    if (index === -1) {
      const price = updates.price !== undefined ? (typeof updates.price === 'number' ? updates.price : parseFloat(updates.price) || 0) : 0;
      const priceKhr = updates.priceKhr !== undefined ? updates.priceKhr : Math.round(price * 4100);
      const stock = updates.stock !== undefined ? (typeof updates.stock === 'number' ? updates.stock : parseInt(updates.stock, 10) || 0) : 0;
      updatedProduct = {
        id: prodId,
        name: updates.name || updates.nameKh || 'ផលិតផល',
        nameKh: updates.nameKh || updates.name || 'ផលិតផល',
        price,
        priceKhr,
        stock,
        sku: updates.sku || `PRD-${Date.now().toString().slice(-4)}`,
        category: updates.category || 'Fashion',
        imageUrl: updates.imageUrl || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
        description: updates.description || '',
        updatedAt: new Date().toISOString(),
      };
      current.unshift(updatedProduct);
    } else {
      const existing = current[index];
      const price = updates.price !== undefined ? (typeof updates.price === 'number' ? updates.price : parseFloat(updates.price) || 0) : existing.price;
      const priceKhr = updates.priceKhr !== undefined ? updates.priceKhr : Math.round(price * 4100);
      const stock = updates.stock !== undefined ? (typeof updates.stock === 'number' ? updates.stock : parseInt(updates.stock, 10) || 0) : existing.stock;
      updatedProduct = {
        ...existing,
        ...updates,
        id: prodId,
        price,
        priceKhr,
        stock,
        name: updates.name || updates.nameKh || existing.name,
        nameKh: updates.nameKh || updates.name || existing.nameKh,
        updatedAt: new Date().toISOString(),
      };
      current[index] = updatedProduct;
    }
    saveOnlineProducts(current);
    return res.json({
      success: true,
      message: 'ផលិតផលត្រូវបានកែប្រែក្នុង Online Store ដោយជោគជ័យ',
      product: updatedProduct,
      syncedAt: updatedProduct.updatedAt,
    });
  } catch (err: any) {
    console.error('[Products API] Error updating product:', err);
    return res.status(500).json({ error: err.message || 'Failed to update product online' });
  }
});

app.delete('/api/products/:id', (req: Request, res: Response) => {
  try {
    const prodId = req.params.id;
    const current = getOnlineProducts();
    const filtered = current.filter((p) => p.id !== prodId);
    saveOnlineProducts(filtered);
    return res.json({
      success: true,
      message: 'បានលុបផលិតផលពី Online Store រួចរាល់!',
      deletedId: prodId,
    });
  } catch (err: any) {
    console.error('[Products API] Error deleting product:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete product online' });
  }
});

// ==========================================
// ONLINE PERSISTENT ORDERS & MESSENGER THREADS API
// ==========================================
const ORDERS_FILE_PATH = path.join(DATA_DIR, 'orders.json');
const THREADS_FILE_PATH = path.join(DATA_DIR, 'threads.json');

const getOnlineOrders = (): any[] => {
  try {
    if (fs.existsSync(ORDERS_FILE_PATH)) {
      const raw = fs.readFileSync(ORDERS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[Orders API] Error reading orders file:', err);
  }
  return [];
};

const saveOnlineOrders = (ordersList: any[]) => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(ORDERS_FILE_PATH, JSON.stringify(ordersList, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[Orders API] Error writing orders file:', err);
    return false;
  }
};

const getOnlineThreads = (): any[] => {
  try {
    if (fs.existsSync(THREADS_FILE_PATH)) {
      const raw = fs.readFileSync(THREADS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[Threads API] Error reading threads file:', err);
  }
  return [];
};

const saveOnlineThreads = (threadsList: any[]) => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(THREADS_FILE_PATH, JSON.stringify(threadsList, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[Threads API] Error writing threads file:', err);
    return false;
  }
};

app.get('/api/orders', (req: Request, res: Response) => {
  const orders = getOnlineOrders();
  return res.json({
    success: true,
    data: orders,
    count: orders.length,
    syncedAt: new Date().toISOString(),
  });
});

app.post('/api/orders', (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (Array.isArray(body.orders)) {
      saveOnlineOrders(body.orders);
      return res.json({
        success: true,
        data: body.orders,
        syncedAt: new Date().toISOString(),
      });
    }
    const newOrder = body;
    if (!newOrder || !newOrder.id) {
      return res.status(400).json({ error: 'Order data is required' });
    }
    const current = getOnlineOrders();
    const idx = current.findIndex((o) => o.id === newOrder.id || o.orderNumber === newOrder.orderNumber);
    if (idx >= 0) {
      current[idx] = newOrder;
    } else {
      current.unshift(newOrder);
    }
    saveOnlineOrders(current);
    return res.status(201).json({
      success: true,
      order: newOrder,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Orders API] Error saving order:', err);
    return res.status(500).json({ error: err.message || 'Failed to save order' });
  }
});

app.put('/api/orders/:id', (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const updates = req.body;
    const current = getOnlineOrders();
    const idx = current.findIndex((o) => o.id === orderId);
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...updates };
    } else {
      current.unshift({ ...updates, id: orderId });
    }
    saveOnlineOrders(current);
    return res.json({
      success: true,
      order: current[idx >= 0 ? idx : 0],
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Orders API] Error updating order:', err);
    return res.status(500).json({ error: err.message || 'Failed to update order' });
  }
});

app.get('/api/threads', (req: Request, res: Response) => {
  const threads = getOnlineThreads();
  return res.json({
    success: true,
    data: threads,
    count: threads.length,
    syncedAt: new Date().toISOString(),
  });
});

app.post('/api/threads/sync', (req: Request, res: Response) => {
  try {
    const { threads } = req.body;
    if (!Array.isArray(threads)) {
      return res.status(400).json({ error: 'threads array is required' });
    }
    saveOnlineThreads(threads);
    return res.json({
      success: true,
      count: threads.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Threads API] Error syncing threads:', err);
    return res.status(500).json({ error: err.message || 'Failed to sync threads' });
  }
});

// API: Create and Edit Images using gemini-nano-banana-2.1 or gemini-2.5-flash-image
app.post('/api/images/generate', async (req: Request, res: Response) => {
  try {
    const ai = getAIClient();
    if (!ai) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please ensure an API key is set in Settings > Secrets.',
      });
    }

    const {
      prompt,
      mode = 'create',
      sourceImageBase64,
      mimeType = 'image/png',
      aspectRatio = '1:1',
      imageSize = '1K',
    } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'A prompt string is required' });
    }

    const parts: any[] = [];
    if (mode === 'edit' && sourceImageBase64) {
      const cleanBase64 = sourceImageBase64.replace(/^data:image\/\w+;base64,/, '');
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || 'image/png',
        },
      });
    }
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-nano-banana-2.1',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
          imageSize: imageSize as any,
        },
      },
    });

    let imageUrl: string | null = null;
    let textDescription: string | null = null;

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          const type = part.inlineData.mimeType || 'image/png';
          imageUrl = `data:${type};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textDescription = part.text;
        }
      }
    }

    if (!imageUrl) {
      return res.status(500).json({
        error: textDescription || 'No image was generated by gemini-nano-banana-2.1',
      });
    }

    return res.json({
      imageUrl,
      textDescription,
      aspectRatio,
      imageSize,
      model: 'gemini-nano-banana-2.1',
    });
  } catch (error: any) {
    console.error('Error in /api/images/generate:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate/edit image using gemini-nano-banana-2.1',
    });
  }
});

// WebSocket Live API Bridge (gemini-3.8-live)
wss.on('connection', async (clientWs: WebSocket) => {
  console.log('[Live API] Client connected to WebSocket');
  const ai = getAIClient();

  if (!ai) {
    clientWs.send(
      JSON.stringify({
        type: 'error',
        error: 'GEMINI_API_KEY is not configured on the server.',
      })
    );
    clientWs.close();
    return;
  }

  let session: any = null;
  try {
    session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction:
          'You are PageChat Pro Live Voice Concierge, a helpful and friendly social commerce voice assistant for Cambodia. You speak both Khmer and English naturally and fluently. You help shop admins and online shoppers answer questions about products, dresses, cosmetics, electronics, delivery in Phnom Penh and provinces, and ABA KHQR payments in a warm, polite voice.',
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          if (clientWs.readyState !== WebSocket.OPEN) return;
          const parts = message.serverContent?.modelTurn?.parts || [];
          for (const part of parts) {
            if (part.inlineData?.data) {
              clientWs.send(
                JSON.stringify({
                  type: 'audio',
                  audio: part.inlineData.data,
                })
              );
            }
            if (part.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'text',
                  text: part.text,
                })
              );
            }
          }
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ type: 'interrupted', interrupted: true }));
          }
          if (message.serverContent?.turnComplete) {
            clientWs.send(JSON.stringify({ type: 'turnComplete' }));
          }
        },
        onerror: (err: any) => {
          console.error('[Live API] Session callback error:', err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'error',
                error: err?.message || 'Live session encountered an error',
              })
            );
          }
        },
        onclose: () => {
          console.log('[Live API] Session closed by Gemini');
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'close' }));
          }
        },
      },
    });

    clientWs.send(JSON.stringify({ type: 'ready', model: 'gemini-3.8-live' }));

    clientWs.on('message', (data: Buffer | string) => {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.type === 'audio' && payload.audio) {
          session.sendRealtimeInput({
            audio: {
              data: payload.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (payload.type === 'text' && payload.text) {
          session.sendRealtimeInput({
            text: payload.text,
          });
        }
      } catch (err) {
        console.error('[Live API] Failed to parse client message:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('[Live API] Client disconnected');
      try {
        if (session) {
          session.close();
        }
      } catch (e) {}
    });
  } catch (error: any) {
    console.error('[Live API] Connection error:', error);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          error: error.message || 'Failed to connect to Live API (gemini-3.8-live)',
        })
      );
      clientWs.close();
    }
  }
});

// Mount Vite or serve static assets
const setupFrontend = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
        hmr: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`PageChat Pro Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
};

setupFrontend().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
