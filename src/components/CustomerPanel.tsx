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
  Upload,
  Palette
} from 'lucide-react';
import { Customer, Order, PageAccount } from '../types';
import {
  resolveCustomerOriginalPageAvatar,
  resolvePageOriginalAvatar,
  buildClientFallbackAvatarDataUrl,
} from '../utils/avatarUtils';
import {
  TAG_COLOR_PALETTE,
  DEFAULT_TAG_PRESETS,
  TagColorKey,
  TagPresetItem,
  loadSavedTagColorMap,
  saveTagColorMap,
  loadSavedTagPresets,
  saveTagPresets,
  getTagColorTheme,
} from '../utils/tagColors';

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
  const [selectedNewTagColor, setSelectedNewTagColor] = useState<TagColorKey>('blue');
  const [showAddTag, setShowAddTag] = useState(false);
  const [editingColorForTag, setEditingColorForTag] = useState<string | null>(null);
  const [tagColorMap, setTagColorMap] = useState<Record<string, TagColorKey>>(() =>
    loadSavedTagColorMap()
  );
  const [tagPresets, setTagPresets] = useState<TagPresetItem[]>(() =>
    loadSavedTagPresets()
  );
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Sync when customer changes
  React.useEffect(() => {
    setPhone(customer.phone);
    setAddress(customer.address);
    setProvince(customer.province);
    setNotes(customer.notes);
    setIsEditing(false);
    setEditingColorForTag(null);
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
    const trimmed = newTagInput.trim();
    if (!trimmed) return;

    const updatedColorMap: Record<string, TagColorKey> = {
      ...tagColorMap,
      [trimmed]: selectedNewTagColor,
    };
    setTagColorMap(updatedColorMap);
    saveTagColorMap(updatedColorMap);

    // Save to reusable presets if not already present
    if (!tagPresets.some((p) => p.label === trimmed)) {
      const updatedPresets: TagPresetItem[] = [
        ...tagPresets,
        { label: trimmed, color: selectedNewTagColor, isSystem: false },
      ];
      setTagPresets(updatedPresets);
      saveTagPresets(updatedPresets);
    }

    const updatedCustomerTagColors = {
      ...(customer.tagColors || {}),
      [trimmed]: selectedNewTagColor,
    };

    if (!customer.tags.includes(trimmed)) {
      onUpdateCustomer({
        tags: [...customer.tags, trimmed],
        tagColors: updatedCustomerTagColors,
      });
    } else {
      onUpdateCustomer({
        tagColors: updatedCustomerTagColors,
      });
    }
    setNewTagInput('');
  };

  const handleTogglePresetTag = (preset: TagPresetItem) => {
    const exists = customer.tags.includes(preset.label);
    if (exists) {
      onUpdateCustomer({
        tags: customer.tags.filter((t) => t !== preset.label),
      });
    } else {
      const chosenColor = tagColorMap[preset.label] || preset.color;
      const updatedCustomerTagColors = {
        ...(customer.tagColors || {}),
        [preset.label]: chosenColor,
      };
      onUpdateCustomer({
        tags: [...customer.tags, preset.label],
        tagColors: updatedCustomerTagColors,
      });
    }
  };

  const handleChangeTagColor = (tag: string, newColor: TagColorKey) => {
    const updatedColorMap: Record<string, TagColorKey> = {
      ...tagColorMap,
      [tag]: newColor,
    };
    setTagColorMap(updatedColorMap);
    saveTagColorMap(updatedColorMap);

    const updatedPresets = tagPresets.map((p) =>
      p.label === tag ? { ...p, color: newColor } : p
    );
    setTagPresets(updatedPresets);
    saveTagPresets(updatedPresets);

    onUpdateCustomer({
      tagColors: {
        ...(customer.tagColors || {}),
        [tag]: newColor,
      },
    });
    setEditingColorForTag(null);
  };

  const handleDeleteCustomPreset = (labelToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedPresets = tagPresets.filter((p) => p.label !== labelToDelete);
    setTagPresets(updatedPresets);
    saveTagPresets(updatedPresets);
  };

  const handleResetDefaultPresets = () => {
    setTagPresets(DEFAULT_TAG_PRESETS);
    saveTagPresets(DEFAULT_TAG_PRESETS);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateCustomer({
      tags: customer.tags.filter((t) => t !== tagToRemove),
    });
    if (editingColorForTag === tagToRemove) {
      setEditingColorForTag(null);
    }
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

        {/* Customer Color-Coded Tags */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {language === 'kh' ? 'ស្លាកសម្គាល់ពណ៌ (Customer Tags)' : 'Color-Coded Tags'}
              </span>
              {customer.tags.length > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full">
                  {customer.tags.length}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                setShowAddTag(!showAddTag);
                setEditingColorForTag(null);
              }}
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 transition-colors cursor-pointer ${
                showAddTag
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
              }`}
            >
              <Palette className="w-3 h-3" />
              <span>
                {showAddTag
                  ? language === 'kh'
                    ? 'បិទផ្ទាំងពណ៌'
                    : 'Done'
                  : language === 'kh'
                  ? '+ ថែម / គ្រប់គ្រងពណ៌'
                  : '+ Add / Colors'}
              </span>
            </button>
          </div>

          {/* Active Customer Tags with Color Coding */}
          {customer.tags.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic py-0.5">
              {language === 'kh'
                ? 'មិនទាន់មានស្លាកសម្គាល់ — ចុចជ្រើសរើសស្លាករហ័សខាងក្រោម'
                : 'No tags assigned — click a quick tag below'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {customer.tags.map((tag) => {
                const theme = getTagColorTheme(tag, customer.tagColors, tagColorMap);
                const isEditingThisTag = editingColorForTag === tag;
                return (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-md border transition-all ${theme.bgClass} ${theme.textClass} ${theme.borderClass}`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setEditingColorForTag(isEditingThisTag ? null : tag)
                      }
                      className={`w-2.5 h-2.5 rounded-full shrink-0 cursor-pointer ring-offset-1 hover:ring-2 ${theme.dotClass} ${theme.ringClass}`}
                      title={
                        language === 'kh'
                          ? 'ចុចប្តូរពណ៌ស្លាកនេះ'
                          : 'Click to change tag color'
                      }
                    />
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="opacity-70 hover:opacity-100 hover:text-rose-600 cursor-pointer ml-0.5"
                      title={language === 'kh' ? 'ដកស្លាកចេញ' : 'Remove tag'}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Inline Color Changer when clicking a tag's dot */}
          {editingColorForTag && (
            <div className="p-2 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                <span>
                  {language === 'kh'
                    ? `ប្តូរពណ៌សម្រាប់ "${editingColorForTag}"៖`
                    : `Change color for "${editingColorForTag}":`}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingColorForTag(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {TAG_COLOR_PALETTE.map((c) => {
                  const activeKey = getTagColorTheme(
                    editingColorForTag,
                    customer.tagColors,
                    tagColorMap
                  ).key;
                  const isCurrent = activeKey === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => handleChangeTagColor(editingColorForTag, c.key)}
                      className={`w-5 h-5 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                        c.swatchClass
                      } ${isCurrent ? 'ring-2 ring-offset-1 ring-slate-800 scale-110' : ''}`}
                      title={language === 'kh' ? c.labelKh : c.labelEn}
                    >
                      {isCurrent && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Tag Creator & Color Picker Drawer */}
          {showAddTag && (
            <div className="p-2.5 bg-white border border-blue-200 rounded-lg space-y-2.5 shadow-2xs">
              <div className="text-[11px] font-semibold text-slate-700">
                {language === 'kh'
                  ? 'បង្កើតស្លាកសម្គាល់ថ្មី & ជ្រើសពណ៌៖'
                  : 'Create Custom Color-Coded Tag:'}
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder={
                    language === 'kh'
                      ? 'វាយឈ្មោះស្លាក (ឧ. សួរស្តុក, រង់ចាំឆ្លើយ)...'
                      : 'Tag name (e.g. Follow Up, Wholesale)...'
                  }
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  disabled={!newTagInput.trim()}
                  className="px-2.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-md font-semibold cursor-pointer shrink-0 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === 'kh' ? 'ថែម' : 'Add'}</span>
                </button>
              </div>

              {/* Swatch Selector for New Tag */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>{language === 'kh' ? 'ជ្រើសរើសពណ៌ស្លាក៖' : 'Select tag color:'}</span>
                  {newTagInput.trim() && (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded border text-[10px] font-semibold ${
                        TAG_COLOR_PALETTE.find((p) => p.key === selectedNewTagColor)?.bgClass
                      } ${
                        TAG_COLOR_PALETTE.find((p) => p.key === selectedNewTagColor)?.textClass
                      } ${
                        TAG_COLOR_PALETTE.find((p) => p.key === selectedNewTagColor)?.borderClass
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          TAG_COLOR_PALETTE.find((p) => p.key === selectedNewTagColor)?.dotClass
                        }`}
                      />
                      {newTagInput.trim()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {TAG_COLOR_PALETTE.map((c) => {
                    const isSelected = selectedNewTagColor === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setSelectedNewTagColor(c.key)}
                        className={`w-5 h-5 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                          c.swatchClass
                        } ${
                          isSelected ? 'ring-2 ring-offset-1 ring-slate-800 scale-110' : 'opacity-80 hover:opacity-100'
                        }`}
                        title={language === 'kh' ? c.labelKh : c.labelEn}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Quick 1-Click Inquiry Organization Tags */}
          <div className="pt-1 border-t border-slate-200/70">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10.5px] font-semibold text-slate-500">
                {language === 'kh'
                  ? 'ចុចជ្រើសរើសរហ័ស (ចំណាត់ថ្នាក់សារអតិថិជន)៖'
                  : 'Quick Inquiry Tags (Click to toggle):'}
              </span>
              {showAddTag && (
                <button
                  type="button"
                  onClick={handleResetDefaultPresets}
                  className="text-[10px] text-slate-400 hover:text-blue-600 cursor-pointer"
                  title={language === 'kh' ? 'កំណត់ស្លាកដើមឡើងវិញ' : 'Reset default tags'}
                >
                  {language === 'kh' ? 'កំណត់ដើមវិញ' : 'Reset'}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {tagPresets.map((preset) => {
                const isAssigned = customer.tags.includes(preset.label);
                const theme = getTagColorTheme(
                  preset.label,
                  customer.tagColors,
                  { ...tagColorMap, [preset.label]: tagColorMap[preset.label] || preset.color }
                );
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleTogglePresetTag(preset)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md border transition-all cursor-pointer ${
                      isAssigned
                        ? `${theme.bgClass} ${theme.textClass} ${theme.borderClass} font-bold ring-1 ${theme.ringClass}/30`
                        : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200 font-medium opacity-85 hover:opacity-100'
                    }`}
                    title={
                      isAssigned
                        ? language === 'kh'
                          ? 'កំពុងប្រើ — ចុចដើម្បីដកចេញ'
                          : 'Assigned — click to remove'
                        : language === 'kh'
                        ? 'ចុចដើម្បីដាក់ស្លាកសម្គាល់នេះ'
                        : 'Click to assign tag'
                    }
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dotClass}`} />
                    <span>{preset.label}</span>
                    {isAssigned && <Check className="w-2.5 h-2.5 stroke-[2.5]" />}
                    {showAddTag && !preset.isSystem && (
                      <span
                        onClick={(e) => handleDeleteCustomPreset(preset.label, e)}
                        className="ml-0.5 text-slate-400 hover:text-rose-600"
                        title={language === 'kh' ? 'លុបស្លាកនេះពីបញ្ជីរហ័ស' : 'Delete custom preset'}
                      >
                        <X className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
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
