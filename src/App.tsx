import React, { useState, useEffect, useRef } from 'react';
import { Sidebar, ActiveViewType } from './components/Sidebar';
import { ConversationList } from './components/ConversationList';
import { ChatWindow } from './components/ChatWindow';
import { CustomerPanel } from './components/CustomerPanel';
import { OrderModal } from './components/OrderModal';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { QuickRepliesView } from './components/QuickRepliesView';
import { OrdersListView } from './components/OrdersListView';
import { ProductsCatalogView } from './components/ProductsCatalogView';
import { AnalyticsView } from './components/AnalyticsView';
import { GeminiChatbotView } from './components/GeminiChatbotView';
import { VoiceLiveView } from './components/VoiceLiveView';
import { ImageStudioView } from './components/ImageStudioView';
import { ConnectPageModal } from './components/ConnectPageModal';
import { PagesManagementView } from './components/PagesManagementView';
import { FacebookLiveModal } from './components/FacebookLiveModal';
import { GoogleDriveView } from './components/GoogleDriveView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileAppView } from './components/MobileAppView';
import { useOnlineStatus } from './hooks/usePWAInstall';
import {
  saveToDesktopIndexedDB,
  loadFromDesktopIndexedDB,
  exportDesktopDatabaseFile,
} from './utils/offlineDb';
import { Menu, WifiOff, Edit3, Save, Smartphone, User, X } from 'lucide-react';
import { 
  INITIAL_PAGES, 
  INITIAL_PRODUCTS, 
  INITIAL_QUICK_REPLIES, 
  INITIAL_AUTO_REPLIES, 
  INITIAL_ORDERS, 
  INITIAL_THREADS 
} from './data/initialData';
import { 
  PageAccount, 
  ChatThread, 
  ProductItem, 
  QuickReplyTemplate, 
  AutoReplyRule, 
  Order, 
  Customer,
  ChatMessage
} from './types';
import { soundNotifier } from './utils/audio';

