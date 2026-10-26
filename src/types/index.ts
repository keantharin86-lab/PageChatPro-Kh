export type PlatformType = 'messenger' | 'telegram' | 'tiktok' | 'instagram';
export type ThreadStatus = 'all' | 'unread' | 'needs_reply' | 'ordered' | 'completed' | 'vip' | 'archived';
export type OrderStatus = 'pending' | 'confirmed' | 'packaging' | 'shipping' | 'shipped' | 'delivered' | 'cancelled';

export interface ProductItem {
  id: string;
  name: string;
  nameKh: string;
  price: number;
  priceKhr: number;
  stock: number;
  sku: string;
  category: string;
  imageUrl: string;
  description: string;
}

export interface OrderLineItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerProvince: string;
  items: OrderLineItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  totalKhr: number;
  paymentMethod: 'aba_khqr' | 'cod' | 'wing' | 'cash';
  deliveryProvider: 'jt' | 'virak_buntham' | 'capitol' | 'grab';
  status: OrderStatus;
  createdAt: string;
  orderDate?: string; // YYYY-MM-DD format for daily/monthly analytics
  pageId: string;
  threadId: string;
  notes?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'customer' | 'admin' | 'bot';
  senderName: string;
  text: string;
  timestamp: string;
  createdAtMs?: number;
  attachments?: {
    type: 'image' | 'product' | 'order_invoice' | 'audio' | 'khqr_card';
    data: any;
  }[];
  isRead?: boolean;
  isEdited?: boolean;
  editedAt?: string;
  deliveryStatus?: 'sent_local' | 'sending_meta' | 'sent_meta' | 'failed_meta';
  metaError?: string;
  isLiveMeta?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  avatarUrl: string;
  platform: PlatformType;
  phone: string;
  province: string;
  address: string;
  tags: string[];
  totalOrders: number;
  totalSpent: number;
  notes: string;
  createdAt: string;
  psid?: string;
  isRealFacebookUser?: boolean;
}

export interface ChatThread {
  id: string;
  pageId: string;
  customer: Customer;
  unreadCount: number;
  status: 'unread' | 'needs_reply' | 'ordered' | 'completed' | 'archived';
  archived?: boolean;
  lastMessage: string;
  lastMessageTime: string;
  lastActivityAt?: number;
  metaUpdatedTime?: string;
  messages: ChatMessage[];
  assignedAdmin?: string;
  orderIds: string[];
}

export interface QuickReplyTemplate {
  id: string;
  shortcut: string; // e.g. /price, /aba, /ship
  title: string;
  titleKh: string;
  content: string;
  category: 'general' | 'payment' | 'delivery' | 'greeting';
}

export interface AutoReplyRule {
  id: string;
  enabled: boolean;
  triggerKeywords: string[];
  responseKh: string;
  responseEn?: string;
  matchType: 'contains' | 'exact';
}

export interface PageAccount {
  id: string;
  name: string;
  category: string;
  avatar: string;
  unreadCount: number;
  platform: PlatformType;
  followerCount: string;
  activeStaff: string;
  pageIdOrUsername?: string;
  webhookStatus?: 'connected' | 'pending' | 'disconnected';
  accessToken?: string;
  isLiveOnline?: boolean;
  connectedAt?: string;
  description?: string;
  phone?: string;
}

export interface BatchAutoPilotProgress {
  isRunning: boolean;
  completed: number;
  total: number;
  currentCustomerName?: string;
  currentThreadId?: string;
  finishedMessage?: string | null;
}

