import React, { useState } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { Customer, Order } from '../types';

interface CustomerPanelProps {
  customer: Customer;
  orders: Order[];
  onUpdateCustomer: (updated: Partial<Customer>) => void;
  onOpenCreateOrder: () => void;
  onViewOrderInvoice: (orderId: string) => void;
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
  language,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [phone, setPhone] = useState(customer.phone);
  const [address, setAddress] = useState(customer.address);
  const [province, setProvince] = useState(customer.province);
  const [notes, setNotes] = useState(customer.notes);
  const [newTagInput, setNewTagInput] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);

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

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          {language === 'kh' ? 'ព័ត៌មានអតិថិជន (CRM)' : 'Customer Profile'}
        </h3>
        {isEditing ? (
          <button
            onClick={handleSave}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{language === 'kh' ? 'រក្សាទុក' : 'Save'}</span>
          </button>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800 p-1 rounded hover:bg-slate-100 cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{language === 'kh' ? 'កែប្រែ' : 'Edit'}</span>
          </button>
        )}
      </div>

      <div className="p-4 space-y-5">
        {/* Profile Card */}
        <div className="flex flex-col items-center text-center">
          <img
            src={customer.avatarUrl}
            alt={customer.name}
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-full object-cover border-2 border-slate-100 shadow-xs mb-2"
          />
          <h4 className="font-semibold text-slate-900 text-sm">{customer.name}</h4>
          <span className="text-xs text-slate-500 capitalize">{customer.platform} Shopper</span>

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