export default function App() {
  const [pages, setPages] = useState<PageAccount[]>(() => {
    try {
      const saved = localStorage.getItem('pagechat_pro_pages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load saved pages', e);
    }
    return INITIAL_PAGES;
  });

  const [selectedPage, setSelectedPage] = useState<PageAccount>(() => {
    try {
      const saved = localStorage.getItem('pagechat_pro_pages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_PAGES[0];
  });

  const [threads, setThreads] = useState<ChatThread[]>(() => {
    try {
      const saved = localStorage.getItem('pagechat_threads');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_THREADS;
  });

  const [selectedThreadId, setSelectedThreadId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem('pagechat_selected_thread_id');
      if (savedId) return savedId;
    } catch {}
    return 'th_1';
  });

  const [products, setProducts] = useState<ProductItem[]>(() => {
    try {
      const saved = localStorage.getItem('pagechat_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_PRODUCTS;
  });

  const [isProductsSyncing, setIsProductsSyncing] = useState(false);

  const [quickReplies, setQuickReplies] = useState<QuickReplyTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('pagechat_quick_replies');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_QUICK_REPLIES;
  });

  const [autoReplies, setAutoReplies] = useState<AutoReplyRule[]>(() => {
    try {
      const saved = localStorage.getItem('pagechat_auto_replies');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_AUTO_REPLIES;
  });

  const [isQuickRepliesSyncing, setIsQuickRepliesSyncing] = useState(false);

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('pagechat_orders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_ORDERS;
  });

  const [activeView, setActiveView] = useState<ActiveViewType>('inbox');
  const [language, setLanguage] = useState<'kh' | 'en'>('kh');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [activeInvoiceOrderId, setActiveInvoiceOrderId] = useState<string | null>(null);
  const [isInvoiceEditMode, setIsInvoiceEditMode] = useState<boolean>(false);
  const [isConnectPageModalOpen, setIsConnectPageModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<PageAccount | null>(null);
  const [isFacebookLiveModalOpen, setIsFacebookLiveModalOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isGlobalMobileFrame, setIsGlobalMobileFrame] = useState(false);
  const [isMobileCustomerSheetOpen, setIsMobileCustomerSheetOpen] = useState(false);

  const [isAutoPilot, setIsAutoPilot] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('pagechat_autopilot');
      if (stored !== null) return stored === 'true';
      return true; // Default enabled for automatic Gemini AI response
    } catch {
      return true;
    }
  });

  const isAutoPilotRef = useRef(isAutoPilot);
  const lastPolledTimeRef = useRef<number>(Date.now() - 3600000);

  useEffect(() => {
    isAutoPilotRef.current = isAutoPilot;
    try {
      localStorage.setItem('pagechat_autopilot', String(isAutoPilot));
    } catch (e) {
      // ignore
    }
  }, [isAutoPilot]);

  const handleToggleAutoPilot = () => {
    setIsAutoPilot((prev) => !prev);
  };

  const { isOnline, forceOfflineDesktopMode, toggleForceOfflineMode } = useOnlineStatus();
  const isOnlineRef = useRef(isOnline);
  const [pendingOfflineEditsCount, setPendingOfflineEditsCount] = useState<number>(0);
  const [lastSavedTime, setLastSavedTime] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  const markLocalComputerSave = () => {
    setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    if (!isOnlineRef.current) {
      setPendingOfflineEditsCount((c) => c + 1);
    }
  };

  // Helper to safely persist threads to IndexedDB, localStorage, and backend server
  const persistThreadsToStorageAndServer = (nextThreads: ChatThread[]) => {
    saveToDesktopIndexedDB('pagechat_threads', nextThreads);
    markLocalComputerSave();

    try {
      localStorage.setItem('pagechat_threads', JSON.stringify(nextThreads));
    } catch (quotaErr) {
      try {
        const lightweight = nextThreads.map((t) => ({
          ...t,
          messages: t.messages.map((m) => ({
            ...m,
            attachments: m.attachments?.map((att) => {
              if (att.type === 'image' && att.data?.url && att.data.url.length > 180000) {
                return att;
              }
              return att;
            }),
          })),
        }));
        localStorage.setItem('pagechat_threads', JSON.stringify(lightweight));
      } catch {}
    }

    if (isOnlineRef.current) {
      fetch('/api/threads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threads: nextThreads }),
      }).catch(() => {});
    }
  };

  // Sync all computer offline data back to server when connection returns or manual Sync is clicked
  const handleSyncOfflineDataNow = async () => {
    await Promise.all([
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      }).catch(() => null),
      fetch('/api/threads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threads }),
      }).catch(() => null),
    ]);
    setPendingOfflineEditsCount(0);
    setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  };

  useEffect(() => {
    if (isOnline && pendingOfflineEditsCount > 0) {
      handleSyncOfflineDataNow();
    }
  }, [isOnline]);

  // Persist pages, orders, products, quickReplies, threads, and selectedThreadId to IndexedDB & localStorage
  useEffect(() => {
    saveToDesktopIndexedDB('pagechat_pro_pages', pages);
    try {
      localStorage.setItem('pagechat_pro_pages', JSON.stringify(pages));
    } catch {}
  }, [pages]);

  useEffect(() => {
    saveToDesktopIndexedDB('pagechat_products', products);
  }, [products]);

  useEffect(() => {
    saveToDesktopIndexedDB('pagechat_quick_replies', quickReplies);
  }, [quickReplies]);

  useEffect(() => {
    saveToDesktopIndexedDB('pagechat_auto_replies', autoReplies);
  }, [autoReplies]);

  useEffect(() => {
    try {
      localStorage.setItem('pagechat_selected_thread_id', selectedThreadId);
    } catch {}
  }, [selectedThreadId]);

  useEffect(() => {
    saveToDesktopIndexedDB('pagechat_orders', orders);
    markLocalComputerSave();
    try {
      localStorage.setItem('pagechat_orders', JSON.stringify(orders));
    } catch {}
    if (isOnlineRef.current) {
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      }).catch(() => {});
    }
  }, [orders]);

  useEffect(() => {
    persistThreadsToStorageAndServer(threads);
  }, [threads]);

  // Load any rich data saved in Computer IndexedDB first (works 100% offline)
  useEffect(() => {
    let isMounted = true;
    const loadIndexedDbState = async () => {
      const [idbThreads, idbOrders, idbProducts, idbPages] = await Promise.all([
        loadFromDesktopIndexedDB<ChatThread[]>('pagechat_threads'),
        loadFromDesktopIndexedDB<Order[]>('pagechat_orders'),
        loadFromDesktopIndexedDB<ProductItem[]>('pagechat_products'),
        loadFromDesktopIndexedDB<PageAccount[]>('pagechat_pro_pages'),
      ]);
      if (!isMounted) return;
      if (Array.isArray(idbThreads) && idbThreads.length > 0) {
        setThreads(idbThreads);
      }
      if (Array.isArray(idbOrders) && idbOrders.length > 0) {
        setOrders(idbOrders);
      }
      if (Array.isArray(idbProducts) && idbProducts.length > 0) {
        setProducts(idbProducts);
      }
      if (Array.isArray(idbPages) && idbPages.length > 0) {
        setPages(idbPages);
      }
    };
    loadIndexedDbState();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch persistent online products, orders, and threads from server on startup & reconcile order invoices in threads
  useEffect(() => {
    let isMounted = true;
    const fetchInitialOnlineData = async () => {
      try {
        setIsProductsSyncing(true);
        const [prodRes, ordRes, thRes] = await Promise.all([
          fetch('/api/products').catch(() => null),
          fetch('/api/orders').catch(() => null),
          fetch('/api/threads').catch(() => null),
        ]);

        if (prodRes && isMounted) {
          const prodJson = await prodRes.json();
          if (prodJson.success && Array.isArray(prodJson.data) && prodJson.data.length > 0) {
            setProducts(prodJson.data);
            try {
              localStorage.setItem('pagechat_products', JSON.stringify(prodJson.data));
            } catch {}
          }
        }

        let loadedOrders: Order[] | null = null;
        if (ordRes && isMounted) {
          const ordJson = await ordRes.json();
          if (ordJson.success && Array.isArray(ordJson.data) && ordJson.data.length > 0) {
            loadedOrders = ordJson.data;
            setOrders((prev) => {
              const mergedMap = new Map<string, Order>();
              [...ordJson.data, ...prev].forEach((o: Order) => {
                if (o && o.id && !mergedMap.has(o.id)) {
                  mergedMap.set(o.id, o);
                }
              });
              return Array.from(mergedMap.values());
            });
          }
        }

        if (thRes && isMounted) {
          const thJson = await thRes.json();
          if (thJson.success && Array.isArray(thJson.data) && thJson.data.length > 0) {
            setThreads((localThreads) => {
              const serverThreads: ChatThread[] = thJson.data;
              // Merge server threads and local threads so no messages, images, or order invoices are ever lost
              const threadMap = new Map<string, ChatThread>();
              serverThreads.forEach((st) => threadMap.set(st.id, st));
              localThreads.forEach((lt) => {
                const existing = threadMap.get(lt.id);
                if (!existing) {
                  threadMap.set(lt.id, lt);
                } else {
                  const msgMap = new Map<string, ChatMessage>();
                  existing.messages.forEach((m) => msgMap.set(m.id, m));
                  lt.messages.forEach((m) => {
                    if (!msgMap.has(m.id)) msgMap.set(m.id, m);
                  });
                  const combinedMessages = Array.from(msgMap.values());
                  const lastM = combinedMessages[combinedMessages.length - 1];
                  threadMap.set(lt.id, {
                    ...existing,
                    ...lt,
                    orderIds: Array.from(new Set([...(existing.orderIds || []), ...(lt.orderIds || [])])),
                    lastMessage: lastM ? lastM.text : existing.lastMessage,
                    messages: combinedMessages,
                  });
                }
              });
              return Array.from(threadMap.values());
            });
          }
        }

        // Reconcile: Ensure every order in orders has its order_invoice message inside its corresponding Messenger thread
        setThreads((currentThreads) => {
          const activeOrders = loadedOrders || orders;
          let changed = false;
          const reconciled: ChatThread[] = currentThreads.map((t) => {
            const matchingOrders = activeOrders.filter(
              (o) =>
                o.threadId === t.id ||
                o.customerName === t.customer.name ||
                (t.orderIds && t.orderIds.includes(o.id))
            );
            if (matchingOrders.length === 0) return t;

            let updatedMsgs = [...t.messages];
            let updatedOrderIds = [...(t.orderIds || [])];
            let threadModified = false;

            matchingOrders.forEach((ord) => {
              if (!updatedOrderIds.includes(ord.id)) {
                updatedOrderIds.push(ord.id);
                threadModified = true;
              }
              const hasInvoiceMsg = updatedMsgs.some((m) =>
                m.attachments?.some(
                  (att) =>
                    att.type === 'order_invoice' &&
                    (att.data?.id === ord.id || att.data?.orderNumber === ord.orderNumber)
                )
              );
              if (!hasInvoiceMsg) {
                const deliveryName =
                  ord.deliveryProvider === 'jt'
                    ? 'J&T Express'
                    : ord.deliveryProvider === 'virak_buntham'
                    ? 'វីរៈប៊ុនថាំ'
                    : 'ដឹកជញ្ជូនរហ័ស';
                const restoredMsg: ChatMessage = {
                  id: `msg_inv_${ord.id}`,
                  sender: 'admin',
                  senderName: 'សុខា',
                  text: `វិក្កយបត្របញ្ជាទិញ #${ord.orderNumber} សរុប: $${Number(ord.total).toFixed(2)} (${Number(ord.totalKhr || ord.total * 4100).toLocaleString()} រៀល) សេវាដឹក: ${deliveryName}`,
                  timestamp: ord.createdAt || 'ថ្មីៗនេះ',
                  attachments: [
                    {
                      type: 'order_invoice',
                      data: ord,
                    },
                  ],
                  isRead: true,
                  deliveryStatus: 'sent_meta',
                };
                updatedMsgs.push(restoredMsg);
                threadModified = true;
              }
            });

            if (threadModified) {
              changed = true;
              const lastM = updatedMsgs[updatedMsgs.length - 1];
              return {
                ...t,
                status: 'ordered' as const,
                orderIds: updatedOrderIds,
                lastMessage: lastM ? lastM.text : t.lastMessage,
                messages: updatedMsgs,
              };
            }
            return t;
          });

          return changed ? reconciled : currentThreads;
        });
      } catch (err) {
        console.warn('Could not fetch initial online data, using local store:', err);
      } finally {
        if (isMounted) setIsProductsSyncing(false);
      }
    };
    fetchInitialOnlineData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Ensure selectedPage is valid
  useEffect(() => {
    if (!pages.some((p) => p.id === selectedPage.id)) {
      if (pages.length > 0) {
        setSelectedPage(pages[0]);
      }
    }
  }, [pages, selectedPage]);

  // Sync real conversations from Meta Graph API while preserving local invoices & images
  const handleSyncRealConversations = async () => {
    if (!selectedPage.accessToken) return;
    try {
      const res = await fetch(`/api/facebook/conversations?token=${encodeURIComponent(selectedPage.accessToken)}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setThreads((prev) => {
          const newThreads: ChatThread[] = json.data.map((c: any) => {
            const senderObj = c.senders?.data?.[0] || { name: 'Facebook Customer', id: 'fb_cust' };
            const lastMsg = c.messages?.data?.[0];
            const isRealUser = Boolean(senderObj.id && senderObj.id !== selectedPage.id);
            const threadId = `fb_th_${c.id}`;
            const existingThread = prev.find(
              (pt) => pt.id === threadId || (senderObj.id && pt.customer.psid === senderObj.id)
            );

            const graphMessages: ChatMessage[] = (c.messages?.data || [])
              .map((m: any) => ({
                id: m.id,
                sender: (m.from?.id === selectedPage.id ? 'admin' : 'customer') as 'admin' | 'customer',
                senderName: m.from?.name || senderObj.name,
                text: m.message || '',
                timestamp: new Date(m.created_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                deliveryStatus: 'sent_meta' as const,
                isLiveMeta: true,
              }))
              .reverse();

            // Preserve any local rich messages (order_invoice, image, khqr_card, product) from existing thread
            const preservedRichMessages = (existingThread?.messages || []).filter(
              (em) =>
                (em.attachments && em.attachments.length > 0) ||
                !graphMessages.some((gm) => gm.id === em.id || (gm.text === em.text && gm.sender === em.sender))
            );

            const mergedMessages = [...graphMessages];
            preservedRichMessages.forEach((pm) => {
              if (!mergedMessages.some((m) => m.id === pm.id)) {
                mergedMessages.push(pm);
              }
            });

            const latestMsg = mergedMessages[mergedMessages.length - 1];

            return {
              id: existingThread?.id || threadId,
              pageId: selectedPage.id,
              customer: {
                id: senderObj.id || `fb_${c.id}`,
                psid: senderObj.id,
                name: senderObj.name || existingThread?.customer.name || 'Facebook Customer',
                avatarUrl:
                  existingThread?.customer.avatarUrl ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
                platform: 'messenger',
                phone: existingThread?.customer.phone || 'Facebook Messenger',
                province: existingThread?.customer.province || 'Facebook Live',
                address: existingThread?.customer.address || 'Meta Business Messenger',
                tags: existingThread?.customer.tags || ['Facebook Live', 'ភ្ញៀវ Meta'],
                totalOrders: existingThread?.customer.totalOrders || 0,
                totalSpent: existingThread?.customer.totalSpent || 0,
                notes: existingThread?.customer.notes || `Real Facebook Page conversation ID: ${c.id}`,
                createdAt: existingThread?.customer.createdAt || new Date().toISOString().split('T')[0],
                isRealFacebookUser: isRealUser,
              },
              unreadCount: c.unread_count || 0,
              status: existingThread?.status === 'ordered' ? 'ordered' : 'needs_reply',
              lastMessage: latestMsg?.text || lastMsg?.message || c.snippet || 'សារថ្មី',
              lastMessageTime: latestMsg?.timestamp || 'Live',
              orderIds: existingThread?.orderIds || [],
              messages: mergedMessages,
            };
          });

          const syncedIds = new Set(newThreads.map((nt) => nt.id));
          return [...newThreads, ...prev.filter((t) => !syncedIds.has(t.id))];
        });
        soundNotifier.playMessageChime();
      }
    } catch (e) {
      console.error('Error syncing Facebook conversations:', e);
    }
  };

  // Auto-Pilot automated responder powered by Gemini 3.8 Flash (Multilingual & Khmer First)
  const triggerAutoPilotResponse = async (targetThreadId: string, customerMessageText: string) => {
    let currentThread: ChatThread | undefined;
    setThreads((current) => {
      currentThread = current.find((t) => t.id === targetThreadId);
      return current;
    });

    const customerName = currentThread?.customer?.name || 'អតិថិជន';
    const recentHistory = (currentThread?.messages || []).slice(-4).map((m) => ({
      role: m.sender === 'customer' ? 'user' : 'model',
      text: m.text,
    }));

    let replyText = '';
    let detectedLang = { code: 'km', nameKh: 'ភាសាខ្មែរ', nameEn: 'Khmer' };

    try {
      const res = await fetch('/api/ai/auto-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incomingText: customerMessageText,
          customerName,
          pageName: selectedPage.name,
          recentHistory,
        }),
      });
      const data = await res.json();
      if (data && data.replyText) {
        replyText = data.replyText;
        if (data.detectedLanguage) detectedLang = data.detectedLanguage;
      }
    } catch (apiErr) {
      console.warn('Failed to call /api/ai/auto-reply, using smart client-side fallback:', apiErr);
    }

    if (!replyText) {
      const textLower = customerMessageText.toLowerCase();
      const matched = autoReplies.find(
        (rule) => rule.enabled && rule.triggerKeywords.some((kw) => textLower.includes(kw.toLowerCase()))
      );
      if (matched) {
        replyText = matched.responseKh;
      } else if (textLower.includes('price') || textLower.includes('how much') || textLower.includes('cost')) {
        replyText = `Hello ${customerName}! Thank you for contacting ${selectedPage.name} ✨ Our luxury dresses are $38.00 (promotional $34.00) and skincare is $24.50. Which item may we help you with?`;
        detectedLang = { code: 'en', nameKh: 'ភាសាអង់គ្លេស', nameEn: 'English' };
      } else if (textLower.includes('aba') || textLower.includes('khqr') || textLower.includes('កុង') || textLower.includes('លុយ') || textLower.includes('គណនី')) {
        replyText = 'បងអាចស្កេនទូទាត់តាម ABA / Bakong KHQR គណនីលេខ: 005 452 334 (Sok Chea CHHAI) ឬជ្រើសរើសបង់លុយពេលអីវ៉ាន់ដល់ដៃ (COD) ក៏បានបងចា៎! 💳';
      } else if (textLower.includes('ដឹក') || textLower.includes('ផ្ញើ') || textLower.includes('សេវា') || textLower.includes('delivery')) {
        replyText = 'សេវាដឹកជញ្ជូនភ្នំពេញ $1.50 (១ថ្ងៃដល់) តាមខេត្ត $2.00 (១-២ ថ្ងៃតាម J&T / វីរៈប៊ុនថាំ) បងចា៎! 🚚';
      } else if (textLower.includes('យក') || textLower.includes('កុម្ម៉ង់') || textLower.includes('ទិញ') || textLower.includes('order')) {
        replyText = `ចាស៎បង ${customerName}! សូមបងជួយផ្ញើ [លេខទូរស័ព្ទ] និង [ទីតាំងទទួល] មកប្អូនរៀបចំកញ្ចប់អីវ៉ាន់ជូនបងភ្លាមៗណា៎! 💕`;
      } else {
        replyText = `ជម្រាបសួរបង ${customerName}! សូមស្វាគមន៍មកកាន់ ${selectedPage.name} 🌸 អីវ៉ាន់មានក្នុងស្តុកស្រាប់ និងមានសេវាដឹកជូនទូទាំងប្រទេស! តើប្អូនអាចជួយបងលើផលិតផលណាដែរចា៎? ✨`;
      }
    }

    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
    const botMsgId = `bot_auto_${Date.now()}`;
    const botMsg: ChatMessage = {
      id: botMsgId,
      sender: 'bot',
      senderName: `ជំនួយការ AI Auto-Pilot (${detectedLang.nameKh})`,
      text: replyText,
      timestamp: timeStr,
      deliveryStatus: (selectedPage.isLiveOnline || selectedPage.accessToken) ? 'sending_meta' : 'sent_local',
      isLiveMeta: Boolean(selectedPage.isLiveOnline || selectedPage.accessToken),
    };

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === targetThreadId) {
          return {
            ...t,
            status: 'completed',
            lastMessage: replyText,
            lastMessageTime: timeStr,
            messages: [...t.messages, botMsg],
          };
        }
        return t;
      })
    );
    soundNotifier.playMessageChime();

    if (selectedPage.isLiveOnline || selectedPage.accessToken) {
      setThreads((current) => {
        const found = current.find((t) => t.id === targetThreadId);
        const recipientPsid = found?.customer?.psid || found?.customer?.id;
        if (recipientPsid) {
          fetch('/api/facebook/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: selectedPage.accessToken || 'demo_live_token',
              recipientId: recipientPsid,
              messageText: replyText,
            }),
          })
            .then((r) => r.json())
            .then(() => {
              setThreads((up) =>
                up.map((t) =>
                  t.id === targetThreadId
                    ? {
                        ...t,
                        messages: t.messages.map((m) =>
                          m.id === botMsgId ? { ...m, deliveryStatus: 'sent_meta' } : m
                        ),
                      }
                    : t
                )
              );
            })
            .catch((e) => console.warn('Meta send failed in auto-pilot', e));
        }
        return current;
      });
    }
  };

  // Live polling for incoming Meta Webhook events
  useEffect(() => {
    let isMounted = true;
    const pollInterval = setInterval(async () => {
      try {
        const since = lastPolledTimeRef.current;
        const res = await fetch(`/api/facebook/live-events?since=${since}&pageId=${encodeURIComponent(selectedPage.id)}`);
        const data = await res.json();
        if (!isMounted) return;

        if (data.success && Array.isArray(data.events) && data.events.length > 0) {
          lastPolledTimeRef.current = data.serverTime || Date.now();
          const autoReplyEvents: { threadId: string; text: string }[] = [];

          setThreads((prevThreads) => {
            let updated = [...prevThreads];
            for (const evt of data.events) {
              const isBotReply = Boolean(evt.isAiReply);
              const existingIndex = updated.findIndex(
                (t) => t.customer.id === evt.senderId || t.customer.psid === evt.senderId
              );

              const newMsg: ChatMessage = {
                id: evt.id,
                sender: isBotReply ? 'bot' : 'customer',
                senderName: evt.senderName,
                text: evt.text,
                timestamp: evt.timeFormatted,
                isRead: isBotReply,
                deliveryStatus: 'sent_meta',
                isLiveMeta: true,
              };

              if (existingIndex >= 0) {
                const target = updated[existingIndex];
                const alreadyHas = target.messages.some(
                  (m) => m.id === evt.id || (m.text === evt.text && m.sender === newMsg.sender)
                );
                if (!alreadyHas) {
                  updated[existingIndex] = {
                    ...target,
                    status: isBotReply ? 'completed' : 'needs_reply',
                    unreadCount: isBotReply ? target.unreadCount : target.unreadCount + 1,
                    lastMessage: evt.text,
                    lastMessageTime: evt.timeFormatted,
                    messages: [...target.messages, newMsg],
                  };

                  if (!isBotReply && isAutoPilotRef.current) {
                    const hasServerReply = data.events.some(
                      (other: any) => other.isAiReply && other.senderId === evt.senderId
                    );
                    if (!hasServerReply) {
                      autoReplyEvents.push({ threadId: target.id, text: evt.text });
                    }
                  }
                }
              } else {
                const newThreadId = `fb_th_${evt.senderId}`;
                const newThread: ChatThread = {
                  id: newThreadId,
                  pageId: selectedPage.id,
                  customer: {
                    id: evt.senderId,
                    psid: evt.senderId,
                    name: evt.senderName,
                    avatarUrl: evt.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
                    platform: 'messenger',
                    phone: 'Facebook Messenger',
                    province: 'Facebook Live',
                    address: 'Meta Business Messenger',
                    tags: ['Facebook Live', 'ភ្ញៀវ Meta'],
                    totalOrders: 0,
                    totalSpent: 0,
                    notes: `Real Meta Facebook user PSID: ${evt.senderId}`,
                    createdAt: new Date().toISOString().split('T')[0],
                    isRealFacebookUser: true,
                  },
                  unreadCount: isBotReply ? 0 : 1,
                  status: isBotReply ? 'completed' : 'needs_reply',
                  lastMessage: evt.text,
                  lastMessageTime: evt.timeFormatted,
                  orderIds: [],
                  messages: [newMsg],
                };
                updated.unshift(newThread);

                if (!isBotReply && isAutoPilotRef.current) {
                  const hasServerReply = data.events.some(
                    (other: any) => other.isAiReply && other.senderId === evt.senderId
                  );
                  if (!hasServerReply) {
                    autoReplyEvents.push({ threadId: newThreadId, text: evt.text });
                  }
                }
              }
            }
            return updated;
          });

          soundNotifier.playMessageChime();

          if (isAutoPilotRef.current && autoReplyEvents.length > 0) {
            autoReplyEvents.forEach((item) => {
              setTimeout(() => {
                triggerAutoPilotResponse(item.threadId, item.text);
              }, 1200);
            });
          }
        }
      } catch (err) {
        // silent polling error
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [selectedPage.id]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId) || threads[0];

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    setIsMobileChatOpen(true);
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, unreadCount: 0 } : t
      )
    );
  };

  const handleSendMessage = async (text: string, attachments?: any[]) => {
    if (!selectedThread) return;
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
    const msgId = `msg_${Date.now()}`;

    const newMsg: ChatMessage = {
      id: msgId,
      sender: 'admin',
      senderName: selectedPage.activeStaff,
      text,
      timestamp: timeStr,
      attachments,
      isRead: true,
      deliveryStatus: (selectedPage.isLiveOnline || selectedPage.accessToken) ? 'sending_meta' : 'sent_local',
      isLiveMeta: Boolean(selectedPage.isLiveOnline || selectedPage.accessToken),
    };

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === selectedThread.id) {
          return {
            ...t,
            lastMessage: text,
            lastMessageTime: timeStr,
            status: 'completed',
            messages: [...t.messages, newMsg],
          };
        }
        return t;
      })
    );
    soundNotifier.playMessageChime();

    if ((selectedPage.isLiveOnline || selectedPage.accessToken) && selectedThread.customer.platform === 'messenger') {
      try {
        const recipientPsid = selectedThread.customer.psid || selectedThread.customer.id;
        const res = await fetch('/api/facebook/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: selectedPage.accessToken || 'demo_live_token',
            recipientId: recipientPsid,
            messageText: text,
          }),
        });
        const data = await res.json();
        setThreads((prev) =>
          prev.map((t) => {
            if (t.id === selectedThread.id) {
              return {
                ...t,
                messages: t.messages.map((m) => {
                  if (m.id === msgId) {
                    if (data.success) {
                      return { ...m, deliveryStatus: 'sent_meta' };
                    } else {
                      return { ...m, deliveryStatus: 'failed_meta', metaError: data.error || 'Failed to deliver to Meta' };
                    }
                  }
                  return m;
                }),
              };
            }
            return t;
          })
        );
      } catch (err: any) {
        console.error('Meta send message error:', err);
      }
    }
  };

  const handleEditMessage = (threadId: string, messageId: string, newText: string) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === threadId) {
          const updatedMessages = t.messages.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  text: newText,
                  isEdited: true,
                  editedAt: 'កែប្រែរួច',
                }
              : m
          );
          const lastMsg = updatedMessages[updatedMessages.length - 1];
          return {
            ...t,
            lastMessage: lastMsg ? lastMsg.text : t.lastMessage,
            messages: updatedMessages,
          };
        }
        return t;
      })
    );
  };

  const handleSimulateCustomerChat = () => {
    const customerPrompts = [
      {
        name: 'គឹម ស្រីពៅ',
        province: 'សៀមរាប',
        phone: '088 911 223',
        text: 'ជំរាបសួរបង! រ៉ូបហូលពណ៌ផ្កាឈូកមាន Size L ដែរទេបង?',
      },
      {
        name: 'សួស ចាន់ថន',
        province: 'ភ្នំពេញ',
        phone: '015 678 901',
        text: 'បងចង់សួរថាកាស Sonos Pro នេះបើកុម្ម៉ង់ឥឡូវ អាចដឹក Grab មកទួលគោកបានទេ?',
      },
      {
        name: 'ហេង គន្ធា',
        province: 'កំពង់ចាម',
        phone: '097 334 556',
        text: 'បងសុំលេខកុង ABA មកប្អូនវេលុយទិញសេរ៉ូម Botanica មួយឈុត',
      },
    ];

    const randomPick = customerPrompts[Math.floor(Math.random() * customerPrompts.length)];
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
    const newThreadId = `th_${Date.now()}`;

    const newCustomer: Customer = {
      id: `cust_${Date.now()}`,
      name: randomPick.name,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      platform: 'messenger',
      phone: randomPick.phone,
      province: randomPick.province,
      address: `ក្រុង${randomPick.province}`,
      tags: ['ភ្ញៀវថ្មី'],
      totalOrders: 0,
      totalSpent: 0,
      notes: 'ភ្ញៀវថ្មីសួរតាមឆាត',
      createdAt: '2026-04-13',
    };

    const newChatMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'customer',
      senderName: randomPick.name,
      text: randomPick.text,
      timestamp: timeStr,
    };

    const newThread: ChatThread = {
      id: newThreadId,
      pageId: selectedPage.id,
      customer: newCustomer,
      unreadCount: 1,
      status: 'needs_reply',
      lastMessage: randomPick.text,
      lastMessageTime: timeStr,
      orderIds: [],
      messages: [newChatMessage],
    };

    setThreads([newThread, ...threads]);
    setSelectedThreadId(newThreadId);
    soundNotifier.playMessageChime();

    if (isAutoPilotRef.current) {
      setTimeout(() => {
        triggerAutoPilotResponse(newThreadId, randomPick.text);
      }, 1200);
    }
  };

  const handleSimulateCustomerReply = (threadId: string, replyText?: string) => {
    const defaultReplies = [
      'ចាស៎បង តម្លៃសមរម្យណាស់ ខ្ញុំសម្រេចយកមួយហើយបង!',
      'ផ្ញើតាមឡាន J&T មកផ្ទះលេខ 45B ផ្លូវ 315 លេខទូរស័ព្ទ 012 889 977 ណា៎បង',
      'ខ្ញុំបានស្កេនទូទាត់តាម KHQR រួចរាល់ហើយបង សូមជួយពិនិត្យផង',
      'អរគុណបងច្រើនណាស់!'
    ];
    const text = replyText || defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'customer',
      senderName: selectedThread.customer.name,
      text,
      timestamp: timeStr,
    };

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === threadId) {
          return {
            ...t,
            lastMessage: text,
            lastMessageTime: timeStr,
            status: 'needs_reply',
            messages: [...t.messages, newMsg],
          };
        }
        return t;
      })
    );
    soundNotifier.playMessageChime();

    if (isAutoPilotRef.current) {
      setTimeout(() => {
        triggerAutoPilotResponse(threadId, text);
      }, 1200);
    }
  };

  const handleUpdateCustomer = (updated: Partial<Customer>) => {
    if (!selectedThread) return;
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === selectedThread.id) {
          return {
            ...t,
            customer: {
              ...t.customer,
              ...updated,
            },
          };
        }
        return t;
      })
    );
  };

  const handleSaveOrder = async (newOrder: Order) => {
    const updatedOrders = [newOrder, ...orders];
    setOrders(updatedOrders);
    soundNotifier.playOrderSuccess();

    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
    const deliveryName =
      newOrder.deliveryProvider === 'jt'
        ? 'J&T Express'
        : newOrder.deliveryProvider === 'virak_buntham'
        ? 'វីរៈប៊ុនថាំ'
        : 'Grab / ដឹករហ័ស';

    const itemsSummary = (newOrder.items || [])
      .map((it) => `${it.name} ×${it.quantity}`)
      .join(', ');

    const invoiceText = `📄 វិក្កយបត្របញ្ជាទិញ #${newOrder.orderNumber}${itemsSummary ? ` (${itemsSummary})` : ''} — សរុប: $${newOrder.total.toFixed(2)} (${newOrder.totalKhr.toLocaleString()} រៀល) | ដឹកជញ្ជូន: ${deliveryName} | ទូរស័ព្ទ: ${newOrder.customerPhone}`;
    const invoiceMsgId = `msg_inv_${Date.now()}`;

    const invoiceMsg: ChatMessage = {
      id: invoiceMsgId,
      sender: 'admin',
      senderName: selectedPage.activeStaff || 'សុខា',
      text: invoiceText,
      timestamp: timeStr,
      attachments: [
        {
          type: 'order_invoice',
          data: newOrder,
        },
      ],
      isRead: true,
      deliveryStatus: (selectedPage.isLiveOnline || selectedPage.accessToken) ? 'sending_meta' : 'sent_local',
      isLiveMeta: Boolean(selectedPage.isLiveOnline || selectedPage.accessToken),
    };

    const targetThreadId = newOrder.threadId || selectedThread?.id;

    setThreads((prev) => {
      const next = prev.map((t) => {
        if (t.id === targetThreadId) {
          return {
            ...t,
            status: 'ordered' as const,
            lastMessage: invoiceText,
            lastMessageTime: timeStr,
            orderIds: Array.from(new Set([...(t.orderIds || []), newOrder.id])),
            customer: {
              ...t.customer,
              totalOrders: t.customer.totalOrders + 1,
              totalSpent: t.customer.totalSpent + newOrder.total,
              phone: newOrder.customerPhone,
              address: newOrder.customerAddress,
              province: newOrder.customerProvince,
              tags: Array.from(new Set([...t.customer.tags, 'បានកុម្ម៉ង់'])),
            },
            messages: [...t.messages, invoiceMsg],
          };
        }
        return t;
      });
      persistThreadsToStorageAndServer(next);
      return next;
    });

    // Also dispatch the New Order invoice confirmation to the buyer on Meta Messenger if Live
    if (selectedThread && (selectedPage.isLiveOnline || selectedPage.accessToken) && selectedThread.customer.platform === 'messenger') {
      try {
        const recipientPsid = selectedThread.customer.psid || selectedThread.customer.id;
        const res = await fetch('/api/facebook/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: selectedPage.accessToken || 'demo_live_token',
            recipientId: recipientPsid,
            messageText: invoiceText,
          }),
        });
        const data = await res.json();
        setThreads((prev) => {
          const next = prev.map((t) => {
            if (t.id === targetThreadId) {
              return {
                ...t,
                messages: t.messages.map((m) =>
                  m.id === invoiceMsgId
                    ? { ...m, deliveryStatus: data.success ? ('sent_meta' as const) : ('failed_meta' as const) }
                    : m
                ),
              };
            }
            return t;
          });
          persistThreadsToStorageAndServer(next);
          return next;
        });
      } catch (err) {
        console.warn('Meta send order invoice error:', err);
      }
    }

    if (newOrder.items && newOrder.items.length > 0) {
      newOrder.items.forEach((item) => {
        const targetProd = products.find((p) => p.id === item.productId);
        if (targetProd) {
          const newStock = Math.max(0, (targetProd.stock || 0) - item.quantity);
          handleEditProduct({ ...targetProd, stock: newStock });
        }
      });
    }
  };

  const handleUpdateOrderStatus = (orderId: string, status: Order['status']) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
  };

  const handleUpdateOrder = (updatedOrder: Order) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );
    setThreads((prev) =>
      prev.map((t) => {
        const isMatched = t.orderIds?.includes(updatedOrder.id) || t.id === updatedOrder.threadId;
        if (!isMatched) return t;
        return {
          ...t,
          messages: t.messages.map((m) => {
            if (m.attachments) {
              const updatedAtt = m.attachments.map((att) => {
                if (att.type === 'order_invoice' && (att.data?.id === updatedOrder.id || att.data?.orderNumber === updatedOrder.orderNumber)) {
                  return { ...att, data: updatedOrder };
                }
                return att;
              });
              return { ...m, attachments: updatedAtt };
            }
            return m;
          }),
        };
      })
    );
    soundNotifier.playOrderSuccess();
  };

  // Quick replies handlers
  const handleAddQuickReply = async (qr: Omit<QuickReplyTemplate, 'id'>) => {
    const tempId = `qr_${Date.now()}`;
    const newQr: QuickReplyTemplate = {
      ...qr,
      id: tempId,
    };
    setQuickReplies((prev) => {
      const next = [...prev, newQr];
      try {
        localStorage.setItem('pagechat_quick_replies', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleEditQuickReply = async (updatedQr: QuickReplyTemplate) => {
    setQuickReplies((prev) => {
      const exists = prev.some((q) => q.id === updatedQr.id);
      const next = exists ? prev.map((q) => (q.id === updatedQr.id ? updatedQr : q)) : [...prev, updatedQr];
      try {
        localStorage.setItem('pagechat_quick_replies', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleDeleteQuickReply = async (id: string) => {
    setQuickReplies((prev) => {
      const next = prev.filter((q) => q.id !== id);
      try {
        localStorage.setItem('pagechat_quick_replies', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleAddAutoReply = async (rule: Omit<AutoReplyRule, 'id'>) => {
    const tempId = `ar_${Date.now()}`;
    const newRule: AutoReplyRule = {
      ...rule,
      id: tempId,
    };
    setAutoReplies((prev) => {
      const next = [...prev, newRule];
      try {
        localStorage.setItem('pagechat_auto_replies', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleEditAutoReply = async (updatedRule: AutoReplyRule) => {
    setAutoReplies((prev) => {
      const exists = prev.some((r) => r.id === updatedRule.id);
      const next = exists ? prev.map((r) => (r.id === updatedRule.id ? updatedRule : r)) : [...prev, updatedRule];
      try {
        localStorage.setItem('pagechat_auto_replies', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleToggleAutoReply = async (id: string) => {
    const target = autoReplies.find((r) => r.id === id);
    if (!target) return;
    const toggled = { ...target, enabled: !target.enabled };
    setAutoReplies((prev) => {
      const next = prev.map((r) => (r.id === id ? toggled : r));
      try {
        localStorage.setItem('pagechat_auto_replies', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleDeleteAutoReply = async (id: string) => {
    setAutoReplies((prev) => {
      const next = prev.filter((r) => r.id !== id);
      try {
        localStorage.setItem('pagechat_auto_replies', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Products online persistent handlers
  const handleAddProduct = async (prod: Omit<ProductItem, 'id'>) => {
    const tempId = `prod_${Date.now()}`;
    const newProduct: ProductItem = {
      ...prod,
      id: tempId,
      priceKhr: prod.priceKhr || Math.round(prod.price * 4100),
    };
    
    setProducts((prev) => {
      const updated = [newProduct, ...prev.filter((p) => p.id !== tempId)];
      try {
        localStorage.setItem('pagechat_products', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setIsProductsSyncing(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct),
      });
      const data = await res.json();
      if (data.success && data.product) {
        setProducts((prev) => {
          const final = prev.map((p) => (p.id === tempId ? data.product : p));
          try {
            localStorage.setItem('pagechat_products', JSON.stringify(final));
          } catch {}
          return final;
        });
      }
    } catch (e) {
      console.warn('Failed to save product online, saved locally:', e);
    } finally {
      setIsProductsSyncing(false);
    }
  };

  const handleEditProduct = async (prod: ProductItem) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === prod.id);
      const updated = exists ? prev.map((p) => (p.id === prod.id ? prod : p)) : [prod, ...prev];
      try {
        localStorage.setItem('pagechat_products', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setIsProductsSyncing(true);
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(prod.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prod),
      });
      const data = await res.json();
      if (data.success && data.product) {
        setProducts((prev) => {
          const next = prev.map((p) => (p.id === prod.id ? data.product : p));
          try {
            localStorage.setItem('pagechat_products', JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    } catch (e) {
      console.warn('Failed to update product online, saved locally:', e);
    } finally {
      setIsProductsSyncing(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setProducts((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem('pagechat_products', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setIsProductsSyncing(true);
    try {
      await fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.warn('Failed to delete product online, removed locally:', e);
    } finally {
      setIsProductsSyncing(false);
    }
  };

  const handleSendProductToChat = (product: ProductItem) => {
    setActiveView('inbox');
    handleSendMessage(`ផលិតផល: ${product.nameKh} (តម្លៃ $${product.price.toFixed(2)})`, [
      {
        type: 'product',
        data: product,
      },
    ]);
  };

  const handleAddProductWithImage = (newProd: Partial<ProductItem>) => {
    const fullProd: ProductItem = {
      id: `prod_${Date.now()}`,
      name: newProd.name || 'AI Generated Product',
      nameKh: newProd.nameKh || 'ទំនិញ AI Gemini',
      price: newProd.price || 29.0,
      priceKhr: newProd.priceKhr || 118900,
      stock: newProd.stock || 25,
      sku: newProd.sku || `AI-${Date.now().toString().slice(-4)}`,
      category: newProd.category || 'Special',
      imageUrl: newProd.imageUrl || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
      description: newProd.description || 'Generated by gemini-nano-banana-2.1',
    };
    setProducts((prev) => [fullProd, ...prev]);
    setActiveView('products');
  };

  const handleSendImageToChat = (imageUrl: string, caption: string) => {
    if (!selectedThread) return;
    handleSendMessage(`រូបភាព: ${caption}`, [
      {
        type: 'image',
        data: { url: imageUrl, caption },
      },
    ]);
    setActiveView('inbox');
  };

  const handleSavePage = (newPage: PageAccount, createSampleThread: boolean) => {
    if (editingPage) {
      setPages((prev) => prev.map((p) => (p.id === newPage.id ? newPage : p)));
      if (selectedPage.id === newPage.id) {
        setSelectedPage(newPage);
      }
    } else {
      setPages((prev) => [newPage, ...prev]);
      setSelectedPage(newPage);
      soundNotifier.playOrderSuccess();
    }
    setEditingPage(null);
    setActiveView('inbox');
  };

  const handleSelectPageAndOpenInbox = (page: PageAccount) => {
    setSelectedPage(page);
    const pageThreads = threads.filter((t) => t.pageId === page.id);
    if (pageThreads.length > 0) {
      setSelectedThreadId(pageThreads[0].id);
    }
    setActiveView('inbox');
  };

  const handleEditPage = (page: PageAccount) => {
    setEditingPage(page);
    setIsConnectPageModalOpen(true);
  };

  const handleDeletePage = (pageId: string) => {
    setPages((prev) => {
      const remaining = prev.filter((p) => p.id !== pageId);
      if (selectedPage.id === pageId && remaining.length > 0) {
        setSelectedPage(remaining[0]);
      }
      return remaining;
    });
  };

  const handleSimulatePageChat = (pageId: string) => {
    const target = pages.find((p) => p.id === pageId) || selectedPage;
    setSelectedPage(target);
    setActiveView('inbox');
    handleSimulateCustomerChat();
  };

  const activeInvoiceOrder = orders.find((o) => o.id === activeInvoiceOrderId) || null;
  const totalUnreadCount = threads.reduce((acc, t) => acc + (t.unreadCount > 0 ? 1 : 0), 0);

  return (
    <div
      className={`flex h-screen w-screen overflow-hidden font-sans ${
        isGlobalMobileFrame
          ? 'bg-slate-900 items-center justify-center p-2 sm:p-4'
          : 'bg-slate-100'
      }`}
    >
      <div
        className={`flex overflow-hidden bg-slate-100 ${
          isGlobalMobileFrame
            ? 'w-full max-w-[420px] h-[94vh] rounded-[36px] border-4 border-slate-800 shadow-2xl relative'
            : 'h-full w-full'
        }`}
      >
      {/* 1. Left Navigation Sidebar */}
      {!isGlobalMobileFrame && (
        <Sidebar
          pages={pages}
          selectedPage={selectedPage}
          onSelectPage={handleSelectPageAndOpenInbox}
          onOpenConnectPageModal={() => {
            setEditingPage(null);
            setIsConnectPageModalOpen(true);
          }}
          activeView={activeView}
          onChangeView={setActiveView}
          totalUnread={totalUnreadCount}
          totalOrdersCount={orders.length}
          language={language}
          onToggleLanguage={() => setLanguage(language === 'kh' ? 'en' : 'kh')}
          isMobileOpen={isMobileNavOpen}
          onCloseMobile={() => setIsMobileNavOpen(false)}
          onOpenFacebookLiveModal={() => setIsFacebookLiveModalOpen(true)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Desktop & Mobile Top Status Bar with Offline Editable & Install Controls */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900 text-white shrink-0 shadow-xs border-b border-slate-800 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setIsMobileNavOpen(true)}
              className="md:hidden p-1.5 -ml-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  {language === 'kh'
                    ? 'ប្រព័ន្ធកុំព្យូទ័រ & ទូរស័ព្ទដៃ (Online & Offline)'
                    : 'Desktop & Mobile App (Online & Offline)'}
                </span>
              </span>
              <span className="sm:hidden font-semibold text-xs truncate">PageChat Pro</span>
              <span className="text-[11px] text-slate-400 hidden xl:inline">
                • រក្សាទុក៖ {lastSavedTime}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveView('mobile_app')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeView === 'mobile_app'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
              title="បើកកម្មវិធីសម្រាប់ទូរស័ព្ទដៃ (Mobile App)"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>{language === 'kh' ? 'កម្មវិធីទូរស័ព្ទ' : 'Mobile App'}</span>
            </button>

            <PWAInstallButton
              isOnline={isOnline}
              forceOfflineMode={forceOfflineDesktopMode}
              onToggleOfflineMode={() => toggleForceOfflineMode()}
              onExportLocalFile={() =>
                exportDesktopDatabaseFile({
                  pages,
                  threads,
                  orders,
                  products,
                  quickReplies,
                  autoReplies,
                })
              }
              onImportLocalFile={(loaded) => {
                if (Array.isArray(loaded.orders) && loaded.orders.length > 0) setOrders(loaded.orders);
                if (Array.isArray(loaded.threads) && loaded.threads.length > 0) setThreads(loaded.threads);
                if (Array.isArray(loaded.products) && loaded.products.length > 0) setProducts(loaded.products);
                if (Array.isArray(loaded.pages) && loaded.pages.length > 0) setPages(loaded.pages);
                if (Array.isArray(loaded.quickReplies) && loaded.quickReplies.length > 0)
                  setQuickReplies(loaded.quickReplies);
                if (Array.isArray(loaded.autoReplies) && loaded.autoReplies.length > 0)
                  setAutoReplies(loaded.autoReplies);
                soundNotifier.playOrderSuccess();
              }}
              onSyncNow={handleSyncOfflineDataNow}
              pendingOfflineEditsCount={pendingOfflineEditsCount}
              lastSavedTime={lastSavedTime}
              language={language}
            />
          </div>
        </div>

        {/* Active Offline Computer Mode Banner */}
        {!isOnline && (
          <div className="px-4 py-1.5 bg-amber-500 text-slate-950 text-xs font-bold flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {language === 'kh'
                  ? 'កំពុងប្រើប្រាស់មុខងារ Offline លើកុំព្យូទ័រ — អ្នកអាចបង្កើត Order, កែប្រែបុង, កែប្រែសារឆាត និងកែប្រែស្តុកទំនិញបានធម្មតាដូចពេល Online!'
                  : 'Offline Desktop Mode Active — You can create & edit orders, invoices, chat messages, and stock just like online!'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  exportDesktopDatabaseFile({
                    pages,
                    threads,
                    orders,
                    products,
                    quickReplies,
                    autoReplies,
                  })
                }
                className="px-2.5 py-0.5 bg-slate-900 text-white rounded-md text-[11px] font-bold flex items-center gap-1 hover:bg-slate-800 cursor-pointer"
              >
                <Save className="w-3 h-3" />
                <span>រក្សាទុកឯកសារ</span>
              </button>
              {forceOfflineDesktopMode && (
                <button
                  type="button"
                  onClick={() => toggleForceOfflineMode(false)}
                  className="px-2.5 py-0.5 bg-white text-slate-900 rounded-md text-[11px] font-bold hover:bg-slate-100 cursor-pointer"
                >
                  បើក Online វិញ
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2. Main Work View */}
        {activeView === 'inbox' && (
          <div className="flex flex-1 h-full overflow-hidden">
            {/* Conversation list: hidden on mobile if active chat is open */}
            <div className={`h-full ${isMobileChatOpen ? 'hidden md:flex' : 'flex flex-1 md:flex-none'}`}>
              <ConversationList
                threads={threads}
                selectedThreadId={selectedThreadId}
                onSelectThread={handleSelectThread}
                language={language}
                onSimulateCustomerChat={handleSimulateCustomerChat}
                selectedPage={selectedPage}
                pages={pages}
                onOpenMobileMenu={() => setIsMobileNavOpen(true)}
                onOpenLiveOnlineModal={() => setIsFacebookLiveModalOpen(true)}
              />
            </div>

            {/* Active Chat Window: hidden on mobile if viewing conversation list */}
            <div className={`flex-1 h-full ${!isMobileChatOpen ? 'hidden md:flex flex-col' : 'flex flex-col'}`}>
              {selectedThread ? (
                <ChatWindow
                  thread={selectedThread}
                  quickReplies={quickReplies}
                  products={products}
                  orders={orders}
                  onSendMessage={handleSendMessage}
                  onOpenCreateOrder={() => setIsOrderModalOpen(true)}
                  onViewOrderInvoice={(orderId) => {
                    setIsInvoiceEditMode(false);
                    setActiveInvoiceOrderId(orderId);
                  }}
                  onEditOrderInvoice={(orderId) => {
                    setIsInvoiceEditMode(true);
                    setActiveInvoiceOrderId(orderId);
                  }}
                  onEditMessage={handleEditMessage}
                  onSimulateCustomerReply={handleSimulateCustomerReply}
                  language={language}
                  onOpenAIChat={() => setActiveView('gemini_chat')}
                  onOpenVoiceLive={() => setActiveView('voice_live')}
                  onOpenImageStudio={() => setActiveView('image_studio')}
                  selectedPage={selectedPage}
                  onOpenLiveModal={() => setIsFacebookLiveModalOpen(true)}
                  onBack={() => setIsMobileChatOpen(false)}
                  isAutoPilot={isAutoPilot}
                  onToggleAutoPilot={handleToggleAutoPilot}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                  {language === 'kh' ? 'សូមជ្រើសរើសការជជែកមួយ' : 'Select a conversation'}
                </div>
              )}
            </div>

            {/* Right Customer CRM Panel */}
            {selectedThread && (
              <div className="hidden lg:block">
                <CustomerPanel
                  customer={selectedThread.customer}
                  orders={orders}
                  onUpdateCustomer={handleUpdateCustomer}
                  onOpenCreateOrder={() => setIsOrderModalOpen(true)}
                  onViewOrderInvoice={(orderId) => setActiveInvoiceOrderId(orderId)}
                  language={language}
                />
              </div>
            )}
          </div>
        )}

        {/* Pages & Channels Management View */}
        {activeView === 'pages' && (
          <PagesManagementView
            pages={pages}
            selectedPage={selectedPage}
            threads={threads}
            orders={orders}
            onSelectPage={handleSelectPageAndOpenInbox}
            onOpenConnectModal={() => {
              setEditingPage(null);
              setIsConnectPageModalOpen(true);
            }}
            onEditPage={handleEditPage}
            onDeletePage={handleDeletePage}
            onSimulatePageChat={handleSimulatePageChat}
            language={language}
          />
        )}

        {/* Google Drive Cloud & Backup View */}
        {activeView === 'google_drive' && (
          <GoogleDriveView
            orders={orders}
            threads={threads}
            products={products}
            quickReplies={quickReplies}
            onRestoreBackupData={(backup) => {
              if (backup.orders && backup.orders.length > 0) {
                setOrders(backup.orders);
              }
              if (backup.threads && backup.threads.length > 0) {
                setThreads(backup.threads);
              }
              if (backup.products && backup.products.length > 0) {
                setProducts(backup.products);
              }
              if (backup.quickReplies && backup.quickReplies.length > 0) {
                setQuickReplies(backup.quickReplies);
              }
              soundNotifier.playOrderSuccess();
            }}
            onSendFileToChat={(text, imageUrl) => {
              if (imageUrl) {
                handleSendMessage(text, [
                  {
                    type: 'image',
                    data: { url: imageUrl, caption: text },
                  },
                ]);
              } else {
                handleSendMessage(text);
              }
              setActiveView('inbox');
            }}
            language={language}
          />
        )}

        {/* Gemini Chatbot Multi-Turn View */}
        {activeView === 'gemini_chat' && (
          <GeminiChatbotView
            language={language}
            currentCustomer={selectedThread?.customer}
            currentCustomerThread={selectedThread}
            products={products}
            recentOrders={orders}
            onSendToChat={(text) => {
              handleSendMessage(text);
              setActiveView('inbox');
            }}
          />
        )}

        {/* Voice Live API View (gemini-3.8-live) */}
        {activeView === 'voice_live' && (
          <VoiceLiveView
            language={language}
          />
        )}

        {/* AI Image Studio View (gemini-nano-banana-2.1) */}
        {activeView === 'image_studio' && (
          <ImageStudioView
            language={language}
            products={products}
            onAddProductWithImage={handleAddProductWithImage}
            onSendImageToChat={handleSendImageToChat}
          />
        )}

        {activeView === 'orders' && (
          <OrdersListView
            orders={orders}
            onViewInvoice={(id) => {
              setIsInvoiceEditMode(false);
              setActiveInvoiceOrderId(id);
            }}
            onEditInvoice={(id) => {
              setIsInvoiceEditMode(true);
              setActiveInvoiceOrderId(id);
            }}
            onUpdateStatus={handleUpdateOrderStatus}
            language={language}
          />
        )}

        {activeView === 'quick_replies' && (
          <QuickRepliesView
            quickReplies={quickReplies}
            autoReplies={autoReplies}
            onAddQuickReply={handleAddQuickReply}
            onEditQuickReply={handleEditQuickReply}
            onDeleteQuickReply={handleDeleteQuickReply}
            onAddAutoReply={handleAddAutoReply}
            onEditAutoReply={handleEditAutoReply}
            onToggleAutoReply={handleToggleAutoReply}
            onDeleteAutoReply={handleDeleteAutoReply}
            isSyncing={isQuickRepliesSyncing}
            language={language}
          />
        )}

        {activeView === 'products' && (
          <ProductsCatalogView
            products={products}
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
            onSendProductToChat={handleSendProductToChat}
            language={language}
            isSyncing={isProductsSyncing}
          />
        )}

        {activeView === 'analytics' && (
          <AnalyticsView
            orders={orders}
            threads={threads}
            language={language}
          />
        )}

        {activeView === 'mobile_app' && (
          <MobileAppView
            pages={pages}
            selectedPage={selectedPage}
            threads={threads}
            orders={orders}
            products={products}
            isOnline={isOnline}
            onSendMessage={handleSendMessage}
            onSelectThread={(id) => {
              setSelectedThreadId(id);
            }}
            selectedThreadId={selectedThreadId}
            onOpenCreateOrder={() => setIsOrderModalOpen(true)}
            onViewOrderInvoice={(id) => {
              setIsInvoiceEditMode(false);
              setActiveInvoiceOrderId(id);
            }}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            isGlobalMobileFrame={isGlobalMobileFrame}
            onToggleGlobalMobileFrame={() => setIsGlobalMobileFrame((prev) => !prev)}
            language={language}
          />
        )}

        {/* Mobile Bottom Navigation Bar (Smartphone Ergonomic Thumb Zone) */}
        <MobileBottomNav
          activeView={activeView}
          onChangeView={(v) => {
            setActiveView(v);
            if (v === 'inbox') {
              setIsMobileChatOpen(false);
            }
          }}
          totalUnread={totalUnreadCount}
          totalOrdersCount={orders.length}
          onOpenMobileDrawer={() => setIsMobileNavOpen(true)}
          language={language}
          forceShow={isGlobalMobileFrame}
        />
      </div>
      </div>

      {/* Order Creation Modal */}
      {isOrderModalOpen && selectedThread && (
        <OrderModal
          isOpen={isOrderModalOpen}
          onClose={() => setIsOrderModalOpen(false)}
          customer={selectedThread.customer}
          products={products}
          pageId={selectedPage.id}
          threadId={selectedThread.id}
          onSaveOrder={handleSaveOrder}
          language={language}
        />
      )}

      {/* Invoice Slip Print / Edit Document Modal */}
      <InvoicePrintModal
        order={activeInvoiceOrder}
        page={selectedPage}
        onClose={() => {
          setActiveInvoiceOrderId(null);
          setIsInvoiceEditMode(false);
        }}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onSaveOrder={handleUpdateOrder}
        initialEditMode={isInvoiceEditMode}
        language={language}
      />

      {/* Connect / Edit Page Modal */}
      <ConnectPageModal
        isOpen={isConnectPageModalOpen}
        onClose={() => {
          setIsConnectPageModalOpen(false);
          setEditingPage(null);
        }}
        onSavePage={handleSavePage}
        editingPage={editingPage}
        language={language}
      />

      {/* Facebook Live Connect Modal */}
      {isFacebookLiveModalOpen && (
        <FacebookLiveModal
          isOpen={isFacebookLiveModalOpen}
          onClose={() => setIsFacebookLiveModalOpen(false)}
          page={selectedPage}
          onUpdatePage={(updated) => {
            setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setSelectedPage(updated);
          }}
          onSyncRealConversations={handleSyncRealConversations}
          language={language}
        />
      )}
    </div>
  );
}
