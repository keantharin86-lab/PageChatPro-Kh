import React, { useState, useRef } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  ShoppingBag, 
  Check, 
  Truck, 
  CreditCard, 
  DollarSign,
  Upload,
  RotateCcw
} from 'lucide-react';
import { Customer, ProductItem, Order, OrderLineItem, ChatMessage } from '../types';
import { useKhqrConfig, DEFAULT_KHQR_IMAGE, FALLBACK_KHQR_IMAGE } from '../utils/khqrSettings';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  products: ProductItem[];
  pageId: string;
  threadId: string;
  threadMessages?: ChatMessage[];
  initialProduct?: ProductItem | null;
  onSaveOrder: (newOrder: Order) => void;
  language: 'kh' | 'en';
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  customer,
  products,
  pageId,
  threadId,
  threadMessages = [],
  initialProduct = null,
  onSaveOrder,
  language,
}) => {
  const [customerName, setCustomerName] = useState(customer.name || 'អតិថិជន (Messenger)');
  const [customerPhone, setCustomerPhone] = useState(customer.phone || '');
  const [customerProvince, setCustomerProvince] = useState(customer.province || 'ភ្នំពេញ');
  const [customerAddress, setCustomerAddress] = useState(customer.address || '');

  // Line items
  const [items, setItems] = useState<OrderLineItem[]>(() => {
    const firstProd = initialProduct || products[0];
    return [
      {
        productId: firstProd?.id || 'custom_1',
        name: firstProd?.nameKh || 'ទំនិញកម្ម៉ង់ក្នុងឆាត',
        quantity: 1,
        price: firstProd?.price ?? 25.0,
        subtotal: firstProd?.price ?? 25.0,
      },
    ];
  });

  const [deliveryProvider, setDeliveryProvider] = useState<'jt' | 'virak_buntham' | 'capitol' | 'grab'>('jt');
  const [deliveryFee, setDeliveryFee] = useState<number>(customer.province === 'ភ្នំពេញ' ? 1.50 : 2.00);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'aba_khqr' | 'cod' | 'wing' | 'cash'>('aba_khqr');
  const [notes, setNotes] = useState('ផ្ញើជូនរហ័ស');
  const [orderDate, setOrderDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // Auto-sync customer info, detected phone/address from chat messages, and initialProduct whenever modal opens
  React.useEffect(() => {
    if (!isOpen) return;

    let detectedPhone = customer.phone || '';
    let detectedAddress = customer.address || '';
    for (const msg of threadMessages) {
      if (msg.sender !== 'customer') continue;
      const phoneRegex = /(?:\+?855|0)[1-9]\d{7,8}|\b0\d{2}[- ]?\d{3}[- ]?\d{3,4}\b/;
      const match = (msg.text || '').match(phoneRegex);
      if (match && (!detectedPhone || detectedPhone === 'មិនទាន់មានលេខទូរស័ព្ទ')) {
        detectedPhone = match[0];
      }
      const txt = msg.text || '';
      if (
        (txt.includes('ផ្ទះ') ||
          txt.includes('ផ្លូវ') ||
          txt.includes('ភ្នំពេញ') ||
          txt.includes('សៀមរាប') ||
          txt.includes('បាត់ដំបង') ||
          txt.includes('ទួលគោក') ||
          txt.includes('សែនសុខ') ||
          txt.includes('ចំការមន')) &&
        (!detectedAddress || detectedAddress === 'ភ្នំពេញ (Messenger Live)')
      ) {
        detectedAddress = txt.length > 70 ? `${txt.slice(0, 68)}...` : txt;
      }
    }

    setCustomerName(customer.name || 'អតិថិជន (Messenger)');
    setCustomerPhone(detectedPhone || '012 889 977');
    setCustomerProvince(customer.province || 'ភ្នំពេញ');
    setCustomerAddress(detectedAddress || customer.province || 'ភ្នំពេញ');

    const now = new Date();
    setOrderDate(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    );

    const targetProd = initialProduct || products[0];
    if (targetProd) {
      setItems([
        {
          productId: targetProd.id,
          name: targetProd.nameKh || targetProd.name,
          quantity: 1,
          price: targetProd.price,
          subtotal: targetProd.price,
        },
      ]);
    }
  }, [isOpen, customer.id, initialProduct?.id]);

  // KHQR config & upload
  const { config: khqrConfig, updateKhqr, resetKhqr } = useKhqrConfig();
  const orderKhqrFileInputRef = useRef<HTMLInputElement>(null);
  const [khqrUploadSuccess, setKhqrUploadSuccess] = useState(false);

  const handleOrderKhqrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        updateKhqr({ qrImage: base64 });
        setKhqrUploadSuccess(true);
        setTimeout(() => setKhqrUploadSuccess(false), 2500);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Calculations
  const subtotal = items.reduce((acc, curr) => acc + curr.subtotal, 0);
  const total = Math.max(0, subtotal + deliveryFee - discount);
  const totalKhr = Math.round(total * 4100);

  const handleAddItem = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    setItems([
      ...items,
      {
        productId: prod.id,
        name: prod.nameKh,
        quantity: 1,
        price: prod.price,
        subtotal: prod.price,
      },
    ]);
  };

  const handleUpdateItemQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) return;
    const updated = [...items];
    updated[index].quantity = newQty;
    updated[index].subtotal = updated[index].price * newQty;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowMs = Date.now();
    const now = new Date(nowMs);
    const formattedTime = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    const currentRealDate =
      orderDate ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const safeName = customerName.trim() || customer.name || 'អតិថិជន (Messenger)';
    const safePhone = customerPhone.trim() || customer.phone || 'មិនទាន់បញ្ជាក់';
    const safeProvince = customerProvince.trim() || customer.province || 'ភ្នំពេញ';
    const safeAddress = customerAddress.trim() || customer.address || safeProvince;

    const newOrder: Order = {
      id: `ord_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
      orderNumber,
      customerName: safeName,
      customerPhone: safePhone,
      customerAddress: safeAddress,
      customerProvince: safeProvince,
      items,
      subtotal,
      deliveryFee,
      discount,
      total,
      totalKhr,
      paymentMethod,
      deliveryProvider,
      status: 'pending',
      createdAt: `${currentRealDate}, ${formattedTime}`,
      createdAtMs: nowMs,
      orderDate: currentRealDate,
      updatedAt: nowMs,
      pageId,
      threadId,
      notes,
    };

    onSaveOrder(newOrder);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                {language === 'kh' ? 'បង្កើតការកុម្ម៉ង់ថ្មី (New Order)' : 'Create New Order'}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'kh' ? 'រក្សាទុកក្នុងការបញ្ជាទិញ (Orders) ទាំងលើទូរស័ព្ទ និងកុំព្យូទ័រដោយស្វ័យប្រវត្តិ' : 'Saves to Orders across both mobile and desktop'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Customer info section */}
          <div>
            <h4 className="text-xs font-semibold uppercase text-slate-500 tracking-wider mb-3">
              1. {language === 'kh' ? 'ព័ត៌មានអតិថិជន និងការដឹកជញ្ជូន' : 'Customer & Shipping'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  {language === 'kh' ? 'ឈ្មោះអតិថិជន' : 'Customer Name'}
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="ឈ្មោះអតិថិជន..."
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  {language === 'kh' ? 'លេខទូរស័ព្ទ' : 'Phone Number'}
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="012 xxx xxx"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-mono font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  {language === 'kh' ? 'ខេត្ត/ក្រុង' : 'Province'}
                </label>
                <input
                  type="text"
                  value={customerProvince}
                  onChange={(e) => setCustomerProvince(e.target.value)}
                  placeholder="ភ្នំពេញ / ខេត្ត..."
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  {language === 'kh' ? 'សេវាដឹកជញ្ជូន' : 'Delivery Service'}
                </label>
                <select
                  value={deliveryProvider}
                  onChange={(e) => setDeliveryProvider(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="jt">J&T Express</option>
                  <option value="virak_buntham">វីរៈប៊ុនថាំ (Virak Buntham)</option>
                  <option value="capitol">កាពីតូល (Capitol Express)</option>
                  <option value="grab">Grab Delivery (ភ្នំពេញ)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  {language === 'kh' ? 'អាសយដ្ឋានលម្អិត' : 'Full Shipping Address'}
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="ផ្ទះលេខ ផ្លូវ..."
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  {language === 'kh' ? 'កាលបរិច្ឆេទកុម្ម៉ង់ (ថ្ងៃ-ខែ-ឆ្នាំ)' : 'Order Date'}
                </label>
                <input
                  type="date"
                  required
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Product Items Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                2. {language === 'kh' ? 'មុខទំនិញដែលបានកុម្ម៉ង់' : 'Order Line Items'}
              </h4>
              {/* Add item dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">{language === 'kh' ? 'ថែម:' : 'Add:'}</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddItem(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  className="px-2 py-1 text-xs bg-blue-50 text-blue-700 font-medium rounded-md border border-blue-200 focus:outline-none cursor-pointer"
                >
                  <option value="" disabled>
                    + {language === 'kh' ? 'ជ្រើសរើសទំនិញ' : 'Select Product'}
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameKh} (${p.price.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between gap-3 bg-white">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      ${item.price.toFixed(2)} / ឯកតា
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center border border-slate-200 rounded-md">
                      <button
                        type="button"
                        onClick={() => handleUpdateItemQuantity(idx, item.quantity - 1)}
                        className="px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-2.5 text-xs font-semibold tabular-nums text-slate-800">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateItemQuantity(idx, item.quantity + 1)}
                        className="px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <div className="w-16 text-right font-semibold text-xs text-slate-900 tabular-nums">
                      ${item.subtotal.toFixed(2)}
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <h4 className="text-xs font-semibold uppercase text-slate-500 tracking-wider mb-2">
                3. {language === 'kh' ? 'វិធីទូទាត់ប្រាក់' : 'Payment Method'}
              </h4>
              {/* Hidden file input */}
              <input
                type="file"
                ref={orderKhqrFileInputRef}
                onChange={handleOrderKhqrUpload}
                accept="image/*"
                className="hidden"
              />
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="radio"
                    name="pay"
                    checked={paymentMethod === 'aba_khqr'}
                    onChange={() => setPaymentMethod('aba_khqr')}
                    className="text-blue-600"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800">ABA Bank & KHQR</span>
                    <p className="text-[10px] text-slate-500">ស្កេនបង់លុយភ្លាមៗ</p>
                  </div>
                </label>

                {paymentMethod === 'aba_khqr' && (
                  <div className="p-2.5 bg-red-50/70 border border-red-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        onClick={() => orderKhqrFileInputRef.current?.click()}
                        title="ចុចដើម្បីប្តូររូប KHQR"
                        className="w-12 h-12 bg-white rounded-lg p-0.5 border border-red-200 shrink-0 cursor-pointer hover:opacity-90 relative group overflow-hidden"
                      >
                        <img
                          src={khqrConfig.qrImage || DEFAULT_KHQR_IMAGE}
                          alt="KHQR Preview"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = FALLBACK_KHQR_IMAGE;
                          }}
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px]">
                          <Upload className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 text-[11px]">
                        <p className="font-bold text-slate-800 truncate">{khqrConfig.merchantName || 'Sok Chea CHHAI'}</p>
                        <p className="text-slate-500 font-mono text-[10px] truncate">{khqrConfig.accountNumber || '005 452 334'}</p>
                        <span className="text-[9px] text-red-600 font-medium">Bakong KHQR</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1 border-t border-red-100">
                      <button
                        type="button"
                        onClick={() => orderKhqrFileInputRef.current?.click()}
                        className="flex-1 py-1 px-2 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Upload className="w-2.5 h-2.5" />
                        <span>{language === 'kh' ? 'ប្តូររូប KHQR ថ្មី' : 'Upload New KHQR'}</span>
                      </button>
                      {khqrConfig.qrImage !== DEFAULT_KHQR_IMAGE && (
                        <button
                          type="button"
                          onClick={resetKhqr}
                          className="p-1 text-slate-500 hover:text-slate-700 bg-white rounded border border-slate-200 cursor-pointer"
                          title="ត្រឡប់ទៅរូបដើម"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {khqrUploadSuccess && (
                      <p className="text-[10px] text-emerald-600 font-bold">បានប្តូររូបភាព KHQR រួចរាល់!</p>
                    )}
                  </div>
                )}

                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="radio"
                    name="pay"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                    className="text-blue-600"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800">ទទួលអីវ៉ាន់ចាំបង់ (COD)</span>
                    <p className="text-[10px] text-slate-500">Cash On Delivery</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Price Breakdown Card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>{language === 'kh' ? 'តម្លៃសរុប (Subtotal)' : 'Subtotal'}:</span>
                <span className="font-semibold text-slate-800 tabular-nums">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>{language === 'kh' ? 'សេវាដឹកជញ្ជូន' : 'Delivery Fee'}:</span>
                <div className="flex items-center gap-1">
                  <span>$</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                    className="w-16 px-1.5 py-0.5 text-right font-semibold bg-white border border-slate-200 rounded text-xs tabular-nums"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>{language === 'kh' ? 'បញ្ចុះតម្លៃ (Discount)' : 'Discount'}:</span>
                <div className="flex items-center gap-1">
                  <span>-$</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-16 px-1.5 py-0.5 text-right font-semibold bg-white border border-slate-200 rounded text-xs tabular-nums"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span className="font-bold text-slate-900 text-sm">
                  {language === 'kh' ? 'ទឹកប្រាក់ត្រូវបង់' : 'Total'}:
                </span>
                <div className="text-right">
                  <p className="font-bold text-blue-600 text-base tabular-nums">${total.toFixed(2)}</p>
                  <p className="text-[11px] text-slate-500 tabular-nums">ស្មើនឹង {totalKhr.toLocaleString()} រៀល</p>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              {language === 'kh' ? 'បោះបង់' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>
                {language === 'kh' ? 'ចេញវិក្កយបត្រ & ផ្ញើទៅការជជែក' : 'Save & Send Slip to Chat'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
