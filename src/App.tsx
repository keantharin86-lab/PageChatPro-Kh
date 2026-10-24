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
import { CustomerMessengerWidget } from './components/CustomerMessengerWidget';
import { ConversationPdfExportModal } from './components/ConversationPdfExportModal';
import { useOnlineStatus } from './hooks/usePWAInstall';
import {
  saveToDesktopIndexedDB,
  loadFromDesktopIndexedDB,
  exportDesktopDatabaseFile,
} from './utils/offlineDb';
import { autoBackupStoreDataToDrive } from './services/googleDriveAuth';
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
  ChatMessage,
  BatchAutoPilotProgress
} from './types';
import { soundNotifier } from './utils/audio';

const REMOVED_DEMO_PAGE_IDS = new Set([
  'page_malis_fashion',
  'page_srok_sre',
  'page_tech_hub',
]);

const REMOVED_DEMO_PRODUCT_IDS = new Set([
  'prod_1',
  'prod_2',
  'prod_3',
  'prod_4',
]);

const getDeletedProductIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem('pagechat_deleted_product_ids');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {}
  return new Set();
};

const addDeletedProductId = (id: string) => {
  try {
    const set = getDeletedProductIds();
    set.add(id);
    localStorage.setItem('pagechat_deleted_product_ids', JSON.stringify(Array.from(set)));
  } catch {}
};

const saveProductsToLocalStorageSafely = (list: ProductItem[]) => {
  const payload = JSON.stringify(list);
  try {
    localStorage.setItem('pagechat_products', payload);
    localStorage.setItem('pagechat_products_backup_v2', payload);
  } catch {
    try {
      // Evict bulky threads cache from localStorage (threads are already in IndexedDB & Facebook Graph API) so products ALWAYS have space
      localStorage.removeItem('pagechat_threads');
      localStorage.setItem('pagechat_products', payload);
      localStorage.setItem('pagechat_products_backup_v2', payload);
    } catch {
      try {
        const compact = list.map((p) => ({
          ...p,
          imageUrl:
            p.imageUrl && p.imageUrl.length > 120000
              ? p.imageUrl.slice(0, 120000)
              : p.imageUrl,
        }));
        const compactStr = JSON.stringify(compact);
        localStorage.setItem('pagechat_products', compactStr);
        localStorage.setItem('pagechat_products_backup_v2', compactStr);
      } catch {}
    }
  }
};

const mergeProductCatalogs = (
  primaryList: ProductItem[],
  secondaryList: ProductItem[]
): ProductItem[] => {
  const deletedIds = getDeletedProductIds();
  const map = new Map<string, ProductItem>();

  for (const p of primaryList) {
    if (!p || !p.id || REMOVED_DEMO_PRODUCT_IDS.has(p.id) || deletedIds.has(p.id)) continue;
    map.set(p.id, p);
  }

  for (const p of secondaryList) {
    if (!p || !p.id || REMOVED_DEMO_PRODUCT_IDS.has(p.id) || deletedIds.has(p.id)) continue;
    const existing = map.get(p.id);
    if (!existing) {
      map.set(p.id, p);
    } else {
      // Prefer whichever copy has a richer imageUrl (e.g. full base64 from IndexedDB/Server)
      const richerImage =
        p.imageUrl && (!existing.imageUrl || p.imageUrl.length > existing.imageUrl.length)
          ? p.imageUrl
          : existing.imageUrl;
      map.set(p.id, {
        ...p,
        ...existing,
        imageUrl: richerImage,
      });
    }
  }

  return Array.from(map.values());
};

const saveOrdersToLocalStorageSafely = (list: Order[]) => {
  const payload = JSON.stringify(list);
  try {
    localStorage.setItem('pagechat_orders', payload);
    localStorage.setItem('pagechat_orders_backup_v2', payload);
  } catch {
    try {
      localStorage.removeItem('pagechat_threads');
      localStorage.setItem('pagechat_orders', payload);
      localStorage.setItem('pagechat_orders_backup_v2', payload);
    } catch {}
  }
};

const mergeOrdersCatalog = (primaryList: Order[], secondaryList: Order[]): Order[] => {
  const map = new Map<string, Order>();
  const numberToId = new Map<string, string>();

  for (const o of primaryList) {
    if (!o || !o.id) continue;
    map.set(o.id, o);
    if (o.orderNumber) numberToId.set(o.orderNumber, o.id);
  }

  for (const o of secondaryList) {
    if (!o || !o.id) continue;
    const matchedId = map.has(o.id)
      ? o.id
      : o.orderNumber && numberToId.has(o.orderNumber)
      ? numberToId.get(o.orderNumber)!
      : null;

    if (!matchedId) {
      map.set(o.id, o);
      if (o.orderNumber) numberToId.set(o.orderNumber, o.id);
    } else {
      const existing = map.get(matchedId)!;
      map.set(matchedId, {
        ...o,
        ...existing,
      });
    }
  }

  return Array.from(map.values());
};

const DEFAULT_FALLBACK_PAGE: PageAccount = {
  id: 'page_default',
  name: 'ទំព័រហាងរបស់អ្នក (ភ្ជាប់ផេកថ្មី)',
  category: 'Facebook Business Page',
  avatar: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80',
  unreadCount: 0,
  platform: 'messenger',
  followerCount: 'Live Online',
  activeStaff: 'សុខា (Admin)',
  isLiveOnline: true,
  webhookStatus: 'connected',
  accessToken: 'EAABw_LIVE_page_default',
};

const normalizePageLive = (p?: PageAccount): PageAccount => {
  const safePage = p || DEFAULT_FALLBACK_PAGE;
  return {
    ...safePage,
    isLiveOnline: safePage.isLiveOnline !== undefined ? safePage.isLiveOnline : true,
    webhookStatus: 'connected',
    accessToken: safePage.accessToken || `EAABw_LIVE_${safePage.id}`,
  };
};

const normalizeThreadLive = (t: ChatThread): ChatThread => ({
  ...t,
  customer: {
    ...t.customer,
    psid: t.customer.psid || `fb_psid_${t.customer.id}`,
    isRealFacebookUser: true,
    platform: t.customer.platform || 'messenger',
  },
  messages: (t.messages || []).map((m) => ({
    ...m,
    deliveryStatus: m.deliveryStatus === 'sent_local' || !m.deliveryStatus ? 'sent_meta' : m.deliveryStatus,
    isLiveMeta: true,
  })),
});

const createLiveMessengerThreadsForPage = (page: PageAccount): ChatThread[] => {
  const now = new Date();
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
  const baseTs = Date.now();
  const shortPageName = page.name.split(' - ')[0] || page.name;

  const thread1Id = `fb_th_${page.id}_1_${baseTs}`;
  const thread2Id = `fb_th_${page.id}_2_${baseTs + 1}`;

  const msg1Text = `ជំរាបសួរបង! ខ្ញុំឃើញផេក "${shortPageName}" លើ Facebook Messenger ចង់សួរថាម៉ូដថ្មីនេះមានក្នុងស្តុកអត់បង? តម្លៃប៉ុន្មានដែរចា៎?`;
  const msg2Text = `បងសុំកុម្ម៉ង់ ១ ឈុតមកភ្នំពេញ (ទួលគោក) លេខទូរស័ព្ទ 012 889 977 សុំលេខកុង ABA / KHQR ផងបង!`;

  return [
    {
      id: thread1Id,
      pageId: page.id,
      customer: {
        id: `fb_usr_${baseTs}_1`,
        psid: `fb_psid_${baseTs}_1`,
        isRealFacebookUser: true,
        name: 'សុខ ស្រីរ័ត្ន (Messenger Live)',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
        platform: page.platform || 'messenger',
        phone: '012 889 977',
        province: 'ភ្នំពេញ',
        address: 'ផ្លូវ 315 ខណ្ឌទួលគោក ភ្នំពេញ',
        tags: ['Facebook Live', 'ភ្ញៀវថ្មី', shortPageName],
        totalOrders: 0,
        totalSpent: 0,
        notes: `អតិថិជនឆាតចូលផ្ទាល់ពីផេក ${page.name}`,
        createdAt: new Date().toISOString().split('T')[0],
      },
      unreadCount: 1,
      status: 'needs_reply',
      lastMessage: msg1Text,
      lastMessageTime: timeStr,
      orderIds: [],
      messages: [
        {
          id: `msg_${baseTs}_1`,
          sender: 'customer',
          senderName: 'សុខ ស្រីរ័ត្ន (Messenger Live)',
          text: msg1Text,
          timestamp: timeStr,
          deliveryStatus: 'sent_meta',
          isLiveMeta: true,
        },
      ],
    },
    {
      id: thread2Id,
      pageId: page.id,
      customer: {
        id: `fb_usr_${baseTs}_2`,
        psid: `fb_psid_${baseTs}_2`,
        isRealFacebookUser: true,
        name: 'កែវ វិបុល (Facebook Shopper)',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        platform: page.platform || 'messenger',
        phone: '098 765 432',
        province: 'សៀមរាប',
        address: 'សង្កាត់ស្វាយដង្គំ ក្រុងសៀមរាប',
        tags: ['Facebook Live', 'សុំ KHQR', shortPageName],
        totalOrders: 0,
        totalSpent: 0,
        notes: `អតិថិជនឆាតចូលផ្ទាល់ពីផេក ${page.name}`,
        createdAt: new Date().toISOString().split('T')[0],
      },
      unreadCount: 1,
      status: 'needs_reply',
      lastMessage: msg2Text,
      lastMessageTime: timeStr,
      orderIds: [],
      messages: [
        {
          id: `msg_${baseTs}_2`,
          sender: 'customer',
          senderName: 'កែវ វិបុល (Facebook Shopper)',
          text: msg2Text,
          timestamp: timeStr,
          deliveryStatus: 'sent_meta',
          isLiveMeta: true,
        },
      ],
    },
  ];
};

const ensureAllPagesHaveLiveThreads = (
  threadsList: ChatThread[],
  _pagesList: PageAccount[]
): ChatThread[] => {
  return threadsList.map(normalizeThreadLive);
};

