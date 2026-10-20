import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Printer, 
  QrCode, 
  ShoppingBag, 
  CheckCircle2, 
  Truck, 
  MapPin, 
  Phone, 
  Store,
  Edit3,
  Save,
  Eye,
  Plus,
  Trash2,
  DollarSign,
  AlertCircle,
  Upload,
  RotateCcw,
  Check
} from 'lucide-react';
import { Order, OrderLineItem, PageAccount } from '../types';
import { useKhqrConfig, DEFAULT_KHQR_IMAGE, FALLBACK_KHQR_IMAGE } from '../utils/khqrSettings';

interface InvoicePrintModalProps {
  order: Order | null;
  page: PageAccount;
  onClose: () => void;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
  onSaveOrder?: (updatedOrder: Order) => void;
  initialEditMode?: boolean;
  language: 'kh' | 'en';
}

const CAMBODIAN_PROVINCES = [
  'ភ្នំពេញ',
  'សៀមរាប',
  'បាត់ដំបង',
  'កំពង់ចាម',
  'កណ្តាល',
  'ព្រះសីហនុ',
  'បន្ទាយមានជ័យ',
  'កំពត',
  'តាកែវ',
  'កំពង់ធំ',
  'កំពង់ស្ពឺ',
  'ព្រៃវែង',
  'ស្វាយរៀង',
  'ពោធិ៍សាត់',
  'ក្រចេះ',
  'ស្ទឹងត្រែង',
  'រតនគិរី',
  'មណ្ឌលគិរី',
  'កោះកុង',
  'ឧត្តរមានជ័យ',
  'ព្រះវិហារ',
  'ប៉ៃលិន',
  'កែប',
  'ត្បូងឃ្មុំ',
];

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  order,
  page,
  onClose,
  onUpdateOrderStatus,
  onSaveOrder,
  initialEditMode = false,
  language,
}) => {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [customerName, setCustomerName] = useState(order?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(order?.customerPhone || '');
  const [customerProvince, setCustomerProvince] = useState(order?.customerProvince || 'ភ្នំពេញ');
  const [customerAddress, setCustomerAddress] = useState(order?.customerAddress || '');
  const [deliveryProvider, setDeliveryProvider] = useState<Order['deliveryProvider']>(order?.deliveryProvider || 'jt');
  const [deliveryFee, setDeliveryFee] = useState<number>(order?.deliveryFee || 1.50);
  const [discount, setDiscount] = useState<number>(order?.discount || 0);
  const [paymentMethod, setPaymentMethod] = useState<Order['paymentMethod']>(order?.paymentMethod || 'aba_khqr');
  const [notes, setNotes] = useState(order?.notes || '');
  const [status, setStatus] = useState<Order['status']>(order?.status || 'pending');
  const [items, setItems] = useState<OrderLineItem[]>(order?.items || []);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Dynamic KHQR Configuration
  const { config: khqrConfig, updateKhqr, resetKhqr } = useKhqrConfig();
  const invoiceKhqrFileInputRef = useRef<HTMLInputElement>(null);
  const [invoiceKhqrSuccess, setInvoiceKhqrSuccess] = useState(false);

  const handleInvoiceKhqrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        updateKhqr({ qrImage: base64 });
        setInvoiceKhqrSuccess(true);
        setTimeout(() => setInvoiceKhqrSuccess(false), 3000);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  useEffect(() => {
    if (order) {
      setCustomerName(order.customerName);
      setCustomerPhone(order.customerPhone);
      setCustomerProvince(order.customerProvince);
      setCustomerAddress(order.customerAddress);
      setDeliveryProvider(order.deliveryProvider);
      setDeliveryFee(order.deliveryFee);
      setDiscount(order.discount);
      setPaymentMethod(order.paymentMethod);
      setNotes(order.notes || '');
      setStatus(order.status);
      setItems(order.items || []);
    }
    setIsEditing(initialEditMode);
    setSaveSuccessMsg('');
  }, [order?.id, initialEditMode]);

  if (!order) return null;

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const total = Math.max(0, subtotal + Number(deliveryFee || 0) - Number(discount || 0));
  const totalKhr = Math.round(total * 4100);

  const handlePrint = () => {
    window.print();
  };

  const getDeliveryLabel = (provider: Order['deliveryProvider']) => {
    switch (provider) {
      case 'jt':
        return 'J&T Express';
      case 'virak_buntham':
        return 'វីរៈប៊ុនថាំ (Virak Buntham)';
      case 'capitol':
        return 'កាពីតូល (Capitol Express)';
      case 'grab':
        return 'Grab Express (ភ្នំពេញ)';
      default:
        return provider;
    }
  };

  const handleUpdateItemQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return;
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              quantity: newQty,
              subtotal: item.price * newQty,
            }
          : item
      )
    );
  };

  const handleUpdateItemPrice = (index: number, newPrice: number) => {
    if (newPrice < 0) return;
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              price: newPrice,
              subtotal: newPrice * item.quantity,
            }
          : item
      )
    );
  };

  const handleAddCustomItem = () => {
    const newItem: OrderLineItem = {
      productId: `custom_${Date.now()}`,
      name: 'មុខទំនិញបន្ថែម',
      quantity: 1,
      price: 15.00,
      subtotal: 15.00,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveDocument = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updatedOrder: Order = {
      ...order,
      customerName: customerName.trim() || order.customerName,
      customerPhone: customerPhone.trim() || order.customerPhone,
      customerProvince,
      customerAddress: customerAddress.trim() || order.customerAddress,
      deliveryProvider,
      deliveryFee: Number(deliveryFee) || 0,
      discount: Number(discount) || 0,
      paymentMethod,
      notes: notes.trim(),
      status,
      items,
      subtotal,
      total,
      totalKhr,
    };

    if (onSaveOrder) {
      onSaveOrder(updatedOrder);
    }
    if (status !== order.status) {
      onUpdateOrderStatus(order.id, status);
    }
    setSaveSuccessMsg(
      language === 'kh'
        ? `បានរក្សាទុកការកែប្រែលើវិក្កយបត្រ #${order.orderNumber} ដោយជោគជ័យ!`
        : `Saved changes to invoice #${order.orderNumber} successfully!`
    );
    setTimeout(() => {
      setSaveSuccessMsg('');
      setIsEditing(false);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">
                  {language === 'kh' ? 'វិក្កយបត្របញ្ជាទិញ' : 'Order Invoice'}
                </span>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold tabular-nums">
                  #{order.orderNumber}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {isEditing 
                  ? (language === 'kh' ? 'កំពុងកែប្រែទិន្នន័យឯកសារ' : 'Editing document fields one by one')
                  : (language === 'kh' ? 'ទម្រង់បោះពុម្ព និងមើលព័ត៌មាន' : 'Document preview and print')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View / Edit Mode Switcher */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  !isEditing ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">{language === 'kh' ? 'មើល' : 'View'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  isEditing ? 'bg-blue-600 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">{language === 'kh' ? 'កែប្រែ' : 'Edit'}</span>
              </button>
            </div>

            {/* Print Button (active in preview mode) */}
            {!isEditing && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                title="បោះពុម្ពវិក្កយបត្រ"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{language === 'kh' ? 'បោះពុម្ព' : 'Print'}</span>
              </button>
            )}

            {/* Top Save Button (when in edit mode) */}
            {isEditing && (
              <button
                onClick={handleSaveDocument}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs cursor-pointer"
                title="រក្សាទុកការកែប្រែ"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{language === 'kh' ? 'រក្សាទុក' : 'Save'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {saveSuccessMsg && (
          <div className="px-5 py-2.5 bg-emerald-500 text-white text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{saveSuccessMsg}</span>
            </div>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded">Saved</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE 1: EDIT DOCUMENT MODE (EDIT ONE BY ONE WITH DEDICATED SAVE BUTTON)   */}
        {/* ========================================================================= */}
        {isEditing ? (
          <form onSubmit={handleSaveDocument} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-slate-50/50">
            {/* Customer & Shipping Section */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Store className="w-4 h-4 text-blue-600" />
                <span>{language === 'kh' ? '១. ព័ត៌មានអតិថិជន និងការដឹកជញ្ជូន' : '1. Customer & Delivery Info'}</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {language === 'kh' ? 'ឈ្មោះអតិថិជន *' : 'Customer Name *'}
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {language === 'kh' ? 'លេខទូរស័ព្ទ *' : 'Phone Number *'}
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {language === 'kh' ? 'ខេត្ត / ក្រុង' : 'Province / City'}
                  </label>
                  <select
                    value={customerProvince}
                    onChange={(e) => setCustomerProvince(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {CAMBODIAN_PROVINCES.map((prov) => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {language === 'kh' ? 'សេវាដឹកជញ្ជូន' : 'Delivery Provider'}
                  </label>
                  <select
                    value={deliveryProvider}
                    onChange={(e) => setDeliveryProvider(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                  >
                    <option value="jt">J&T Express (តាមខេត្ត)</option>
                    <option value="virak_buntham">វីរៈប៊ុនថាំ (Virak Buntham)</option>
                    <option value="capitol">កាពីតូល (Capitol Express)</option>
                    <option value="grab">Grab Express (ភ្នំពេញ)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {language === 'kh' ? 'អាសយដ្ឋានលម្អិត' : 'Detailed Address'}
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="ផ្ទះលេខ ផ្លូវ..."
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Line Items Section (Add, Edit, Remove) */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                  <span>{language === 'kh' ? '២. បញ្ជីមុខទំនិញ' : '2. Order Line Items'}</span>
                </h4>
                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{language === 'kh' ? '+ ថែមមុខទំនិញ' : '+ Add Item'}</span>
                </button>
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                    <div className="flex-1 w-full sm:w-auto">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, name: val } : it))
                          );
                        }}
                        className="w-full px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="ឈ្មោះទំនិញ..."
                      />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500">ចំនួន:</span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItemQuantity(idx, parseInt(e.target.value) || 1)}
                          className="w-14 px-2 py-1 text-xs text-center font-bold bg-white border border-slate-200 rounded-md focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500">តម្លៃ:</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={item.price}
                          onChange={(e) => handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)}
                          className="w-18 px-2 py-1 text-xs text-right font-bold bg-white border border-slate-200 rounded-md focus:outline-none"
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-800 tabular-nums w-16 text-right">
                        ${item.subtotal.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length <= 1}
                        className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 transition-colors cursor-pointer"
                        title="លុប"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations, Discounts & Status Section */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {language === 'kh' ? '៣. ការទូទាត់ និងការបញ្ចុះតម្លៃ' : '3. Pricing & Payment'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {language === 'kh' ? 'ថ្លៃដឹកជញ្ជូន ($)' : 'Delivery Fee ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {language === 'kh' ? 'បញ្ចុះតម្លៃ Discount ($)' : 'Discount ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-bold text-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {language === 'kh' ? 'វិធីទូទាត់' : 'Payment Method'}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-medium cursor-pointer"
                  >
                    <option value="aba_khqr">ABA / KHQR Bakong</option>
                    <option value="cod">COD (ទូទាត់ពេលដល់ដៃ)</option>
                    <option value="wing">Wing Bank / ACLEDA</option>
                    <option value="cash">លុយសុទ្ធ (Cash)</option>
                  </select>

                  {paymentMethod === 'aba_khqr' && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={khqrConfig.qrImage || DEFAULT_KHQR_IMAGE}
                          alt="KHQR"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = FALLBACK_KHQR_IMAGE;
                          }}
                          className="w-8 h-8 rounded border border-red-200 bg-white object-contain"
                        />
                        <div className="text-[10px]">
                          <p className="font-bold text-slate-800">{khqrConfig.merchantName}</p>
                          <p className="text-slate-500 font-mono">{khqrConfig.accountNumber}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => invoiceKhqrFileInputRef.current?.click()}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] rounded flex items-center gap-1 cursor-pointer"
                      >
                        <Upload className="w-2.5 h-2.5" />
                        <span>ប្តូររូប KHQR ថ្មី</span>
                      </button>
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {language === 'kh' ? 'កំណត់សម្គាល់ (Notes)' : 'Invoice Notes'}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="សម្គាល់ការដឹកជញ្ជូន..."
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {language === 'kh' ? 'ស្ថានភាពឯកសារ' : 'Document Status'}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none cursor-pointer"
                  >
                    <option value="pending">រង់ចាំ (Pending)</option>
                    <option value="packaging">កំពុងខ្ចប់ (Packaging)</option>
                    <option value="shipped">បានផ្ញើចេញ (Shipped)</option>
                    <option value="delivered">បានទទួលរួច (Delivered)</option>
                  </select>
                </div>
              </div>

              {/* Total Calculation Preview */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">ទឹកប្រាក់សរុប (Final Total):</span>
                <div className="text-right">
                  <span className="font-black text-blue-600 text-base tabular-nums">${total.toFixed(2)}</span>
                  <span className="text-slate-400 text-[11px] ml-2 tabular-nums">ស្មើនឹង {totalKhr.toLocaleString()} រៀល</span>
                </div>
              </div>
            </div>

            {/* Bottom Primary Save Button Bar */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Save className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-950">
                    {language === 'kh' ? 'តើអ្នកចង់រក្សាទុកការកែប្រែនេះទេ?' : 'Ready to save this document?'}
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    {language === 'kh' ? 'ចុចប៊ូតុង Update ដើម្បីរក្សាទុកឯកសារនេះ' : 'All modifications will be saved to this order record'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  {language === 'kh' ? 'បោះបង់' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{language === 'kh' ? 'រក្សាទុកឯកសារ (Save)' : 'Save Document'}</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* ========================================================================= */
          /* MODE 2: PREVIEW & PRINTABLE INVOICE MODE                                  */
          /* ========================================================================= */
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-white print:p-0">
            {/* Shop Header */}
            <div className="flex items-start justify-between border-b pb-4 border-slate-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                    💬
                  </div>
                  <h2 className="text-base font-bold text-slate-900">{page.name}</h2>
                </div>
                <p className="text-xs text-slate-500">{page.category}</p>
                <p className="text-xs text-slate-500">ទូរស័ព្ទ: 012 234 567 / 098 765 432</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">
                  INVOICE / វិក្កយបត្រ
                </span>
                <p className="text-sm font-bold text-slate-900 tabular-nums">#{order.orderNumber}</p>
                <p className="text-xs text-slate-400">{order.createdAt}</p>
              </div>
            </div>

            {/* Customer & Shipping Details */}
            <div className="grid grid-cols-2 gap-4 py-4 border-b border-slate-200 text-xs">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  អតិថិជន (Customer)
                </span>
                <p className="font-bold text-slate-900 text-sm">{order.customerName}</p>
                <p className="text-slate-700 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{order.customerPhone}</span>
                </p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  ទីតាំងដឹកជញ្ជូន (Delivery Address)
                </span>
                <p className="text-slate-800 font-medium">{order.customerProvince}</p>
                <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">{order.customerAddress}</p>
                <p className="text-blue-600 font-semibold text-[11px] mt-1 flex items-center gap-1">
                  <Truck className="w-3 h-3" />
                  <span>{getDeliveryLabel(order.deliveryProvider)}</span>
                </p>
                {order.notes && (
                  <p className="text-amber-700 text-[11px] mt-1 italic">
                    ចំណាំ: {order.notes}
                  </p>
                )}
              </div>
            </div>

            {/* Order Items Table */}
            <div className="py-4">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="pb-2">មុខទំនិញ</th>
                    <th className="pb-2 text-center">ចំនួន</th>
                    <th className="pb-2 text-right">តម្លៃរាយ</th>
                    <th className="pb-2 text-right">សរុប</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item, idx) => (
                    <tr key={idx} className="py-2.5">
                      <td className="py-2.5 font-medium text-slate-800">{item.name}</td>
                      <td className="py-2.5 text-center text-slate-600 tabular-nums">{item.quantity}</td>
                      <td className="py-2.5 text-right text-slate-600 tabular-nums">${item.price.toFixed(2)}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                        ${item.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & KHQR Box */}
            <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Hidden file input for uploading new KHQR image */}
              <input
                type="file"
                ref={invoiceKhqrFileInputRef}
                onChange={handleInvoiceKhqrUpload}
                accept="image/*"
                className="hidden"
              />

              {/* KHQR payment box */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3 relative">
                <div 
                  onClick={() => invoiceKhqrFileInputRef.current?.click()}
                  title="ចុចដើម្បីប្តូររូប KHQR"
                  className="w-20 h-20 bg-white p-1 rounded-lg border border-slate-200 flex flex-col items-center justify-center shrink-0 overflow-hidden shadow-2xs relative group cursor-pointer"
                >
                  <img
                    src={khqrConfig.qrImage || DEFAULT_KHQR_IMAGE}
                    alt="KHQR Bakong Sok Chea CHHAI"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = FALLBACK_KHQR_IMAGE;
                    }}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded text-white print:hidden">
                    <Upload className="w-4 h-4" />
                  </div>
                </div>

                <div className="text-[11px] min-w-0 flex-1">
                  <p className="font-bold text-slate-800 mb-0.5">ស្កេនទូទាត់ Bakong / ABA</p>
                  <p className="text-slate-500 font-mono">កុង: {khqrConfig.accountNumber || '005 452 334'}</p>
                  <p className="text-slate-600 font-medium">ឈ្មោះ: {khqrConfig.merchantName || 'Sok Chea CHHAI'}</p>
                  <p className="text-emerald-600 font-semibold mt-0.5">
                    វិធីទូទាត់: {order.paymentMethod === 'aba_khqr' ? 'ABA KHQR' : order.paymentMethod === 'cod' ? 'COD (ពេលដល់ដៃ)' : order.paymentMethod.toUpperCase()}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 print:hidden">
                    <button
                      type="button"
                      onClick={() => invoiceKhqrFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-[10px] rounded-md border border-red-200 transition-colors cursor-pointer"
                    >
                      <Upload className="w-2.5 h-2.5" />
                      <span>ប្តូររូប KHQR ថ្មី</span>
                    </button>
                    {khqrConfig.qrImage !== DEFAULT_KHQR_IMAGE && (
                      <button
                        type="button"
                        onClick={resetKhqr}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-[10px] rounded-md transition-colors cursor-pointer"
                        title="ត្រឡប់ទៅរូបដើម"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>ដើម</span>
                      </button>
                    )}
                  </div>
                  {invoiceKhqrSuccess && (
                    <span className="text-[10px] text-emerald-600 font-bold block mt-1 print:hidden">
                      ✓ បានប្តូររូប KHQR រួចរាល់
                    </span>
                  )}
                </div>
              </div>

              {/* Price Calculations */}
              <div className="space-y-1.5 text-xs text-right">
                <div className="flex justify-between text-slate-500">
                  <span>តម្លៃសរុបទំនិញ (Subtotal):</span>
                  <span className="font-medium text-slate-800 tabular-nums">${order.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>ថ្លៃសេវាដឹក (Delivery):</span>
                  <span className="font-medium text-slate-800 tabular-nums">${order.deliveryFee.toFixed(2)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>បញ្ចុះតម្លៃ (Discount):</span>
                    <span className="tabular-nums">-${order.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="font-bold text-slate-900 text-sm">ទឹកប្រាក់សរុប (Total):</span>
                  <div>
                    <span className="font-bold text-blue-600 text-base tabular-nums">${order.total.toFixed(2)}</span>
                    <p className="text-[11px] text-slate-500 tabular-nums">ស្មើនឹង {order.totalKhr.toLocaleString()} រៀល</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer note */}
            <div className="mt-6 pt-3 border-t border-dashed border-slate-200 text-center text-[11px] text-slate-400">
              <p>សូមអរគុណសម្រាប់ការជាវទំនិញពីហាង {page.name}!</p>
            </div>
          </div>
        )}

        {/* Change status bar (Admin footer) */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">
              {language === 'kh' ? 'ស្ថានភាពឯកសារ:' : 'Document Status:'}
            </span>
            <div className="flex items-center gap-1.5">
              {(['pending', 'packaging', 'shipped', 'delivered'] as Order['status'][]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatus(st);
                    onUpdateOrderStatus(order.id, st);
                  }}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize transition-colors cursor-pointer ${
                    (isEditing ? status : order.status) === st
                      ? 'bg-blue-600 text-white shadow-2xs font-bold'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <button
                type="button"
                onClick={handleSaveDocument}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{language === 'kh' ? 'រក្សាទុកឯកសារ (Save)' : 'Save Document'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg transition-colors flex items-center gap-1.5 border border-blue-200 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{language === 'kh' ? 'កែប្រែឯកសារនេះ' : 'Edit This Document'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
