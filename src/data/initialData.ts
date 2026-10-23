import { PageAccount, ProductItem, QuickReplyTemplate, AutoReplyRule, ChatThread, Order } from '../types';

export const INITIAL_PAGES: PageAccount[] = [];


export const INITIAL_PRODUCTS: ProductItem[] = [];

export const INITIAL_QUICK_REPLIES: QuickReplyTemplate[] = [
  {
    id: 'qr_1',
    shortcut: '/price',
    title: 'តម្លៃផលិតផល និងប្រូម៉ូសិន',
    titleKh: 'តម្លៃ & ប្រូម៉ូសិន',
    content: 'ជំរាបសួរបង! ម៉ូដនេះតម្លៃពេញ $38.00 (ឥឡូវប្រូម៉ូសិនសល់ត្រឹម $34.00 ប៉ុណ្ណោះបង) មានទំហំ S, M, L, XL ពេញស្តុកបងចា៎!',
    category: 'general',
  },
  {
    id: 'qr_2',
    shortcut: '/aba',
    title: 'គណនីធនាគារ ABA & KHQR',
    titleKh: 'ABA / KHQR',
    content: 'បងអាចវេលុយតាម ABA ឬស្កេន KHQR ខាងក្រោមនេះបានបង:\n- ABA Account: 005 452 334 (Sok Chea CHHAI)\n- ឬជ្រើសរើសទូទាត់លុយសុទ្ធពេលអីវ៉ាន់ដល់ដៃ (COD) ក៏បានបងចា៎!',
    category: 'payment',
  },
  {
    id: 'qr_3',
    shortcut: '/ship',
    title: 'សេវាដឹកជញ្ជូនរាជធានី និងខេត្ត',
    titleKh: 'សេវាដឹកជញ្ជូន',
    content: 'សេវាដឹកជញ្ជូន:\n- ភ្នំពេញ: $1.50 (១ថ្ងៃដល់ ឬ Grab ភ្លាមៗ)\n- តាមបណ្តាខេត្ត: $2.00 (១-២ ថ្ងៃ តាមរយៈ J&T ឬ វីរៈប៊ុនថាំ) បងចា៎!',
    category: 'delivery',
  },
  {
    id: 'qr_4',
    shortcut: '/address',
    title: 'សុំលេខទូរស័ព្ទ និងទីតាំងទទួល',
    titleKh: 'សុំទីតាំងដឹកជញ្ជូន',
    content: 'ដើម្បីឱ្យខាងប្អូនរៀបចំកញ្ចប់អីវ៉ាន់ជូនបងបានលឿន សូមបងជួយផ្ញើ [លេខទូរស័ព្ទ] និង [ទីតាំងទទួល] មកខាងប្អូនផងណា៎បង!',
    category: 'general',
  },
  {
    id: 'qr_5',
    shortcut: '/thanks',
    title: 'ថ្លែងអំណរគុណអតិថិជន',
    titleKh: 'អរគុណអតិថិជន',
    content: 'អរគុណច្រើនបងសម្រាប់ការជាវទំនិញពីហាងយើងខ្ញុំ! ប្រសិនបើមានបញ្ហាអីវ៉ាន់ ឬចង់ប្តូរទំហំ បងអាចទាក់ទងមកខាងប្អូនបានគ្រប់ពេលណា៎បង!',
    category: 'greeting',
  },
];

export const INITIAL_AUTO_REPLIES: AutoReplyRule[] = [
  {
    id: 'ar_1',
    enabled: true,
    triggerKeywords: ['ថ្លៃប៉ុន្មាន', 'តម្លៃ', 'តំលៃ', 'how much', 'price'],
    responseKh: 'ជំរាបសួរបង! ម៉ូដនេះតម្លៃពិសេស $34.00 (បញ្ចុះពី $38.00) មានក្នុងស្តុកបងចា៎។ បងចាប់អារម្មណ៍ទំហំណាដែរចា៎?',
    matchType: 'contains',
  },
  {
    id: 'ar_2',
    enabled: true,
    triggerKeywords: ['ដឹក', 'សេវាដឹក', 'delivery', 'ថ្លៃសេវា'],
    responseKh: 'សេវាដឹកជញ្ជូនភ្នំពេញ $1.50 ខេត្ត $2.00 (១-២ថ្ងៃដល់តាម J&T Express ឬវីរៈប៊ុនថាំ) បងចា៎!',
    matchType: 'contains',
  },
  {
    id: 'ar_3',
    enabled: true,
    triggerKeywords: ['aba', 'កុង', 'គណនី', 'transfer', 'khqr'],
    responseKh: 'បងអាចទូទាត់តាម ABA Account: 005 452 334 (Sok Chea CHHAI) ឬទទួលអីវ៉ាន់ចាំបង់លុយ (COD) ក៏បានបងចា៎!',
    matchType: 'contains',
  },
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord_1001',
    orderNumber: 'ORD-8801',
    customerName: 'ចាន់ សុគន្ធា',
    customerPhone: '012 889 977',
    customerAddress: 'ផ្ទះលេខ 45B ផ្លូវ 315 ទួលគោក',
    customerProvince: 'ភ្នំពេញ',
    items: [
      {
        productId: 'prod_1',
        name: 'រ៉ូបហូលផាមួងខ្មែរម៉ូដសម័យ (Size M)',
        quantity: 1,
        price: 38.00,
        subtotal: 38.00,
      },
    ],
    subtotal: 38.00,
    deliveryFee: 1.50,
    discount: 0,
    total: 39.50,
    totalKhr: 161950,
    paymentMethod: 'aba_khqr',
    deliveryProvider: 'jt',
    status: 'packaging',
    createdAt: 'ថ្ងៃនេះ, 10:30 AM',
    pageId: 'page_malis_fashion',
    threadId: 'th_1',
    notes: 'អតិថិជនសុំផ្ញើមុនម៉ោង ៤ រសៀល',
  },
  {
    id: 'ord_1002',
    orderNumber: 'ORD-8802',
    customerName: 'កែវ ពិសិដ្ឋ',
    customerPhone: '098 776 655',
    customerAddress: 'ភូមិវត្តបូព៌ សង្កាត់សាលាកំរើក',
    customerProvince: 'សៀមរាប',
    items: [
      {
        productId: 'prod_2',
        name: 'សេរ៉ូមធម្មជាតិ Botanica Herbal',
        quantity: 2,
        price: 25.00,
        subtotal: 50.00,
      },
    ],
    subtotal: 50.00,
    deliveryFee: 2.00,
    discount: 2.00,
    total: 50.00,
    totalKhr: 205000,
    paymentMethod: 'cod',
    deliveryProvider: 'virak_buntham',
    status: 'shipped',
    createdAt: 'ម្សិលមិញ, 03:15 PM',
    pageId: 'page_malis_fashion',
    threadId: 'th_2',
    notes: 'ផ្ញើតាមឡានវីរៈប៊ុនថាំ',
  },
];

export const INITIAL_THREADS: ChatThread[] = [];