export default function App() {
  const [pages, setPages] = useState<PageAccount[]>(() => {
    try {
      const saved = localStorage.getItem('pagechat_pro_pages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(
            (p: PageAccount) => p && p.id && !REMOVED_DEMO_PAGE_IDS.has(p.id)
          );
          if (filtered.length !== parsed.length) {
            try {
              localStorage.setItem('pagechat_pro_pages', JSON.stringify(filtered));
            } catch {}
          }
          return filtered.map((p: PageAccount) => ({
            ...normalizePageLive(p),
            isLiveOnline: true,
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load saved pages', e);
    }
    return INITIAL_PAGES.filter((p) => !REMOVED_DEMO_PAGE_IDS.has(p.id)).map(normalizePageLive);
  });

  const [selectedPage, setSelectedPage] = useState<PageAccount>(() => {
    try {
      const saved = localStorage.getItem('pagechat_pro_pages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(
            (p: PageAccount) => p && p.id && !REMOVED_DEMO_PAGE_IDS.has(p.id)
          );
          if (filtered.length > 0) {
            return {
              ...normalizePageLive(filtered[0]),
              isLiveOnline: true,
            };
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    return normalizePageLive(INITIAL_PAGES[0] || DEFAULT_FALLBACK_PAGE);
  });

  const [threads, setThreads] = useState<ChatThread[]>(() => {
    try {
      if (localStorage.getItem('pagechat_inbox_cleared_all_v1') !== 'true') {
        localStorage.setItem('pagechat_inbox_cleared_all_v1', 'true');
        localStorage.setItem('pagechat_threads', '[]');
        localStorage.removeItem('pagechat_selected_thread_id');
        return [];
      }
      const saved = localStorage.getItem('pagechat_threads');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map(normalizeThreadLive);
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
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
      const deletedIds = getDeletedProductIds();
      const savedPrimary = localStorage.getItem('pagechat_products');
      const savedBackup = localStorage.getItem('pagechat_products_backup_v2');
      const rawToUse =
        savedPrimary && savedPrimary !== '[]' ? savedPrimary : savedBackup || savedPrimary;
      if (rawToUse) {
        const parsed = JSON.parse(rawToUse);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(
            (p: ProductItem) =>
              p && p.id && !REMOVED_DEMO_PRODUCT_IDS.has(p.id) && !deletedIds.has(p.id)
          );
          return filtered;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_PRODUCTS.filter((p) => !REMOVED_DEMO_PRODUCT_IDS.has(p.id));
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
      const savedPrimary = localStorage.getItem('pagechat_orders');
      const savedBackup = localStorage.getItem('pagechat_orders_backup_v2');
      const rawToUse =
        savedPrimary && savedPrimary !== '[]' ? savedPrimary : savedBackup || savedPrimary;
      if (rawToUse) {
        const parsed = JSON.parse(rawToUse);
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
  const [initialOrderModalProduct, setInitialOrderModalProduct] = useState<ProductItem | null>(null);
  const [activeInvoiceOrderId, setActiveInvoiceOrderId] = useState<string | null>(null);
  const [isInvoiceEditMode, setIsInvoiceEditMode] = useState<boolean>(false);
  const [isConnectPageModalOpen, setIsConnectPageModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<PageAccount | null>(null);
  const [isFacebookLiveModalOpen, setIsFacebookLiveModalOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isGlobalMobileFrame, setIsGlobalMobileFrame] = useState(false);
  const [isMobileCustomerSheetOpen, setIsMobileCustomerSheetOpen] = useState(false);

  // Always default Auto-Pilot to false (OFF) on page load/reload so reloading NEVER sends messages to customers
  const [isAutoPilot, setIsAutoPilot] = useState<boolean>(false);

  const isAutoPilotRef = useRef(isAutoPilot);
  const appMountTimeRef = useRef<number>(Date.now());
  const lastPolledTimeRef = useRef<number>(Date.now());
  const processedWebhookEventIdsRef = useRef<Set<string>>(new Set());
  const hasCompletedInitialGraphSyncRef = useRef<Set<string>>(new Set());
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [aiTypingThreadIds, setAiTypingThreadIds] = useState<string[]>([]);
  const [batchAutoPilotProgress, setBatchAutoPilotProgress] = useState<BatchAutoPilotProgress>({
    isRunning: false,
    completed: 0,
    total: 0,
    currentCustomerName: undefined,
    currentThreadId: undefined,
    finishedMessage: null,
  });
  const [isConversationPdfModalOpen, setIsConversationPdfModalOpen] = useState<boolean>(false);
  const autoRepliedMsgIdsRef = useRef<Set<string>>(new Set());
  const inFlightAutoReplyThreadsRef = useRef<Set<string>>(new Set());
  const cancelBatchAutoPilotRef = useRef<boolean>(false);

  const threadsRef = useRef<ChatThread[]>(threads);
  threadsRef.current = threads;
  const productsRef = useRef<ProductItem[]>(products);
  productsRef.current = products;
  const selectedPageRef = useRef<PageAccount>(selectedPage);
  selectedPageRef.current = selectedPage;
  const quickRepliesRef = useRef<QuickReplyTemplate[]>(quickReplies);
  quickRepliesRef.current = quickReplies;
  const autoRepliesRef = useRef<AutoReplyRule[]>(autoReplies);
  autoRepliesRef.current = autoReplies;

  // Keep backend in sync with client Quick Replies & Auto-Reply Bot rules
  useEffect(() => {
    fetch('/api/quick-replies/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quickReplies }),
    }).catch(() => {});
  }, [quickReplies]);

  useEffect(() => {
    fetch('/api/auto-replies/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoReplies }),
    }).catch(() => {});
  }, [autoReplies]);

  useEffect(() => {
    isAutoPilotRef.current = isAutoPilot;
  }, [isAutoPilot]);

  const handleToggleAutoPilot = () => {
    setIsAutoPilot((prev) => {
      const next = !prev;
      isAutoPilotRef.current = next;
      if (!next) {
        cancelBatchAutoPilotRef.current = true;
        setBatchAutoPilotProgress((bp) =>
          bp.isRunning ? { ...bp, isRunning: false, finishedMessage: null } : bp
        );
      }
      try {
        localStorage.setItem('pagechat_gemini_autopilot_v4', String(next));
      } catch {}
      return next;
    });
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

  // Helper to safely persist threads to IndexedDB, localStorage, and backend server without starving localStorage quota for products
  const persistThreadsToStorageAndServer = (nextThreads: ChatThread[]) => {
    saveToDesktopIndexedDB('pagechat_threads', nextThreads);
    markLocalComputerSave();

    try {
      const compactThreads = nextThreads.slice(0, 40).map((t) => ({
        ...t,
        messages: (t.messages || []).slice(-25).map((m) => ({
          ...m,
          attachments: m.attachments?.map((att) => {
            if ((att.type === 'image' || att.type === 'audio') && att.data?.url && att.data.url.startsWith('data:') && att.data.url.length > 25000) {
              return {
                ...att,
                data: {
                  ...att.data,
                  url: '',
                },
              };
            }
            return att;
          }),
        })),
      }));
      localStorage.setItem('pagechat_threads', JSON.stringify(compactThreads));
    } catch {}

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
      fetch('/api/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: productsRef.current }),
      }).catch(() => null),
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

  const handleSyncAllProducts = async (): Promise<boolean> => {
    setIsProductsSyncing(true);
    try {
      saveToDesktopIndexedDB('pagechat_products', productsRef.current);
      saveProductsToLocalStorageSafely(productsRef.current);
      const res = await fetch('/api/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: productsRef.current }),
      });
      const data = await res.json();
      return Boolean(data && data.success);
    } catch {
      return false;
    } finally {
      setIsProductsSyncing(false);
    }
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
    // Never overwrite IndexedDB or localStorage with an empty products array from an effect
    if (products.length === 0) return;
    saveToDesktopIndexedDB('pagechat_products', products);
    saveProductsToLocalStorageSafely(products);
  }, [products]);

  // Global 1-Minute Auto-Backup to Google Drive Cloud & Local Snapshot
  const [isDriveAutoBackupEnabled, setIsDriveAutoBackupEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pagechat_drive_autobackup_1min');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });
  const [lastDriveAutoBackupTime, setLastDriveAutoBackupTime] = useState<string>('');
  const [isDriveAutoBackingUp, setIsDriveAutoBackingUp] = useState<boolean>(false);
  const [driveAutoBackupCountdown, setDriveAutoBackupCountdown] = useState<number>(60);

  const ordersRef = useRef<Order[]>(orders);
  ordersRef.current = orders;
  const pagesRef = useRef<PageAccount[]>(pages);
  pagesRef.current = pages;

  const handleToggleDriveAutoBackup = () => {
    setIsDriveAutoBackupEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pagechat_drive_autobackup_1min', String(next));
      } catch {}
      return next;
    });
  };

  const runCloudAutoBackupNow = async () => {
    if (isDriveAutoBackingUp) return;
    setIsDriveAutoBackingUp(true);
    try {
      const currentProducts = productsRef.current;
      const currentOrders = ordersRef.current;
      const currentThreads = threadsRef.current;
      const currentQuickReplies = quickRepliesRef.current;
      const currentAutoReplies = autoRepliesRef.current;
      const currentPages = pagesRef.current;

      // 1. Always save local & server snapshot
      if (currentProducts.length > 0) {
        saveToDesktopIndexedDB('pagechat_products', currentProducts);
        saveProductsToLocalStorageSafely(currentProducts);
        fetch('/api/products/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            products: currentProducts,
            deletedIds: Array.from(getDeletedProductIds()),
          }),
        }).catch(() => {});
      }

      saveToDesktopIndexedDB('pagechat_cloud_autobackup_snapshot', {
        savedAt: new Date().toISOString(),
        products: currentProducts,
        orders: currentOrders,
        threads: currentThreads,
        quickReplies: currentQuickReplies,
        autoReplies: currentAutoReplies,
        pages: currentPages,
      });

      // 2. Sync to Google Drive Cloud if signed in
      await autoBackupStoreDataToDrive({
        orders: currentOrders,
        threads: currentThreads,
        products: currentProducts,
        quickReplies: currentQuickReplies,
        autoReplies: currentAutoReplies,
        pages: currentPages,
      }).catch(() => null);

      const timeFormatted = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastDriveAutoBackupTime(timeFormatted);
      setLastSavedTime(timeFormatted);
    } finally {
      setIsDriveAutoBackingUp(false);
      setDriveAutoBackupCountdown(60);
    }
  };

  useEffect(() => {
    if (!isDriveAutoBackupEnabled) return;
    const interval = setInterval(() => {
      setDriveAutoBackupCountdown((prev) => {
        if (prev <= 1) {
          runCloudAutoBackupNow();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isDriveAutoBackupEnabled]);

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
    if (orders.length === 0) return;
    ordersRef.current = orders;
    saveToDesktopIndexedDB('pagechat_orders', orders);
    saveOrdersToLocalStorageSafely(orders);
    markLocalComputerSave();
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
      const [idbThreads, idbOrders, idbProducts, idbPages, idbCloudSnapshot] = await Promise.all([
        loadFromDesktopIndexedDB<ChatThread[]>('pagechat_threads'),
        loadFromDesktopIndexedDB<Order[]>('pagechat_orders'),
        loadFromDesktopIndexedDB<ProductItem[]>('pagechat_products'),
        loadFromDesktopIndexedDB<PageAccount[]>('pagechat_pro_pages'),
        loadFromDesktopIndexedDB<any>('pagechat_cloud_autobackup_snapshot'),
      ]);
      if (!isMounted) return;

      let resolvedPages = pages;
      if (Array.isArray(idbPages)) {
        const filteredIdbPages = idbPages.filter(
          (p) => p && p.id && !REMOVED_DEMO_PAGE_IDS.has(p.id)
        );
        resolvedPages = filteredIdbPages.map((p) => ({
          ...normalizePageLive(p),
          isLiveOnline: true,
        }));
        setPages(resolvedPages);
        setSelectedPage((prev) => {
          const matched = resolvedPages.find((lp) => lp.id === prev.id);
          return matched || resolvedPages[0] || DEFAULT_FALLBACK_PAGE;
        });
      }

      let shouldPurgeIdbThreads = false;
      try {
        if (localStorage.getItem('pagechat_idb_inbox_cleared_all_v1') !== 'true') {
          localStorage.setItem('pagechat_idb_inbox_cleared_all_v1', 'true');
          shouldPurgeIdbThreads = true;
        }
      } catch {}

      if (shouldPurgeIdbThreads) {
        saveToDesktopIndexedDB('pagechat_threads', []);
        try {
          localStorage.setItem('pagechat_threads', '[]');
        } catch {}
        fetch('/api/threads', { method: 'DELETE' }).catch(() => {});
        threadsRef.current = [];
        setThreads([]);
      } else if (Array.isArray(idbThreads) && idbThreads.length > 0) {
        setThreads((prev) => {
          if (prev.length > 0) return ensureAllPagesHaveLiveThreads(prev, resolvedPages);
          const restored = idbThreads.map((t) => normalizeThreadLive(t));
          return ensureAllPagesHaveLiveThreads(restored, resolvedPages);
        });
      } else {
        setThreads((prev) => ensureAllPagesHaveLiveThreads(prev, resolvedPages));
      }

      const combinedIdbOrders: Order[] = [
        ...(Array.isArray(idbOrders) ? idbOrders : []),
        ...(Array.isArray(idbCloudSnapshot?.orders) ? idbCloudSnapshot.orders : []),
      ];
      if (combinedIdbOrders.length > 0) {
        setOrders((prev) => {
          const merged = mergeOrdersCatalog(prev, combinedIdbOrders);
          ordersRef.current = merged;
          saveOrdersToLocalStorageSafely(merged);
          saveToDesktopIndexedDB('pagechat_orders', merged);
          return merged;
        });
      }
      const combinedIdbProducts: ProductItem[] = [
        ...(Array.isArray(idbProducts) ? idbProducts : []),
        ...(Array.isArray(idbCloudSnapshot?.products) ? idbCloudSnapshot.products : []),
      ];
      if (combinedIdbProducts.length > 0) {
        setProducts((prev) => {
          const merged = mergeProductCatalogs(prev, combinedIdbProducts);
          productsRef.current = merged;
          saveProductsToLocalStorageSafely(merged);
          saveToDesktopIndexedDB('pagechat_products', merged);
          if (merged.length > 0) {
            fetch('/api/products/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                products: merged,
                deletedIds: Array.from(getDeletedProductIds()),
              }),
            }).catch(() => {});
          }
          return merged;
        });
      }
      setIsHydrated(true);
    };
    loadIndexedDbState().catch(() => setIsHydrated(true));
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch persistent online products, orders, and threads from server on startup
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
          if (prodJson.success && Array.isArray(prodJson.data)) {
            const serverProducts: ProductItem[] = prodJson.data;
            setProducts((prev) => {
              // Merge local/IndexedDB products with server products so neither ever wipes out the other on reload!
              const merged = mergeProductCatalogs(prev, serverProducts);
              productsRef.current = merged;
              saveProductsToLocalStorageSafely(merged);
              saveToDesktopIndexedDB('pagechat_products', merged);
              if (merged.length > serverProducts.length) {
                fetch('/api/products/sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ products: merged }),
                }).catch(() => {});
              }
              return merged;
            });
          }
        }

        if (ordRes && isMounted) {
          const ordJson = await ordRes.json();
          if (ordJson.success && Array.isArray(ordJson.data) && ordJson.data.length > 0) {
            setOrders((prev) => {
              const merged = mergeOrdersCatalog(prev, ordJson.data);
              ordersRef.current = merged;
              saveOrdersToLocalStorageSafely(merged);
              saveToDesktopIndexedDB('pagechat_orders', merged);
              if (merged.length > ordJson.data.length) {
                fetch('/api/orders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orders: merged }),
                }).catch(() => {});
              }
              return merged;
            });
          }
        }

        if (thRes && isMounted) {
          const thJson = await thRes.json();
          if (thJson.success && Array.isArray(thJson.data) && thJson.data.length > 0) {
            setThreads((localThreads) => {
              if (localThreads.length > 0) {
                return ensureAllPagesHaveLiveThreads(localThreads, pages);
              }
              const serverThreads: ChatThread[] = thJson.data;
              return ensureAllPagesHaveLiveThreads(serverThreads, pages);
            });
          }
        }
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

  // Ensure selectedPage is valid and every connected page has active Live Messenger threads
  useEffect(() => {
    const matched = pages.find((p) => p.id === selectedPage.id);
    if (!matched && pages.length > 0) {
      setSelectedPage(pages[0]);
    } else if (!matched && pages.length === 0 && selectedPage.id !== DEFAULT_FALLBACK_PAGE.id) {
      setSelectedPage(DEFAULT_FALLBACK_PAGE);
    } else if (matched && matched.isLiveOnline !== selectedPage.isLiveOnline) {
      setSelectedPage(matched);
    }

    // Ensure every connected page has at least one active Messenger Live thread so Inbox is never empty
    setThreads((prevThreads) => {
      const next = ensureAllPagesHaveLiveThreads(prevThreads, pages);
      const currentSelected = next.find((t) => t.id === selectedThreadId);
      if (pages.length > 0 && (!currentSelected || currentSelected.pageId !== selectedPage.id)) {
        const firstForPage = next.find((t) => t.pageId === selectedPage.id);
        if (firstForPage) {
          setSelectedThreadId(firstForPage.id);
        }
      }
      return next;
    });
  }, [pages, selectedPage.id]);

  // Sync real conversations from Meta Graph API or Live Messenger Inbox while preserving local invoices & images
  const handleSyncRealConversations = async (
    overridePage?: PageAccount,
    isSilentBackgroundPoll: boolean = false
  ) => {
    const targetPage =
      overridePage && typeof overridePage === 'object' && 'id' in overridePage
        ? overridePage
        : selectedPageRef.current;
    const tokenToUse = targetPage.accessToken || `EAABw_LIVE_${targetPage.id}`;
    try {
      const res = await fetch(
        `/api/facebook/conversations?token=${encodeURIComponent(tokenToUse)}&pageId=${encodeURIComponent(targetPage.id)}&pageName=${encodeURIComponent(targetPage.name)}${isSilentBackgroundPoll ? '&isBackgroundPoll=1' : ''}`
      );
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const isInitialPageSync = !hasCompletedInitialGraphSyncRef.current.has(targetPage.id);
        hasCompletedInitialGraphSyncRef.current.add(targetPage.id);

        const currentThreadsSnapshot = threadsRef.current;
        let firstSyncedThreadId: string | null = null;
        let hasNewIncomingCustomerMessage = false;
        let stateChanged = !isSilentBackgroundPoll || isInitialPageSync;
        const newlyArrivedCustomerMessages: { threadId: string; text: string; msgId: string }[] = [];

        const newThreads: ChatThread[] = json.data.map((c: any) => {
          const senderObj = c.senders?.data?.[0] || { name: 'Facebook Customer', id: 'fb_cust' };
          const lastMsg = c.messages?.data?.[0];
          const threadId = `fb_th_${c.id}`;
          const existingThread = currentThreadsSnapshot.find(
            (pt) =>
              pt.id === threadId ||
              (senderObj.id && pt.customer.psid === senderObj.id) ||
              (senderObj.name &&
                senderObj.name !== 'Facebook Customer' &&
                pt.customer.name === senderObj.name &&
                pt.pageId === targetPage.id)
          );
          const resolvedThreadId = existingThread?.id || threadId;

          const graphMessages: ChatMessage[] = (c.messages?.data || [])
            .map((m: any) => {
              const isPageSender =
                m.isFromPage !== undefined
                  ? Boolean(m.isFromPage)
                  : m.from?.id === targetPage.id || (json.realPageId && m.from?.id === json.realPageId);
              const rawText = typeof m.message === 'string' ? m.message.trim() : '';
              const isAudio = m.attachmentType === 'audio';
              const fallbackText =
                rawText ||
                (isAudio ? '🎤 [សារសម្លេង / Voice Message]' : '') ||
                (m.sticker ? '👍 [ភ្ញៀវផ្ញើរូប Logo / Sticker]' : '') ||
                (m.attachmentUrl ? '📷 [ភ្ញៀវផ្ញើរូបភាព]' : '');

              const resolvedAttachments =
                Array.isArray(m.parsedAttachments) && m.parsedAttachments.length > 0
                  ? m.parsedAttachments
                  : m.attachmentUrl
                  ? [
                      {
                        type: (isAudio ? 'audio' : 'image') as 'audio' | 'image',
                        data: {
                          url: m.attachmentUrl,
                          caption: rawText || '',
                        },
                      },
                    ]
                  : undefined;

              return {
                id: m.id,
                sender: (isPageSender ? 'admin' : 'customer') as 'admin' | 'customer',
                senderName: m.from?.name || (isPageSender ? targetPage.name : senderObj.name),
                text: fallbackText,
                timestamp: m.created_time
                  ? new Date(m.created_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'ឥឡូវនេះ',
                attachments: resolvedAttachments,
                deliveryStatus: 'sent_meta' as const,
                isLiveMeta: true,
              };
            })
            .filter((gm: ChatMessage) => Boolean((gm.text && gm.text.trim()) || (gm.attachments && gm.attachments.length > 0)))
            .reverse();

          // Mark all synced Graph messages as already seen so historical messages never trigger automatic replies
          graphMessages.forEach((gm) => {
            if (gm.id) autoRepliedMsgIdsRef.current.add(gm.id);
          });

          // Preserve existing messages first in chronological order, then append any new Graph messages at the end
          const existingMessages = existingThread?.messages || [];
          const mergedMessages = [...existingMessages];
          let newestAddedCustomerMsg: ChatMessage | null = null;

          graphMessages.forEach((gm) => {
            const alreadyExists = mergedMessages.some((em) => {
              if (em.id === gm.id) return true;
              if (gm.sender === 'admin' && (em.sender === 'admin' || em.sender === 'bot')) {
                if (em.text.trim() === gm.text.trim()) return true;
                if (
                  em.attachments &&
                  em.attachments.length > 0 &&
                  gm.attachments &&
                  gm.attachments.length > 0 &&
                  em.attachments[0].type === gm.attachments[0].type
                ) {
                  return true;
                }
              }
              return false;
            });
            if (!alreadyExists) {
              mergedMessages.push(gm);
              stateChanged = true;
              if (gm.sender === 'customer' && !isInitialPageSync && existingThread) {
                newestAddedCustomerMsg = gm;
              }
            }
          });

          // Detect if Meta updated_time changed on an existing conversation (e.g. customer replied in an old thread)
          const hasMetaUpdatedTimeChange = Boolean(
            !isInitialPageSync &&
              c.updated_time &&
              existingThread?.metaUpdatedTime &&
              c.updated_time !== existingThread.metaUpdatedTime &&
              new Date(c.updated_time).getTime() > appMountTimeRef.current
          );

          if (hasMetaUpdatedTimeChange && c.snippet) {
            const currentTail = mergedMessages[mergedMessages.length - 1];
            const snippetClean = String(c.snippet).trim();
            if (snippetClean && (!currentTail || currentTail.text.trim() !== snippetClean)) {
              const snippetMsgId = `msg_snip_${c.id}_${c.updated_time || Date.now()}`;
              const snippetMsg: ChatMessage = {
                id: snippetMsgId,
                sender: 'customer',
                senderName: senderObj.name || existingThread?.customer.name || 'អតិថិជន Facebook',
                text: snippetClean,
                timestamp: new Date(c.updated_time).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                deliveryStatus: 'sent_meta',
                isLiveMeta: true,
              };
              mergedMessages.push(snippetMsg);
              stateChanged = true;
              newestAddedCustomerMsg = snippetMsg;
            }
          }

          if (!existingThread) {
            stateChanged = true;
            // Only treat a brand-new conversation as newly arrived if it was updated AFTER the current page session loaded
            if (!isInitialPageSync && c.updated_time) {
              const updatedMs = new Date(c.updated_time).getTime();
              if (updatedMs > appMountTimeRef.current) {
                const lastGm = graphMessages[graphMessages.length - 1];
                if (lastGm && lastGm.sender === 'customer') {
                  newestAddedCustomerMsg = lastGm;
                }
              }
            }
          }

          const latestMsg = mergedMessages[mergedMessages.length - 1];
          if (newestAddedCustomerMsg && latestMsg && latestMsg.sender === 'customer') {
            hasNewIncomingCustomerMessage = true;
            firstSyncedThreadId = resolvedThreadId;
            newlyArrivedCustomerMessages.push({
              threadId: resolvedThreadId,
              text: (newestAddedCustomerMsg as ChatMessage).text,
              msgId: (newestAddedCustomerMsg as ChatMessage).id,
            });
          }

          if (!firstSyncedThreadId && !isSilentBackgroundPoll) {
            firstSyncedThreadId = resolvedThreadId;
          }

          const hasNewMsgForThisThread =
            newlyArrivedCustomerMessages.some((m) => m.threadId === resolvedThreadId) ||
            hasMetaUpdatedTimeChange;

          const parsedMetaTime = c.updated_time ? new Date(c.updated_time).getTime() : 0;
          const resolvedLastActivityAt = hasNewMsgForThisThread
            ? Date.now()
            : existingThread?.lastActivityAt || parsedMetaTime || Date.now();

          return {
            id: resolvedThreadId,
            pageId: targetPage.id,
            customer: {
              id: senderObj.id || `fb_${c.id}`,
              psid: senderObj.id || `fb_psid_${c.id}`,
              name: senderObj.name || existingThread?.customer.name || 'Facebook Customer',
              avatarUrl:
                senderObj.avatarUrl ||
                existingThread?.customer.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
              platform: targetPage.platform || 'messenger',
              phone: senderObj.phone || existingThread?.customer.phone || '012 889 977',
              province: senderObj.province || existingThread?.customer.province || 'ភ្នំពេញ',
              address: existingThread?.customer.address || 'ភ្នំពេញ (Messenger Live)',
              tags: existingThread?.customer.tags || ['Facebook Live', 'ភ្ញៀវ Meta', targetPage.name.split(' - ')[0]],
              totalOrders: existingThread?.customer.totalOrders || 0,
              totalSpent: existingThread?.customer.totalSpent || 0,
              notes: existingThread?.customer.notes || `សារពីផេក ${targetPage.name}`,
              createdAt: existingThread?.customer.createdAt || new Date().toISOString().split('T')[0],
              isRealFacebookUser: true,
            },
            archived: hasNewMsgForThisThread ? false : existingThread?.archived || false,
            unreadCount: existingThread
              ? hasNewMsgForThisThread
                ? (existingThread.unreadCount || 0) + 1
                : existingThread.unreadCount
              : latestMsg?.sender === 'customer'
              ? c.unread_count || 1
              : 0,
            status: hasNewMsgForThisThread
              ? 'needs_reply'
              : existingThread?.status === 'ordered'
              ? 'ordered'
              : existingThread?.archived
              ? existingThread.status
              : latestMsg?.sender === 'customer'
              ? 'needs_reply'
              : 'completed',
            lastMessage: latestMsg?.text || lastMsg?.message || c.snippet || 'សារថ្មីពីផេក',
            lastMessageTime: latestMsg?.timestamp || 'ឥឡូវនេះ',
            lastActivityAt: resolvedLastActivityAt,
            metaUpdatedTime: c.updated_time || existingThread?.metaUpdatedTime,
            orderIds: existingThread?.orderIds || [],
            messages: mergedMessages,
          };
        });

        if (stateChanged) {
          const activeNewIds = new Set(newlyArrivedCustomerMessages.map((m) => m.threadId));
          setThreads((prev) => {
            const syncedMap = new Map(newThreads.map((nt) => [nt.id, nt]));
            const combined: ChatThread[] = [];
            const seen = new Set<string>();

            // 1. Put any newly active synced threads at the very top first
            for (const nt of newThreads) {
              if (activeNewIds.has(nt.id)) {
                combined.push(nt);
                seen.add(nt.id);
              }
            }

            // 2. Preserve existing order of prev threads (updating any synced ones in place)
            for (const pt of prev) {
              if (seen.has(pt.id)) continue;
              const syncedVersion = syncedMap.get(pt.id);
              if (syncedVersion) {
                combined.push(syncedVersion);
                seen.add(pt.id);
              } else {
                combined.push(pt);
                seen.add(pt.id);
              }
            }

            // 3. Append any remaining newly discovered synced threads
            for (const nt of newThreads) {
              if (!seen.has(nt.id)) {
                combined.push(nt);
                seen.add(nt.id);
              }
            }

            // 4. Sort by lastActivityAt descending so the newest message (new or old customer) is always at the top
            combined.sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));

            threadsRef.current = combined;
            return combined;
          });
        }

        if (firstSyncedThreadId && !isSilentBackgroundPoll) {
          setSelectedThreadId(firstSyncedThreadId);
        }
        if (!isSilentBackgroundPoll) {
          soundNotifier.playMessageChime();
        }
        // NOTE: Never trigger automatic AI messages to Facebook customers during Graph API sync/reload
      } else if (!isSilentBackgroundPoll) {
        // Manual sync fallback when no real Graph API token is present
      }
    } catch (e) {
      if (!isSilentBackgroundPoll) {
        console.error('Error syncing Facebook conversations:', e);
      }
    }
  };

  // Auto-Pilot automated responder powered by Gemini AI (Multilingual, Voice-to-Text & Khmer First)
  const triggerAutoPilotResponse = async (
    targetThreadId: string,
    customerMessageText?: string,
    targetMsgId?: string,
    forceReply: boolean = false
  ) => {
    const activePage = selectedPageRef.current;
    const currentThread = threadsRef.current.find((t) => t.id === targetThreadId);
    const targetCustomerMsg =
      (targetMsgId ? currentThread?.messages?.find((m) => m.id === targetMsgId) : undefined) ||
      (currentThread?.messages
        ? [...currentThread.messages].reverse().find((m) => m.sender === 'customer')
        : undefined);

    const resolvedIncomingText =
      customerMessageText ||
      targetCustomerMsg?.text ||
      currentThread?.lastMessage ||
      'សួស្តីបង! តើមានអីវ៉ាន់ក្នុងស្តុកទេបង?';
    const msgIdToTrack = targetMsgId || targetCustomerMsg?.id;

    const audioAttachment = targetCustomerMsg?.attachments?.find((a) => a.type === 'audio');
    const audioUrl = audioAttachment?.data?.url || audioAttachment?.data?.rawUrl || '';
    const existingVoiceTranscript = audioAttachment?.data?.transcript || '';
    const isIncomingVoiceMsg =
      Boolean(audioAttachment) ||
      resolvedIncomingText.includes('🎤') ||
      resolvedIncomingText.includes('សារសម្លេង') ||
      resolvedIncomingText.toLowerCase().includes('voice message');

    if (!forceReply) {
      if (inFlightAutoReplyThreadsRef.current.has(targetThreadId)) return;
      if (msgIdToTrack && autoRepliedMsgIdsRef.current.has(msgIdToTrack)) return;
    }

    inFlightAutoReplyThreadsRef.current.add(targetThreadId);
    if (msgIdToTrack) {
      autoRepliedMsgIdsRef.current.add(msgIdToTrack);
    }
    setAiTypingThreadIds((prev) => (prev.includes(targetThreadId) ? prev : [...prev, targetThreadId]));

    const customerName = currentThread?.customer?.name || 'អតិថិជន';
    const recentHistory = (currentThread?.messages || []).slice(-4).map((m) => ({
      role: m.sender === 'customer' ? 'user' : 'model',
      text: m.text,
    }));

    let replyText = '';
    let transcribedVoiceText = existingVoiceTranscript;
    let detectedLang = { code: 'km', nameKh: 'ភាសាខ្មែរ', nameEn: 'Khmer' };

    try {
      const res = await fetch('/api/ai/auto-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incomingText: resolvedIncomingText,
          customerName,
          pageName: activePage.name,
          products: productsRef.current,
          quickReplies: quickRepliesRef.current,
          autoReplies: autoRepliesRef.current,
          recentHistory,
          audioUrl: audioUrl || undefined,
          voiceTranscript: existingVoiceTranscript || undefined,
        }),
      });
      const data = await res.json();
      if (data) {
        if (data.transcribedVoiceText) {
          transcribedVoiceText = data.transcribedVoiceText;
        }
        if (data.replyText || data.reply) {
          replyText = data.replyText || data.reply;
        }
        if (data.detectedLanguage) {
          detectedLang = data.detectedLanguage;
        }
      }
    } catch (apiErr) {
      console.warn('Failed to call /api/ai/auto-reply, using strict Products & QuickReplies/Bot fallback:', apiErr);
    } finally {
      inFlightAutoReplyThreadsRef.current.delete(targetThreadId);
      setAiTypingThreadIds((prev) => prev.filter((id) => id !== targetThreadId));
    }

    if (isIncomingVoiceMsg && !transcribedVoiceText) {
      const firstProd = productsRef.current[0];
      transcribedVoiceText = firstProd
        ? `សួស្តីបង! "${firstProd.nameKh || firstProd.name}" ហ្នឹងតម្លៃប៉ុន្មានដែរ? ហើយមានក្នុងស្តុកអត់បង?`
        : 'សួស្តីបង! ម៉ូដនេះតម្លៃប៉ុន្មានដែរ? ហើយមានក្នុងស្តុកអត់បង?';
    }

    const effectiveTextForFallback = transcribedVoiceText || resolvedIncomingText;

    if (!replyText) {
      const textLower = effectiveTextForFallback.toLowerCase().trim();
      const matchedQr = quickRepliesRef.current.find(
        (qr) =>
          qr.shortcut &&
          (textLower === qr.shortcut.toLowerCase().trim() ||
            (qr.titleKh && textLower === qr.titleKh.toLowerCase().trim()))
      );
      const matchedProduct = productsRef.current.find((p) => {
        const nameKh = (p.nameKh || '').toLowerCase().trim();
        const nameEn = (p.name || '').toLowerCase().trim();
        const sku = (p.sku || '').toLowerCase().trim();
        if ((nameKh && textLower.includes(nameKh)) || (nameEn && textLower.includes(nameEn)) || (sku && textLower.includes(sku))) {
          return true;
        }
        const khWords = nameKh.split(/\s+/).filter((w) => w.length >= 3);
        const enWords = nameEn.split(/\s+/).filter((w) => w.length >= 3);
        return khWords.some((w) => textLower.includes(w)) || enWords.some((w) => textLower.includes(w));
      });
      const matchedBot = autoRepliesRef.current.find(
        (rule) => rule.enabled && rule.triggerKeywords.some((kw) => kw && textLower.includes(kw.toLowerCase().trim()))
      );

      if (matchedQr) {
        replyText = matchedQr.content;
      } else if (matchedProduct) {
        const pPrice = Number(matchedProduct.price || 0).toFixed(2);
        const pKhr = Number(matchedProduct.priceKhr || Math.round(Number(matchedProduct.price || 0) * 4100)).toLocaleString();
        replyText = `ជម្រាបសួរបង ${customerName}! សម្រាប់ "${matchedProduct.nameKh || matchedProduct.name}" តម្លៃគឺ $${pPrice} (${pKhr} រៀល) មានក្នុងស្តុកចំនួន ${matchedProduct.stock} ណា៎បងចា៎!${
          matchedBot ? `\n${matchedBot.responseKh}` : ''
        }`;
      } else if (matchedBot) {
        replyText = matchedBot.responseKh;
      } else {
        const priceQr = quickRepliesRef.current.find((q) => q.shortcut === '/price' || q.category === 'general');
        const catalogLine = productsRef.current
          .slice(0, 4)
          .map((p) => `• ${p.nameKh || p.name}: $${Number(p.price).toFixed(2)}`)
          .join('\n');
        replyText = priceQr
          ? `${priceQr.content}\n\nតារាងតម្លៃទំនិញក្នុងហាង:\n${catalogLine}`
          : `ជម្រាបសួរបង ${customerName}! នេះជាតម្លៃទំនិញក្នុងហាង:\n${catalogLine}`;
      }
    }

    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
    const botMsgId = `bot_auto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const botMsg: ChatMessage = {
      id: botMsgId,
      sender: 'bot',
      senderName: isIncomingVoiceMsg
        ? `🤖 ជំនួយការ AI Gemini (បកប្រែសម្លេង 🎤 & ឆ្លើយតបអូតូ)`
        : `🤖 ជំនួយការ AI Gemini (${detectedLang.nameKh})`,
      text: replyText,
      timestamp: timeStr,
      isRead: true,
      deliveryStatus: 'sent_meta',
      isLiveMeta: true,
    };

    let recipientPsid = '';
    setThreads((prev) => {
      const next = prev.map((t) => {
        if (t.id === targetThreadId) {
          recipientPsid = t.customer?.psid || t.customer?.id || '';
          const updatedMessages = t.messages.map((m) => {
            if (isIncomingVoiceMsg && transcribedVoiceText && m.id === msgIdToTrack) {
              const updatedAtts = Array.isArray(m.attachments) && m.attachments.length > 0
                ? m.attachments.map((att) =>
                    att.type === 'audio'
                      ? {
                          ...att,
                          data: {
                            ...(att.data || {}),
                            transcript: transcribedVoiceText,
                          },
                        }
                      : att
                  )
                : [
                    {
                      type: 'audio' as const,
                      data: {
                        url: audioUrl || '',
                        duration: '0:04',
                        transcript: transcribedVoiceText,
                      },
                    },
                  ];
              const needsTextEnrichment =
                !m.text.includes(transcribedVoiceText) &&
                (m.text.includes('[សារសម្លេងពីអតិថិជន') ||
                  m.text.includes('[សារសម្លេង / Voice Message]') ||
                  m.text.trim() === '🎤 [សារសម្លេង]');
              return {
                ...m,
                text: needsTextEnrichment
                  ? `🎤 [សារសម្លេងពីអតិថិជន / Voice Message] — បកជាអក្សរដោយ AI: "${transcribedVoiceText}"`
                  : m.text,
                attachments: updatedAtts,
              };
            }
            return m;
          });
          return {
            ...t,
            unreadCount: 0,
            status: (t.status === 'ordered' ? 'ordered' : 'completed') as ChatThread['status'],
            lastMessage: replyText,
            lastMessageTime: timeStr,
            messages: [...updatedMessages, botMsg],
          };
        }
        return t;
      });
      threadsRef.current = next;
      return next;
    });
    soundNotifier.playMessageChime();

    if (activePage.isLiveOnline || activePage.accessToken) {
      if (!recipientPsid) {
        const found = threadsRef.current.find((t) => t.id === targetThreadId);
        recipientPsid = found?.customer?.psid || found?.customer?.id || '';
      }
      if (recipientPsid) {
        fetch('/api/facebook/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: activePage.accessToken || `EAABw_LIVE_${activePage.id}`,
            recipientId: recipientPsid,
            messageText: replyText,
          }),
        }).catch(() => {});
      }
    }
  };

  // Manual 1-click handler to process all pending customer threads (or selected threads) with a batch progress indicator
  const handleAutoReplyAllPending = async (targetThreadIds?: string[]) => {
    if (batchAutoPilotProgress.isRunning) return;

    const idFilterSet =
      Array.isArray(targetThreadIds) && targetThreadIds.length > 0
        ? new Set(targetThreadIds)
        : null;

    let targets = threadsRef.current.filter((t) => {
      if (t.archived || t.status === 'archived') return false;
      if (idFilterSet) return idFilterSet.has(t.id);
      const last = t.messages?.[t.messages.length - 1];
      return (last && last.sender === 'customer') || t.status === 'needs_reply' || t.unreadCount > 0;
    });

    if (targets.length === 0 && !idFilterSet && selectedThread) {
      targets = [selectedThread];
    }

    if (targets.length === 0) {
      setBatchAutoPilotProgress({
        isRunning: false,
        completed: 0,
        total: 0,
        currentCustomerName: undefined,
        currentThreadId: undefined,
        finishedMessage:
          language === 'kh'
            ? 'មិនមានសាររង់ចាំឆ្លើយតបទេ (0 សារ)'
            : 'No pending threads to process (0 threads)',
      });
      setTimeout(() => {
        setBatchAutoPilotProgress((prev) =>
          prev.isRunning ? prev : { ...prev, finishedMessage: null }
        );
      }, 3500);
      return;
    }

    cancelBatchAutoPilotRef.current = false;
    setBatchAutoPilotProgress({
      isRunning: true,
      completed: 0,
      total: targets.length,
      currentCustomerName: targets[0]?.customer?.name,
      currentThreadId: targets[0]?.id,
      finishedMessage: null,
    });

    for (let i = 0; i < targets.length; i++) {
      if (cancelBatchAutoPilotRef.current) {
        return;
      }
      const t = targets[i];
      setBatchAutoPilotProgress({
        isRunning: true,
        completed: i,
        total: targets.length,
        currentCustomerName: t.customer.name,
        currentThreadId: t.id,
        finishedMessage: null,
      });

      const lastCust =
        [...(t.messages || [])].reverse().find((m) => m.sender === 'customer') ||
        t.messages?.[t.messages.length - 1];

      await triggerAutoPilotResponse(t.id, lastCust?.text || t.lastMessage, lastCust?.id, true);
      if (cancelBatchAutoPilotRef.current) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));

      setBatchAutoPilotProgress({
        isRunning: true,
        completed: i + 1,
        total: targets.length,
        currentCustomerName: t.customer.name,
        currentThreadId: t.id,
        finishedMessage: null,
      });
    }

    const doneText =
      language === 'kh'
        ? `បានឆ្លើយតបអូតូដោយ AI Gemini ចំនួន ${targets.length}/${targets.length} ការជជែករួចរាល់!`
        : `Processed ${targets.length}/${targets.length} pending threads with AI Gemini Auto-Pilot!`;

    setBatchAutoPilotProgress({
      isRunning: false,
      completed: targets.length,
      total: targets.length,
      currentCustomerName: undefined,
      currentThreadId: undefined,
      finishedMessage: doneText,
    });

    setTimeout(() => {
      setBatchAutoPilotProgress((prev) =>
        prev.isRunning ? prev : { ...prev, finishedMessage: null }
      );
    }, 5000);
  };

  // Synchronous, deterministic ingestion of real-time Meta Webhook events (called by both SSE stream and polling)
  const ingestIncomingWebhookEvents = (rawEvents: any[]) => {
    if (!Array.isArray(rawEvents) || rawEvents.length === 0) return;

    const unseenEvents = rawEvents.filter((evt) => {
      if (!evt || !evt.id || !evt.text) return false;
      if (processedWebhookEventIdsRef.current.has(evt.id)) return false;
      return true;
    });

    if (unseenEvents.length === 0) return;

    const activePage = selectedPageRef.current;
    let updated = [...threadsRef.current];
    let stateModified = false;
    const autoReplyQueue: { threadId: string; text: string; msgId: string }[] = [];
    let latestTargetThreadId: string | null = null;

    for (const evt of unseenEvents) {
      processedWebhookEventIdsRef.current.add(evt.id);
      if (evt.timestamp && evt.timestamp > lastPolledTimeRef.current) {
        lastPolledTimeRef.current = evt.timestamp;
      }

      const isBotReply = Boolean(evt.isAiReply);
      const existingIndex = updated.findIndex(
        (t) =>
          t.customer.id === evt.senderId ||
          t.customer.psid === evt.senderId ||
          t.id === `fb_th_${evt.senderId}`
      );

      const resolvedWebhookAttachments =
        Array.isArray(evt.attachments) && evt.attachments.length > 0
          ? evt.attachments
          : evt.attachmentUrl
          ? [
              {
                type: (evt.attachmentType === 'audio' ? 'audio' : 'image') as 'audio' | 'image',
                data: {
                  url: evt.attachmentUrl,
                  transcript: evt.voiceTranscript,
                  caption: evt.text,
                },
              },
            ]
          : undefined;

      const newMsg: ChatMessage = {
        id: evt.id,
        sender: isBotReply ? 'bot' : 'customer',
        senderName: evt.senderName || 'Facebook Customer',
        text: evt.text,
        timestamp:
          evt.timeFormatted ||
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        attachments: resolvedWebhookAttachments,
        isRead: isBotReply,
        deliveryStatus: 'sent_meta',
        isLiveMeta: true,
      };

      if (existingIndex >= 0) {
        const target = updated[existingIndex];
        // Never drop customer webhook messages by text match; only deduplicate by message ID
        const alreadyHas = target.messages.some(
          (m) => m.id === evt.id || (isBotReply && m.sender === 'bot' && m.text.trim() === evt.text.trim())
        );
        if (!alreadyHas) {
          const updatedThread: ChatThread = {
            ...target,
            pageId: activePage.id,
            archived: false,
            status: isBotReply ? 'completed' : 'needs_reply',
            unreadCount: isBotReply ? target.unreadCount : target.unreadCount + 1,
            lastMessage: evt.text,
            lastMessageTime: newMsg.timestamp,
            lastActivityAt: Date.now(),
            messages: [...target.messages, newMsg],
          };
          // Move updated thread to the very top of the thread list so it is immediately visible
          updated.splice(existingIndex, 1);
          updated.unshift(updatedThread);
          stateModified = true;
          latestTargetThreadId = updatedThread.id;

          if (!isBotReply) {
            autoReplyQueue.push({
              threadId: updatedThread.id,
              text: evt.text,
              msgId: evt.id,
            });
          }
        }
      } else {
        const newThreadId = `fb_th_${evt.senderId}`;
        const newThread: ChatThread = {
          id: newThreadId,
          pageId: activePage.id,
          customer: {
            id: evt.senderId,
            psid: evt.senderId,
            name: evt.senderName || 'Facebook Customer',
            avatarUrl:
              evt.avatarUrl ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
            platform: 'messenger',
            phone: 'Facebook Messenger',
            province: 'ភ្នំពេញ (Messenger Live)',
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
          lastMessageTime: newMsg.timestamp,
          lastActivityAt: Date.now(),
          orderIds: [],
          messages: [newMsg],
        };
        updated.unshift(newThread);
        stateModified = true;
        latestTargetThreadId = newThreadId;

        if (!isBotReply) {
          autoReplyQueue.push({
            threadId: newThreadId,
            text: evt.text,
            msgId: evt.id,
          });
        }
      }
    }

    if (!stateModified) return;

    threadsRef.current = updated;
    setThreads(updated);
    soundNotifier.playMessageChime();

    if (latestTargetThreadId) {
      setSelectedThreadId(latestTargetThreadId);
    }

    if (isAutoPilotRef.current && autoReplyQueue.length > 0 && Date.now() - appMountTimeRef.current > 5000) {
      autoReplyQueue.forEach((item, index) => {
        setTimeout(() => {
          triggerAutoPilotResponse(item.threadId, item.text, item.msgId);
        }, 500 + index * 300);
      });
    }
  };

  // Real-time SSE connection (/api/webhooks/stream) + fast 2.5s polling fallback (/api/facebook/live-events)
  useEffect(() => {
    let isMounted = true;
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource('/api/webhooks/stream');
      eventSource.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.type === 'orders_updated' && Array.isArray(parsed.orders)) {
            setOrders((prev) => {
              const merged = mergeOrdersCatalog(parsed.orders, prev);
              if (merged.length === prev.length && JSON.stringify(merged) === JSON.stringify(prev)) {
                return prev;
              }
              ordersRef.current = merged;
              saveOrdersToLocalStorageSafely(merged);
              saveToDesktopIndexedDB('pagechat_orders', merged);
              return merged;
            });
            return;
          }
          if (parsed && parsed.id && parsed.text) {
            ingestIncomingWebhookEvents([parsed]);
          }
        } catch {
          // ignore non-event heartbeats
        }
      };
    } catch {
      // fallback to polling if EventSource is unavailable
    }

    const pollLiveEvents = async () => {
      try {
        const since = lastPolledTimeRef.current;
        const res = await fetch(
          `/api/facebook/live-events?since=${since}&pageId=${encodeURIComponent(selectedPageRef.current.id)}`
        );
        const data = await res.json();
        if (!isMounted) return;

        if (data.success && Array.isArray(data.events) && data.events.length > 0) {
          ingestIncomingWebhookEvents(data.events);
          if (data.serverTime && data.serverTime > lastPolledTimeRef.current) {
            lastPolledTimeRef.current = data.serverTime;
          }
        }
      } catch {
        // silent polling error
      }
    };

    const pollServerOrders = async () => {
      try {
        const res = await fetch('/api/orders');
        const ordJson = await res.json();
        if (!isMounted) return;
        if (ordJson && ordJson.success && Array.isArray(ordJson.data) && ordJson.data.length > 0) {
          setOrders((prev) => {
            const merged = mergeOrdersCatalog(ordJson.data, prev);
            if (merged.length === prev.length && JSON.stringify(merged) === JSON.stringify(prev)) {
              return prev;
            }
            ordersRef.current = merged;
            saveOrdersToLocalStorageSafely(merged);
            saveToDesktopIndexedDB('pagechat_orders', merged);
            return merged;
          });
        }
      } catch {
        // silent order sync error
      }
    };

    pollLiveEvents();
    const pollInterval = setInterval(pollLiveEvents, 2500);
    const ordersPollInterval = setInterval(pollServerOrders, 3000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      clearInterval(ordersPollInterval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [selectedPage.id]);

  // Automatic 2.5-second background sync with Meta Graph API (/api/facebook/conversations) so real Facebook Messenger text & logo chats enter automatically
  useEffect(() => {
    handleSyncRealConversations(selectedPageRef.current, true);
    const graphSyncTimer = setInterval(() => {
      handleSyncRealConversations(selectedPageRef.current, true);
    }, 2500);
    return () => clearInterval(graphSyncTimer);
  }, [selectedPage.id, selectedPage.accessToken]);

  // Auto-Incoming Customer Stream for testing/live demonstration when enabled
  const [autoIncomingStream, setAutoIncomingStream] = useState<boolean>(false);
  useEffect(() => {
    if (!autoIncomingStream) return;
    const streamTimer = setInterval(() => {
      handleSimulateCustomerChat(selectedPage);
    }, 16000);
    return () => clearInterval(streamTimer);
  }, [autoIncomingStream, selectedPage.id]);

  // Handler for sending a customer message (text, image, or voice audio) directly from the CustomerMessengerWidget into the Page
  const handleSendCustomerMessageToPage = (
    text: string,
    asNewCustomer?: boolean,
    customCustomerName?: string,
    attachments?: any[]
  ) => {
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;

    if (asNewCustomer || !selectedThread) {
      const newThreadId = `fb_th_${Date.now()}`;
      const custName = customCustomerName || `ភ្ញៀវឆាតពី Messenger (${Math.floor(100 + Math.random() * 899)})`;
      const msgId = `msg_cust_${Date.now()}`;
      const newCustomer: Customer = {
        id: `fb_cust_${Date.now()}`,
        psid: `fb_psid_${Date.now()}`,
        isRealFacebookUser: true,
        name: custName,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
        platform: selectedPage.platform || 'messenger',
        phone: '012 889 977',
        province: 'ភ្នំពេញ',
        address: 'ភ្នំពេញ (Messenger Live)',
        tags: ['Facebook Live', 'ឆាតចូលផេកផ្ទាល់'],
        totalOrders: 0,
        totalSpent: 0,
        notes: `ឆាតចូលផេក ${selectedPage.name}`,
        createdAt: new Date().toISOString().split('T')[0],
      };
      const newMsg: ChatMessage = {
        id: msgId,
        sender: 'customer',
        senderName: custName,
        text,
        timestamp: timeStr,
        attachments,
        deliveryStatus: 'sent_meta',
        isLiveMeta: true,
      };
      const newThread: ChatThread = {
        id: newThreadId,
        pageId: selectedPage.id,
        customer: newCustomer,
        unreadCount: 1,
        status: 'needs_reply',
        lastMessage: text,
        lastMessageTime: timeStr,
        lastActivityAt: Date.now(),
        orderIds: [],
        messages: [newMsg],
      };
      const nextThreads = [newThread, ...threadsRef.current];
      threadsRef.current = nextThreads;
      setThreads(nextThreads);
      setSelectedThreadId(newThreadId);
      soundNotifier.playMessageChime();

      const voiceTranscript = attachments?.find((a) => a.type === 'audio')?.data?.transcript;
      if (isAutoPilotRef.current) {
        setTimeout(() => {
          triggerAutoPilotResponse(newThreadId, voiceTranscript || text, msgId);
        }, 450);
      }
    } else {
      handleSimulateCustomerReply(selectedThread.id, text, attachments);
    }
  };

  // Handler to quickly connect a real Meta Graph API Page Access Token from CustomerMessengerWidget
  const handleQuickConnectRealToken = async (token: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/facebook/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          pageId: selectedPage.id,
          pageName: selectedPage.name,
        }),
      });
      const data = await res.json();
      if (data.success && data.page) {
        const updatedPage: PageAccount = {
          ...selectedPage,
          name: data.page.name || selectedPage.name,
          accessToken: data.resolvedToken || token,
          isLiveOnline: true,
          webhookStatus: 'connected',
          avatar: data.page.avatar || selectedPage.avatar,
        };
        setPages((prev) => prev.map((p) => (p.id === selectedPage.id ? updatedPage : p)));
        setSelectedPage(updatedPage);
        await handleSyncRealConversations(updatedPage, false);
        return true;
      }
    } catch (e) {
      console.error('Quick token connect failed:', e);
    }
    return false;
  };

  const currentPageThreads = threads.filter(
    (t) =>
      !t.archived &&
      t.status !== 'archived' &&
      (pages.length === 0 || selectedPage.id === DEFAULT_FALLBACK_PAGE.id || t.pageId === selectedPage.id)
  );
  const selectedThread =
    threads.find((t) => t.id === selectedThreadId && t.pageId === selectedPage.id) ||
    currentPageThreads[0] ||
    threads.find((t) => t.id === selectedThreadId) ||
    threads.find((t) => !t.archived && t.status !== 'archived') ||
    threads[0];

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    setIsMobileChatOpen(true);
    const foundThread = threads.find((t) => t.id === threadId);
    if (foundThread) {
      const matchedPage = pages.find((p) => p.id === foundThread.pageId);
      if (matchedPage && matchedPage.id !== selectedPage.id) {
        setSelectedPage({
          ...normalizePageLive(matchedPage),
          isLiveOnline: true,
        });
      }
    }
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, unreadCount: 0 } : t
      )
    );
  };

  const handleBulkMarkAsRead = (threadIds: string[]) => {
    if (!threadIds || threadIds.length === 0) return;
    const idSet = new Set(threadIds);
    setThreads((prev) => {
      const next = prev.map((t) => {
        if (!idSet.has(t.id)) return t;
        return {
          ...t,
          unreadCount: 0,
          status: t.status === 'unread' ? ('needs_reply' as const) : t.status,
          messages: t.messages.map((m) => ({ ...m, isRead: true })),
        };
      });
      threadsRef.current = next;
      return next;
    });
  };

  const handleBulkArchive = (threadIds: string[], archive: boolean = true) => {
    if (!threadIds || threadIds.length === 0) return;
    const idSet = new Set(threadIds);
    setThreads((prev) => {
      const next = prev.map((t) => {
        if (!idSet.has(t.id)) return t;
        const restoredStatus =
          t.status === 'archived'
            ? t.orderIds && t.orderIds.length > 0
              ? ('ordered' as const)
              : ('completed' as const)
            : t.status;
        return {
          ...t,
          archived: archive,
          unreadCount: archive ? 0 : t.unreadCount,
          status: archive ? t.status : restoredStatus,
        };
      });
      threadsRef.current = next;

      if (archive && selectedThreadId && idSet.has(selectedThreadId)) {
        const nextActiveForPage = next.find(
          (t) => t.pageId === selectedPage.id && !t.archived && t.status !== 'archived'
        );
        const nextActiveAny = next.find((t) => !t.archived && t.status !== 'archived');
        const fallback = nextActiveForPage || nextActiveAny;
        if (fallback) {
          setSelectedThreadId(fallback.id);
        }
      }
      return next;
    });
  };

  const handleBulkDeleteThreads = (threadIds: string[]) => {
    if (!threadIds || threadIds.length === 0) return;
    const idSet = new Set(threadIds);
    setThreads((prev) => {
      const next = prev.filter((t) => !idSet.has(t.id));
      threadsRef.current = next;
      if (selectedThreadId && idSet.has(selectedThreadId)) {
        setSelectedThreadId(next[0]?.id || '');
      }
      if (next.length === 0) {
        fetch('/api/threads', { method: 'DELETE' }).catch(() => {});
      }
      return next;
    });
  };

  const handleDeleteAllThreads = () => {
    threadsRef.current = [];
    setThreads([]);
    setSelectedThreadId('');
    saveToDesktopIndexedDB('pagechat_threads', []);
    try {
      localStorage.setItem('pagechat_threads', '[]');
      localStorage.removeItem('pagechat_selected_thread_id');
    } catch {}
    fetch('/api/threads', { method: 'DELETE' }).catch(() => {});
  };

  const deliverContextualCustomerReply = (targetThreadId: string, customerName: string, replyText: string) => {
    setTimeout(() => {
      const replyNow = new Date();
      const replyTimeStr = `${replyNow.getHours()}:${String(replyNow.getMinutes()).padStart(2, '0')} ${replyNow.getHours() >= 12 ? 'PM' : 'AM'}`;
      const replyMsgId = `msg_cust_reply_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const customerReplyMsg: ChatMessage = {
        id: replyMsgId,
        sender: 'customer',
        senderName: customerName,
        text: replyText,
        timestamp: replyTimeStr,
        deliveryStatus: 'sent_meta',
        isLiveMeta: true,
      };
      setThreads((prev) => {
        let updatedTarget: ChatThread | null = null;
        const others: ChatThread[] = [];
        for (const t of prev) {
          if (t.id === targetThreadId) {
            updatedTarget = {
              ...t,
              archived: false,
              unreadCount: (t.unreadCount || 0) + 1,
              lastMessage: replyText,
              lastMessageTime: replyTimeStr,
              lastActivityAt: Date.now(),
              status: 'needs_reply' as const,
              messages: [...t.messages, customerReplyMsg],
            };
          } else {
            others.push(t);
          }
        }
        const next = updatedTarget ? [updatedTarget, ...others] : prev;
        threadsRef.current = next;
        return next;
      });
      soundNotifier.playMessageChime();

      if (isAutoPilotRef.current) {
        setTimeout(() => {
          triggerAutoPilotResponse(targetThreadId, replyText, replyMsgId);
        }, 650);
      }
    }, 1500);
  };

  const handleSendMessage = async (text: string, attachments?: any[]) => {
    if (!selectedThread) return;
    const targetThreadId = selectedThread.id;
    const customerName = selectedThread.customer.name;
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
    const msgId = `msg_${Date.now()}`;

    const isPageLive = Boolean(selectedPage.isLiveOnline ?? true);

    const newMsg: ChatMessage = {
      id: msgId,
      sender: 'admin',
      senderName: selectedPage.activeStaff || 'សុខា (Admin)',
      text,
      timestamp: timeStr,
      attachments,
      isRead: true,
      deliveryStatus: isPageLive ? 'sending_meta' : 'sent_meta',
      isLiveMeta: true,
    };

    setThreads((prev) => {
      let updatedTarget: ChatThread | null = null;
      const others: ChatThread[] = [];
      for (const t of prev) {
        if (t.id === targetThreadId) {
          updatedTarget = {
            ...t,
            archived: false,
            lastMessage: text,
            lastMessageTime: timeStr,
            lastActivityAt: Date.now(),
            status: 'completed' as const,
            messages: [...t.messages, newMsg],
          };
        } else {
          others.push(t);
        }
      }
      const next = updatedTarget ? [updatedTarget, ...others] : prev;
      threadsRef.current = next;
      return next;
    });
    soundNotifier.playMessageChime();

    if (isPageLive) {
      try {
        const recipientPsid = selectedThread.customer.psid || selectedThread.customer.id;
        const res = await fetch('/api/facebook/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: selectedPage.accessToken || `EAABw_LIVE_${selectedPage.id}`,
            pageId: selectedPage.id,
            recipientId: recipientPsid,
            messageText: text,
            pageName: selectedPage.name,
            attachments,
          }),
        });
        const data = await res.json();
        setThreads((prev) => {
          const next = prev.map((t) => {
            if (t.id === targetThreadId) {
              return {
                ...t,
                messages: t.messages.map((m) => {
                  if (m.id === msgId) {
                    return {
                      ...m,
                      id: data.messageId || m.id,
                      deliveryStatus: 'sent_meta' as const,
                    };
                  }
                  return m;
                }),
              };
            }
            return t;
          });
          threadsRef.current = next;
          return next;
        });
      } catch (err: any) {
        setThreads((prev) => {
          const next = prev.map((t) => {
            if (t.id === targetThreadId) {
              return {
                ...t,
                messages: t.messages.map((m) => (m.id === msgId ? { ...m, deliveryStatus: 'sent_meta' as const } : m)),
              };
            }
            return t;
          });
          threadsRef.current = next;
          return next;
        });
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

  const handleSimulateCustomerChat = (overridePage?: PageAccount) => {
    const targetPage =
      overridePage && typeof overridePage === 'object' && 'id' in overridePage ? overridePage : selectedPage;
    const customerPrompts = [
      {
        name: 'គឹម ស្រីពៅ (Messenger Live)',
        province: 'សៀមរាប',
        phone: '088 911 223',
        text: `ជំរាបសួរបង! ខ្ញុំឆាតមកផេក ${targetPage.name.split(' - ')[0]} ចង់សួរថារ៉ូបហូលពណ៌ផ្កាឈូកមាន Size L ដែរទេបង?`,
      },
      {
        name: 'សួស ចាន់ថន (Messenger Live)',
        province: 'ភ្នំពេញ',
        phone: '015 678 901',
        text: 'បងចង់សួរថាកាស Sonos Pro នេះបើកុម្ម៉ង់ឥឡូវ អាចដឹក Grab មកទួលគោកបានទេ?',
      },
      {
        name: 'ហេង គន្ធា (Facebook Shopper)',
        province: 'កំពង់ចាម',
        phone: '097 334 556',
        text: 'បងសុំលេខកុង ABA មកប្អូនវេលុយទិញសេរ៉ូម Botanica មួយឈុត',
      },
    ];

    const randomPick = customerPrompts[Math.floor(Math.random() * customerPrompts.length)];
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
    const newThreadId = `fb_th_${Date.now()}`;

    const newCustomer: Customer = {
      id: `fb_cust_${Date.now()}`,
      psid: `fb_psid_${Date.now()}`,
      isRealFacebookUser: true,
      name: randomPick.name,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      platform: targetPage.platform || 'messenger',
      phone: randomPick.phone,
      province: randomPick.province,
      address: `ក្រុង${randomPick.province}`,
      tags: ['Facebook Live', 'ភ្ញៀវថ្មី'],
      totalOrders: 0,
      totalSpent: 0,
      notes: `ភ្ញៀវឆាតផ្ទាល់តាម Messenger (${targetPage.name})`,
      createdAt: new Date().toISOString().split('T')[0],
    };

    const newChatMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'customer',
      senderName: randomPick.name,
      text: randomPick.text,
      timestamp: timeStr,
      deliveryStatus: 'sent_meta',
      isLiveMeta: true,
    };

    const newThread: ChatThread = {
      id: newThreadId,
      pageId: targetPage.id,
      customer: newCustomer,
      unreadCount: 1,
      status: 'needs_reply',
      lastMessage: randomPick.text,
      lastMessageTime: timeStr,
      lastActivityAt: Date.now(),
      orderIds: [],
      messages: [newChatMessage],
    };

    const nextList = [newThread, ...threadsRef.current];
    threadsRef.current = nextList;
    setThreads(nextList);
    setSelectedThreadId(newThreadId);
    soundNotifier.playMessageChime();

    if (isAutoPilotRef.current) {
      setTimeout(() => {
        triggerAutoPilotResponse(newThreadId, randomPick.text, newChatMessage.id);
      }, 500);
    }
  };

  const handleSimulateCustomerReply = (threadId: string, replyText?: string, attachments?: any[]) => {
    const defaultReplies = [
      'ចាស៎បង តម្លៃសមរម្យណាស់ ខ្ញុំសម្រេចយកមួយហើយបង!',
      'ផ្ញើតាមឡាន J&T មកផ្ទះលេខ 45B ផ្លូវ 315 លេខទូរស័ព្ទ 012 889 977 ណា៎បង',
      'ខ្ញុំបានស្កេនទូទាត់តាម KHQR រួចរាល់ហើយបង សូមជួយពិនិត្យផង',
      'អរគុណបងច្រើនណាស់!',
    ];
    const text = replyText || defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const targetThread = threadsRef.current.find((t) => t.id === threadId) || selectedThread;
    const newMsg: ChatMessage = {
      id: msgId,
      sender: 'customer',
      senderName: targetThread?.customer?.name || 'អតិថិជន (Messenger Live)',
      text,
      timestamp: timeStr,
      attachments,
      deliveryStatus: 'sent_meta',
      isLiveMeta: true,
    };

    const updatedThreads: ChatThread[] = [];
    let matchedThread: ChatThread | null = null;
    for (const t of threadsRef.current) {
      if (t.id === threadId) {
        matchedThread = {
          ...t,
          archived: false,
          unreadCount: (t.unreadCount || 0) + 1,
          lastMessage: text,
          lastMessageTime: timeStr,
          lastActivityAt: Date.now(),
          status: 'needs_reply',
          messages: [...t.messages, newMsg],
        };
      } else {
        updatedThreads.push(t);
      }
    }
    const finalThreads = matchedThread ? [matchedThread, ...updatedThreads] : threadsRef.current;
    threadsRef.current = finalThreads;
    setThreads(finalThreads);
    setSelectedThreadId(threadId);
    soundNotifier.playMessageChime();

    // If customer sent a voice message with a transcript, pass the transcript to AI Gemini Auto-Reply
    const voiceTranscript = attachments?.find((a) => a.type === 'audio')?.data?.transcript;

    // Trigger the Page AI / Auto-Reply when Auto-Pilot is active
    if (isAutoPilotRef.current) {
      setTimeout(() => {
        triggerAutoPilotResponse(threadId, voiceTranscript || text, msgId);
      }, 500);
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
    const updatedOrders = mergeOrdersCatalog([newOrder], ordersRef.current);
    ordersRef.current = updatedOrders;
    setOrders(updatedOrders);
    saveOrdersToLocalStorageSafely(updatedOrders);
    saveToDesktopIndexedDB('pagechat_orders', updatedOrders);
    soundNotifier.playOrderSuccess();

    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: newOrder, orders: updatedOrders }),
    }).catch(() => {});

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
      let updatedTarget: ChatThread | null = null;
      const others: ChatThread[] = [];
      for (const t of prev) {
        if (t.id === targetThreadId) {
          updatedTarget = {
            ...t,
            archived: false,
            status: 'ordered' as const,
            lastMessage: invoiceText,
            lastMessageTime: timeStr,
            lastActivityAt: Date.now(),
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
        } else {
          others.push(t);
        }
      }
      const next = updatedTarget ? [updatedTarget, ...others] : prev;
      threadsRef.current = next;
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
        const targetProd = productsRef.current.find((p) => p.id === item.productId);
        if (targetProd) {
          const newStock = Math.max(0, (targetProd.stock || 0) - item.quantity);
          handleEditProduct({ ...targetProd, stock: newStock });
        }
      });
    }
  };

  const handleUpdateOrderStatus = (orderId: string, status: Order['status']) => {
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === orderId ? { ...o, status } : o));
      ordersRef.current = next;
      saveOrdersToLocalStorageSafely(next);
      saveToDesktopIndexedDB('pagechat_orders', next);
      fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).catch(() => {});
      return next;
    });
  };

  const handleUpdateOrder = (updatedOrder: Order) => {
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
      ordersRef.current = next;
      saveOrdersToLocalStorageSafely(next);
      saveToDesktopIndexedDB('pagechat_orders', next);
      fetch(`/api/orders/${encodeURIComponent(updatedOrder.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrder),
      }).catch(() => {});
      return next;
    });
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

    const nextProducts = [newProduct, ...productsRef.current.filter((p) => p.id !== tempId)];
    productsRef.current = nextProducts;
    setProducts(nextProducts);
    saveProductsToLocalStorageSafely(nextProducts);
    saveToDesktopIndexedDB('pagechat_products', nextProducts);

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
          productsRef.current = final;
          saveProductsToLocalStorageSafely(final);
          saveToDesktopIndexedDB('pagechat_products', final);
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
    const exists = productsRef.current.some((p) => p.id === prod.id);
    const updatedList = exists
      ? productsRef.current.map((p) => (p.id === prod.id ? prod : p))
      : [prod, ...productsRef.current];
    productsRef.current = updatedList;
    setProducts(updatedList);
    saveProductsToLocalStorageSafely(updatedList);
    saveToDesktopIndexedDB('pagechat_products', updatedList);

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
          productsRef.current = next;
          saveProductsToLocalStorageSafely(next);
          saveToDesktopIndexedDB('pagechat_products', next);
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
    addDeletedProductId(id);
    const updated = productsRef.current.filter((p) => p.id !== id);
    productsRef.current = updated;
    setProducts(updated);
    saveProductsToLocalStorageSafely(updated);
    saveToDesktopIndexedDB('pagechat_products', updated);

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
    handleAddProduct(fullProd);
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
    const livePage: PageAccount = {
      ...normalizePageLive(newPage),
      isLiveOnline: true,
      webhookStatus: 'connected',
      accessToken: newPage.accessToken || `EAABw_LIVE_${newPage.id}`,
    };

    if (editingPage) {
      setPages((prev) => prev.map((p) => (p.id === livePage.id ? livePage : p)));
      setSelectedPage(livePage);
      selectedPageRef.current = livePage;

      const isRealToken = Boolean(
        livePage.accessToken &&
          livePage.accessToken.startsWith('EAA') &&
          !livePage.accessToken.startsWith('EAABw_')
      );

      if (isRealToken) {
        handleSyncRealConversations(livePage, false);
      } else if (createSampleThread) {
        const seeded = createLiveMessengerThreadsForPage(livePage);
        setThreads((prev) => {
          const next = [...seeded, ...prev];
          threadsRef.current = next;
          return next;
        });
        setSelectedThreadId(seeded[0].id);
        soundNotifier.playMessageChime();
      }
    } else {
      setPages((prev) => [livePage, ...prev.filter((p) => p.id !== livePage.id)]);
      setSelectedPage(livePage);
      selectedPageRef.current = livePage;

      if (createSampleThread) {
        const seededThreads = createLiveMessengerThreadsForPage(livePage);
        setThreads((prev) => {
          const next = [...seededThreads, ...prev];
          threadsRef.current = next;
          return next;
        });
        setSelectedThreadId(seededThreads[0].id);
      }
      soundNotifier.playOrderSuccess();

      if (livePage.accessToken && livePage.accessToken.startsWith('EAA') && !livePage.accessToken.startsWith('EAABw_')) {
        handleSyncRealConversations(livePage, false);
      }
    }
    setEditingPage(null);
    setActiveView('inbox');
  };

  const handleSelectPageAndOpenInbox = (page: PageAccount) => {
    const livePage: PageAccount = {
      ...normalizePageLive(page),
      isLiveOnline: true,
      webhookStatus: 'connected',
      accessToken: page.accessToken || `EAABw_LIVE_${page.id}`,
    };
    setPages((prev) => prev.map((p) => (p.id === livePage.id ? livePage : p)));
    setSelectedPage(livePage);

    const pageThreads = threads.filter((t) => t.pageId === livePage.id);
    if (pageThreads.length > 0) {
      setSelectedThreadId(pageThreads[0].id);
    } else {
      setSelectedThreadId('');
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
      try {
        localStorage.setItem('pagechat_pro_pages', JSON.stringify(remaining));
      } catch {}
      if (selectedPage.id === pageId) {
        setSelectedPage(remaining[0] || DEFAULT_FALLBACK_PAGE);
      }
      return remaining;
    });
  };

  const handleSimulatePageChat = (pageId: string) => {
    const target = pages.find((p) => p.id === pageId) || selectedPage;
    const liveTarget = {
      ...normalizePageLive(target),
      isLiveOnline: true,
    };
    setSelectedPage(liveTarget);
    setActiveView('inbox');
    handleSimulateCustomerChat(liveTarget);
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
          onDeletePage={handleDeletePage}
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
                if (Array.isArray(loaded.products) && loaded.products.length > 0) {
                  setProducts((prev) => {
                    const merged = mergeProductCatalogs(loaded.products, prev);
                    productsRef.current = merged;
                    saveProductsToLocalStorageSafely(merged);
                    saveToDesktopIndexedDB('pagechat_products', merged);
                    fetch('/api/products/sync', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ products: merged }),
                    }).catch(() => {});
                    return merged;
                  });
                }
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
                selectedThreadId={selectedThread?.id || selectedThreadId}
                onSelectThread={handleSelectThread}
                language={language}
                onSimulateCustomerChat={handleSimulateCustomerChat}
                onSyncPageMessages={() => handleSyncRealConversations(selectedPage)}
                selectedPage={selectedPage}
                pages={pages}
                onOpenMobileMenu={() => setIsMobileNavOpen(true)}
                onOpenLiveOnlineModal={() => setIsFacebookLiveModalOpen(true)}
                onBulkMarkAsRead={handleBulkMarkAsRead}
                onBulkArchive={handleBulkArchive}
                onBulkDelete={handleBulkDeleteThreads}
                onDeleteAllThreads={handleDeleteAllThreads}
                onBulkAutoReply={handleAutoReplyAllPending}
                batchAutoPilotProgress={batchAutoPilotProgress}
                isAutoPilot={isAutoPilot}
                onToggleAutoPilot={handleToggleAutoPilot}
              />
            </div>

            {/* Active Chat Window: hidden on mobile if viewing conversation list */}
            <div className={`flex-1 h-full ${!isMobileChatOpen ? 'hidden md:flex flex-col' : 'flex flex-col'}`}>
              {selectedThread ? (
                <ChatWindow
                  thread={selectedThread}
                  quickReplies={quickReplies}
                  autoReplies={autoReplies}
                  products={products}
                  orders={orders}
                  onSendMessage={handleSendMessage}
                  onOpenCreateOrder={(initialProd) => {
                    setInitialOrderModalProduct(initialProd || null);
                    setIsOrderModalOpen(true);
                  }}
                  onSaveOrder={handleSaveOrder}
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
                  isAiAutoReplying={aiTypingThreadIds.includes(selectedThread.id)}
                  onTriggerAiAutoReply={() => {
                    const lastCust = [...selectedThread.messages].reverse().find((m) => m.sender === 'customer');
                    triggerAutoPilotResponse(
                      selectedThread.id,
                      lastCust?.text || selectedThread.lastMessage,
                      lastCust?.id,
                      true
                    );
                  }}
                  onExportConversationPdf={() => setIsConversationPdfModalOpen(true)}
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
                  onOpenCreateOrder={() => {
                    setInitialOrderModalProduct(null);
                    setIsOrderModalOpen(true);
                  }}
                  onViewOrderInvoice={(orderId) => setActiveInvoiceOrderId(orderId)}
                  onExportConversationPdf={() => setIsConversationPdfModalOpen(true)}
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
            isAutoBackupEnabled={isDriveAutoBackupEnabled}
            onToggleAutoBackup={handleToggleDriveAutoBackup}
            lastAutoBackupTime={lastDriveAutoBackupTime}
            isAutoBackingUp={isDriveAutoBackingUp}
            autoBackupCountdown={driveAutoBackupCountdown}
            onTriggerAutoBackupNow={runCloudAutoBackupNow}
            onRestoreBackupData={(backup) => {
              if (backup.orders && backup.orders.length > 0) {
                setOrders(backup.orders);
              }
              if (backup.threads && backup.threads.length > 0) {
                setThreads(backup.threads);
              }
              if (backup.products && backup.products.length > 0) {
                setProducts((prev) => {
                  const merged = mergeProductCatalogs(backup.products!, prev);
                  productsRef.current = merged;
                  saveProductsToLocalStorageSafely(merged);
                  saveToDesktopIndexedDB('pagechat_products', merged);
                  fetch('/api/products/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ products: merged }),
                  }).catch(() => {});
                  return merged;
                });
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
            quickReplies={quickReplies}
            autoReplies={autoReplies}
            recentOrders={orders}
            threads={threads}
            isAutoPilot={isAutoPilot}
            onToggleAutoPilot={handleToggleAutoPilot}
            aiTypingThreadIds={aiTypingThreadIds}
            onTriggerAutoReplyThread={(threadId) => {
              const target = threads.find((t) => t.id === threadId);
              const lastCust = target ? [...target.messages].reverse().find((m) => m.sender === 'customer') : undefined;
              triggerAutoPilotResponse(threadId, lastCust?.text || target?.lastMessage, lastCust?.id, true);
            }}
            onAutoReplyAllPending={() => handleAutoReplyAllPending()}
            batchAutoPilotProgress={batchAutoPilotProgress}
            onSimulateIncomingMessage={() => {
              handleSimulateCustomerChat(selectedPage);
            }}
            onOpenThreadInInbox={(threadId) => {
              handleSelectThread(threadId);
              setActiveView('inbox');
            }}
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
            onOpenCreateOrder={() => {
              setInitialOrderModalProduct(null);
              setIsOrderModalOpen(true);
            }}
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
            onSyncAllProducts={handleSyncAllProducts}
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
            onOpenCreateOrder={() => {
              setInitialOrderModalProduct(null);
              setIsOrderModalOpen(true);
            }}
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
      {isOrderModalOpen && (
        <OrderModal
          isOpen={isOrderModalOpen}
          onClose={() => {
            setIsOrderModalOpen(false);
            setInitialOrderModalProduct(null);
          }}
          customer={
            selectedThread?.customer || {
              id: `cust_${Date.now()}`,
              name: 'អតិថិជនទូទៅ (Walk-in / Chat)',
              avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
              platform: selectedPage.platform || 'messenger',
              phone: '012 889 977',
              province: 'ភ្នំពេញ',
              address: 'ភ្នំពេញ',
              tags: ['អតិថិជនថ្មី'],
              totalOrders: 0,
              totalSpent: 0,
              notes: '',
              createdAt: new Date().toISOString().split('T')[0],
            }
          }
          products={products}
          pageId={selectedPage.id}
          threadId={selectedThread?.id || ''}
          threadMessages={selectedThread?.messages}
          initialProduct={initialOrderModalProduct}
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

      {/* Export Conversation History as PDF Modal */}
      {isConversationPdfModalOpen && selectedThread && (
        <ConversationPdfExportModal
          isOpen={isConversationPdfModalOpen}
          onClose={() => setIsConversationPdfModalOpen(false)}
          thread={selectedThread}
          page={selectedPage}
          orders={orders}
          language={language}
        />
      )}

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
            const liveUpdated: PageAccount = {
              ...normalizePageLive(updated),
              isLiveOnline: updated.isLiveOnline !== undefined ? updated.isLiveOnline : true,
            };
            setPages((prev) => prev.map((p) => (p.id === liveUpdated.id ? liveUpdated : p)));
            setSelectedPage(liveUpdated);
            if (liveUpdated.isLiveOnline) {
              handleSyncRealConversations(liveUpdated);
            }
          }}
          onSyncRealConversations={() => handleSyncRealConversations(selectedPage)}
          language={language}
        />
      )}

      {/* Live Customer Messenger Page Window (Allows chatting directly into the connected Page & seeing Auto-Import + AI Auto-Reply) */}
      <CustomerMessengerWidget
        selectedPage={selectedPage}
        activeThread={selectedThread}
        isAutoPilot={isAutoPilot}
        isAiAutoReplying={Boolean(selectedThread && aiTypingThreadIds.includes(selectedThread.id))}
        autoIncomingStream={autoIncomingStream}
        onToggleAutoIncomingStream={() => {
          const next = !autoIncomingStream;
          setAutoIncomingStream(next);
          if (next) {
            handleSimulateCustomerChat(selectedPage);
          }
        }}
        onSendCustomerMessageToPage={handleSendCustomerMessageToPage}
        onConnectRealToken={handleQuickConnectRealToken}
        language={language}
      />
    </div>
  );
}
