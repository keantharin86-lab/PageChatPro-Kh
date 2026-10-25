import React, { useState, useRef } from 'react';
import { 
  User, 
  Phone, 
  MapPin, 
  Tag, 
  ShoppingBag, 
  FileText, 
  Edit2, 
  Check, 
  Plus, 
  X,
  ExternalLink,
  ChevronRight,
  FileDown,
  ArrowLeft,
  RefreshCw,
  Upload
} from 'lucide-react';
import { Customer, Order, PageAccount } from '../types';
import {
  resolveCustomerOriginalPageAvatar,
  resolvePageOriginalAvatar,
  buildClientFallbackAvatarDataUrl,
} from '../utils/avatarUtils';

interface CustomerPanelProps {
  customer: Customer;
  orders: Order[];
  onUpdateCustomer: (updated: Partial<Customer>) => void;
  onOpenCreateOrder: () => void;
  onViewOrderInvoice: (orderId: string) => void;
  onExportConversationPdf?: () => void;
  selectedPage?: PageAccount;
  onBackToMainInbox?: () => void;
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

export const CustomerPanel: React.FC<CustomerPanelProps> = ({
  customer,
  orders,
  onUpdateCustomer,
  onOpenCreateOrder,
  onViewOrderInvoice,
  onExportConversationPdf,
  selectedPage,
  onBackToMainInbox,
  language,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [phone, setPhone] = useState(customer.phone);
  const [address, setAddress] = useState(customer.address);
  const [province, setProvince] = useState(customer.province);
  const [notes, setNotes] = useState(customer.notes);
  const [newTagInput, setNewTagInput] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Sync when customer changes
  React.useEffect(() => {
    setPhone(customer.phone);
    setAddress(customer.address);
    setProvince(customer.province);
    setNotes(customer.notes);
    setIsEditing(false);
  }, [customer.id]);

  const handleSave = () => {
    onUpdateCustomer({
      phone,
      address,
      province,
      notes,
    });
    setIsEditing(false);
  };

  const handleSyncOriginalPageAvatar = () => {
    const psid = customer.psid || customer.id || 'fb_cust';
    const pageId = selectedPage?.id || 'page_default';
    const pageName = selectedPage?.name || 'Facebook Page';
    const freshUrl = `/api/facebook/avatar/${encodeURIComponent(psid)}?pageId=${encodeURIComponent(pageId)}&name=${encodeURIComponent(customer.name)}&pageName=${encodeURIComponent(pageName)}&t=${Date.now()}`;
    onUpdateCustomer({ avatarUrl: freshUrl });
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        onUpdateCustomer({ avatarUrl: dataUrl });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    if (!customer.tags.includes(newTagInput.trim())) {
      onUpdateCustomer({
        tags: [...customer.tags, newTagInput.trim()],
      });
    }
    setNewTagInput('');
    setShowAddTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateCustomer({
      tags: customer.tags.filter((t) => t !== tagToRemove),
    });
  };

  const customerOrders = orders.filter(
    (o) => o.customerPhone === customer.phone || o.customerName === customer.name
  );

  const resolvedCustAvatar = resolveCustomerOriginalPageAvatar(customer, selectedPage);
  const resolvedPageAvatar = resolvePageOriginalAvatar(selectedPage);

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 overflow-y-auto">
      <input
        type="file"
        ref={avatarFileInputRef}
        onChange={handleAvatarUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Header with prominent Back to Main Inbox button */}
      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50/70">
        <div className="flex items-center gap-2 min-w-0">
          {onBackToMainInbox && (
            <button
              type="button"
              onClick={onBackToMainInbox}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer shrink-0"
              title="ត្រឡប់មកប្រអប់ដើមវិញ (Back to Main Inbox)"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{language === 'kh' ? 'មកប្រអប់ដើមវិញ' : 'Main Inbox'}</span>
            </button>
          )}
          <h3 className="text-xs font-bold text-slate-900 truncate">
            {language === 'kh' ? 'ប្រអប់អតិថិជន' : 'Customer Box'}
          </h3>
        </div>
        {isEditing ? (
          <button
            onClick={handleSave}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md cursor-pointer shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{language === 'kh' ? 'រក្សាទុក' : 'Save'}</span>
          </button>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800 p-1 rounded hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{language === 'kh' ? 'កែប្រែ' : 'Edit'}</span>
          </button>
        )}
      </div>

      <div className="p-4 space-y-5">
        {/* Dual Original Profile Card from Facebook Page (រូបដើមពីផេក) */}
        <div className="flex flex-col items-center text-center">
          <div className="relative flex items-center justify-center mb-2">
            {/* Customer Original Avatar from Page */}
            <img
              src={resolvedCustAvatar}
              alt={customer.name}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = buildClientFallbackAvatarDataUrl(
                  customer.name,
                  selectedPage?.name
                );
              }}
              className="w-16 h-16 rounded-full object-cover border-2 border-blue-500 shadow-sm bg-slate-100 z-10"
            />
            {/* Paired / Overlapping Original Page Profile Picture */}
            <img
              src={resolvedPageAvatar}
              alt={selectedPage?.name || 'Facebook Page'}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = buildClientFallbackAvatarDataUrl(
                  selectedPage?.name || 'Page',
                  'FB Page'
                );
              }}
              className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-md -ml-3 mt-4 bg-white z-20"
              title={`រូបដើមផេក៖ ${selectedPage?.name || 'Facebook Page'}`}
            />
          </div>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold mb-1">
            <span>រូប Profile ដើមពីផេក ({selectedPage?.name.split(' - ')[0] || 'Facebook Page'})</span>
          </span>

          <h4 className="font-semibold text-slate-900 text-sm">{customer.name}</h4>
          <span className="text-xs text-slate-500 capitalize">{customer.platform} Shopper</span>

          {/* Quick Buttons to Sync Original Profile from Page or Upload Custom Photo */}
          <div className="flex items-center justify-center gap-1.5 mt-2 w-full">
            <button
              type="button"
              onClick={handleSyncOriginalPageAvatar}
              className="flex-1 py-1 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="ទាញយករូប Profile ដើមពីផេក Facebook"
            >
              <RefreshCw className="w-3 h-3" />
              <span>រូបដើមពីផេក</span>
            </button>
            <button
              type="button"
              onClick={() => avatarFileInputRef.current?.click()}
              className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="ប្តូររូបភាព Profile អតិថិជន"
            >
              <Upload className="w-3 h-3" />
              <span>ប្តូររូប</span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 w-full mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-left">
            <div>
              <p className="text-[10px] text-slate-400">
                {language === 'kh' ? 'ការកុម្ម៉ង់សរុប' : 'Total Orders'}
              </p>
              <p className="text-xs font-bold text-slate-800 tabular-nums">
                {customerOrders.length} {language === 'kh' ? 'ដង' : 'orders'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">
                {language === 'kh' ? 'ទឹកប្រាក់សរុប' : 'Total Spent'}
              </p>
              <p className="text-xs font-bold text-emerald-600 tabular-nums">
                ${customerOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2)}
              </p>
            </div>
          </div>

          {onExportConversationPdf && (
            <button
              type="button"
              onClick={onExportConversationPdf}
              className="w-full mt-3 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
              title={
                language === 'kh'
                  ? 'ទាញយកប្រវត្តិសន្ទនាអតិថិជនទាំងអស់ជាឯកសារ PDF'
                  : 'Export full conversation history as PDF document'
              }
            >
              <FileDown className="w-3.5 h-3.5 text-sky-400" />
              <span>
                {language === 'kh'
                  ? 'ទាញយកប្រវត្តិឆាតជា PDF'
                  : 'Export Chat History (PDF)'}
              </span>
            </button>
          )}
        </div>

        {/* Contact & Delivery Details */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            {language === 'kh' ? 'ព័ត៌មានទំនាក់ទំនង' : 'Contact & Address'}
          </p>

          {/* Phone */}
          <div>
            <label className="text-[11px] text-slate-500 flex items-center gap-1 mb-1">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{language === 'kh' ? 'លេខទូរស័ព្ទ' : 'Phone'}</span>
            </label>
            {isEditing ? (
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="012 xxx xxx"
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-500"
              />
            ) : (
              <p className="text-xs font-medium text-slate-800 tabular-nums">
                {customer.phone || 'មិនទាន់មានលេខទូរស័ព្ទ'}
              </p>
            )}
          </div>

          {/* Province */}
          <div>
            <label className="text-[11px] text-slate-500 flex items-center gap-1 mb-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>{language === 'kh' ? 'ខេត្ត / ក្រុង' : 'Province / City'}</span>
            </label>
            {isEditing ? (
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-500"
              >
                {CAMBODIAN_PROVINCES.map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs font-medium text-slate-800">{customer.province || 'មិនទាន់បញ្ជាក់'}</p>
            )}
          </div>

          {/* Detailed Address */}
          <div>
            <label className="text-[11px] text-slate-500 flex items-center gap-1 mb-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>{language === 'kh' ? 'អាសយដ្ឋានលម្អិត' : 'Detailed Address'}</span>
            </label>
            {isEditing ? (
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                placeholder="ផ្ទះលេខ ផ្លូវ..."
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-500"
              />
            ) : (
              <p className="text-xs text-slate-700 leading-relaxed">
                {customer.address || 'មិនទាន់មានអាសយដ្ឋាន'}
              </p>
            )}
          </div>
        </div>

        {/* Customer Tags */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Tag className="w-3 h-3 text-slate-400" />
              {language === 'kh' ? 'ស្លាកសម្គាល់ (Tags)' : 'Tags'}
            </span>
            <button
              onClick={() => setShowAddTag(!showAddTag)}
              className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>{language === 'kh' ? 'ថែម' : 'Add'}</span>
            </button>
          </div>

          {showAddTag && (
            <div className="flex items-center gap-1 mb-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="ឧ. VIP, ទិញដុំ..."
                className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-md"
              />
              <button
                onClick={handleAddTag}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md font-medium cursor-pointer"
              >
                +
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {customer.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-md"
              >
                <span>{tag}</span>
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-red-500 text-slate-400 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Internal Admin Notes */}
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            {language === 'kh' ? 'កំណត់សម្គាល់ផ្ទៃក្នុង (Notes)' : 'Internal Notes'}
          </label>
          {isEditing ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="ចំណាំ..."
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md"
            />
          ) : (
            <p className="text-xs text-slate-600 bg-amber-50/60 border border-amber-100 p-2.5 rounded-lg leading-relaxed">
              {customer.notes || (language === 'kh' ? 'គ្មានកំណត់សម្គាល់' : 'No notes')}
            </p>
          )}
        </div>

        {/* Orders list for this customer */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <ShoppingBag className="w-3 h-3 text-slate-400" />
              {language === 'kh' ? 'ប្រវត្តិកុម្ម៉ង់ទំនិញ' : 'Order History'}
            </span>
            <button
              onClick={onOpenCreateOrder}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              + {language === 'kh' ? 'កុម្ម៉ង់ថ្មី' : 'New'}
            </button>
          </div>

          <div className="space-y-2">
            {customerOrders.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                {language === 'kh' ? 'មិនទាន់មានការកុម្ម៉ង់ពីមុនទេ' : 'No previous orders'}
              </div>
            ) : (
              customerOrders.map((ord) => (
                <div
                  key={ord.id}
                  onClick={() => onViewOrderInvoice(ord.id)}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-900">
                        #{ord.orderNumber}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-emerald-100 text-emerald-800">
                        {ord.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      {ord.createdAt} • ${ord.total.toFixed(2)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
