import React, { useState, useRef } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Send, 
  DollarSign, 
  Tag, 
  Check, 
  ShoppingBag,
  Edit3,
  Trash2,
  Save,
  X,
  Upload,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  List
} from 'lucide-react';
import { ProductItem } from '../types';

interface ProductsCatalogViewProps {
  products: ProductItem[];
  onAddProduct: (prod: Omit<ProductItem, 'id'>) => Promise<void> | void;
  onEditProduct: (prod: ProductItem) => Promise<void> | void;
  onDeleteProduct: (id: string) => Promise<void> | void;
  onSendProductToChat?: (product: ProductItem) => void;
  onSyncAllProducts?: () => Promise<boolean> | boolean;
  language: 'kh' | 'en';
  isSyncing?: boolean;
}

const SAMPLE_IMAGES = [
  {
    name: 'រ៉ូបហូលខ្មែរ',
    url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'សេរ៉ូម Botanica',
    url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'កាសឥតខ្សែ Sonos',
    url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80',
  },
];

export const ProductsCatalogView: React.FC<ProductsCatalogViewProps> = ({
  products,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onSendProductToChat,
  onSyncAllProducts,
  language,
  isSyncing = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quick inline stock editing state
  const [inlineEditingStockId, setInlineEditingStockId] = useState<string | null>(null);
  const [inlineStockValue, setInlineStockValue] = useState<string>('');
  const [inlineEditingPriceId, setInlineEditingPriceId] = useState<string | null>(null);
  const [inlinePriceValue, setInlinePriceValue] = useState<string>('');

  // Add Product form state
  const [nameKh, setNameKh] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [price, setPrice] = useState('25.00');
  const [stock, setStock] = useState('20');
  const [sku, setSku] = useState('PRD-01');
  const [category, setCategory] = useState('Fashion');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80');
  const addFileInputRef = useRef<HTMLInputElement>(null);

  // Edit Product form state
  const [editNameKh, setEditNameKh] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editPrice, setEditPrice] = useState('25.00');
  const [editStock, setEditStock] = useState('20');
  const [editSku, setEditSku] = useState('');
  const [editCategory, setEditCategory] = useState('Fashion');
  const [editDescription, setEditDescription] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const categories = ['all', 'Fashion', 'Beauty', 'Electronics', 'General'];

  // Filter products by category, search query, and stock status
  const filtered = products.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.category.toLowerCase() === selectedCategory.toLowerCase();
    if (!matchesCategory) return false;

    if (stockStatusFilter === 'in_stock' && p.stock <= 5) return false;
    if (stockStatusFilter === 'low_stock' && (p.stock <= 0 || p.stock > 5)) return false;
    if (stockStatusFilter === 'out_of_stock' && p.stock > 0) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.nameKh.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalStockCount = products.reduce((acc, curr) => acc + (curr.stock || 0), 0);
  const totalStockValue = products.reduce((acc, curr) => acc + (curr.stock || 0) * (curr.price || 0), 0);
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;

  // Handle Add Product
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const pVal = parseFloat(price) || 0;
    const sVal = parseInt(stock, 10) || 0;
    const newProdData: Omit<ProductItem, 'id'> = {
      name: nameEn.trim() || nameKh.trim(),
      nameKh: nameKh.trim() || nameEn.trim(),
      price: pVal,
      priceKhr: Math.round(pVal * 4100),
      stock: sVal,
      sku: sku.trim() || `PRD-${Date.now().toString().slice(-4)}`,
      category,
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
      description,
    };
    try {
      await onAddProduct(newProdData);
      showToast('បានបង្កើតទំនិញថ្មីក្នុង Online ដោយជោគជ័យ!');
      setNameKh('');
      setNameEn('');
      setDescription('');
      setShowAddModal(false);
    } catch {
      showToast('ការរក្សាទុកមិនបានសម្រេច');
    }
  };

  // Open Edit Modal
  const openEditModal = (prod: ProductItem) => {
    setEditingProduct(prod);
    setEditNameKh(prod.nameKh);
    setEditNameEn(prod.name || prod.nameKh);
    setEditPrice(String(prod.price));
    setEditStock(String(prod.stock));
    setEditSku(prod.sku);
    setEditCategory(prod.category);
    setEditDescription(prod.description || '');
    setEditImageUrl(prod.imageUrl || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80');
  };

  // Save Edit to Online Store
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setIsSavingEdit(true);
    const pVal = parseFloat(editPrice) || 0;
    const sVal = parseInt(editStock, 10) || 0;
    const updated: ProductItem = {
      ...editingProduct,
      nameKh: editNameKh.trim() || editingProduct.nameKh,
      name: editNameEn.trim() || editNameKh.trim(),
      price: pVal,
      priceKhr: Math.round(pVal * 4100),
      stock: sVal,
      sku: editSku.trim() || editingProduct.sku,
      category: editCategory,
      description: editDescription,
      imageUrl: editImageUrl || editingProduct.imageUrl,
    };
    try {
      await onEditProduct(updated);
      setIsSavingEdit(false);
      setEditingProduct(null);
      showToast(`បានកែប្រែទំនិញ "${updated.nameKh}" ក្នុង Online រួចរាល់!`);
    } catch {
      setIsSavingEdit(false);
      showToast('ការកែប្រែមិនបានសម្រេច');
    }
  };

  // Quick adjust stock via + and -
  const handleQuickAdjustStock = async (prod: ProductItem, delta: number) => {
    const newStock = Math.max(0, (prod.stock || 0) + delta);
    const updated = { ...prod, stock: newStock };
    try {
      await onEditProduct(updated);
      showToast(`ស្តុក "${prod.nameKh}" ត្រូវបានកែប្រែទៅ ${newStock} ឯកតា (Online)`);
    } catch {
      showToast('កែប្រែស្តុកមិនបានសម្រេច');
    }
  };

  // Start inline editing stock
  const startInlineEditStock = (prod: ProductItem) => {
    setInlineEditingStockId(prod.id);
    setInlineStockValue(String(prod.stock || 0));
  };

  // Save inline stock edit
  const saveInlineStock = async (prod: ProductItem) => {
    const parsed = parseInt(inlineStockValue, 10);
    const newStock = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    const updated = { ...prod, stock: newStock };
    setInlineEditingStockId(null);
    try {
      await onEditProduct(updated);
      showToast(`ស្តុក "${prod.nameKh}" កែប្រែទៅ ${newStock} (រក្សាទុក Online រួចរាល់)`);
    } catch {
      showToast('រក្សាទុកស្តុក Online មិនបានសម្រេច');
    }
  };

  // Start inline editing price
  const startInlineEditPrice = (prod: ProductItem) => {
    setInlineEditingPriceId(prod.id);
    setInlinePriceValue(String(prod.price || 0));
  };

  // Save inline price edit
  const saveInlinePrice = async (prod: ProductItem) => {
    const parsed = parseFloat(inlinePriceValue);
    const newPrice = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    const updated = { 
      ...prod, 
      price: newPrice,
      priceKhr: Math.round(newPrice * 4100)
    };
    setInlineEditingPriceId(null);
    try {
      await onEditProduct(updated);
      showToast(`តម្លៃ "${prod.nameKh}" កែប្រែទៅ $${newPrice.toFixed(2)} (រក្សាទុក Online រួចរាល់)`);
    } catch {
      showToast('រក្សាទុកតម្លៃ Online មិនបានសម្រេច');
    }
  };

  // Handle Delete
  const handleDelete = async (prod: ProductItem) => {
    try {
      await onDeleteProduct(prod.id);
      showToast(`បានលុបទំនិញ "${prod.nameKh}" ពី Online រួចរាល់!`);
    } catch {
      showToast('លុបមិនបានសម្រេច');
    }
  };

  // Handle Batch Sync
  const handleBatchSyncClick = async () => {
    if (onSyncAllProducts) {
      const ok = await onSyncAllProducts();
      if (ok) {
        showToast('បានធ្វើសមកាលកម្មទំនិញទៅកាន់ Online Server ១០០%!');
      } else {
        showToast('ការតភ្ជាប់ទៅ Server មិនបានសម្រេច!');
      }
    } else {
      showToast('ទំនិញត្រូវបានរក្សាទុកក្នុង Online រួចរាល់!');
    }
  };

  // File upload reader
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEditMode: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        if (isEditMode) {
          setEditImageUrl(base64);
        } else {
          setImageUrl(base64);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-y-auto relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="p-5 md:p-6 bg-white border-b border-slate-200 shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5.5 h-5.5 text-blue-600" />
              <span>{language === 'kh' ? 'កាតាឡុកទំនិញ & ស្តុក (Product Catalog & Inventory)' : 'Product Catalog & Inventory'}</span>
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Online Synced (រក្សាទុកលើក្លោដ)</span>
            </span>
            {isSyncing && (
              <span className="text-[11px] text-blue-600 flex items-center gap-1 font-medium bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>កំពុង Sync ជាមួយ Server...</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'kh'
              ? 'អាចកែប្រែឈ្មោះ តម្លៃ ចំនួនស្តុក និងរូបភាពដោយសេរី ជាមួយប៊ូតុង Edit និង Save ផ្ទាល់លើ Online Database'
              : 'Edit name, price, stock quantities, and images with automatic persistent save to the online database'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View mode toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="ទិដ្ឋភាពក្រឡា (Grid Cards)"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">ក្រឡា</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="ទិដ្ឋភាពតារាង (Stock Table)"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">តារាងស្តុក</span>
            </button>
          </div>

          {/* Sync All Button */}
          <button
            onClick={handleBatchSyncClick}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-2xs hover:border-blue-400 cursor-pointer"
            title="ធ្វើសមកាលកម្មទិន្នន័យទំនិញទៅកាន់ Online Database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{language === 'kh' ? 'Sync Online' : 'Sync Online'}</span>
          </button>

          {/* Add Product Button */}
          <button
            onClick={() => {
              setNameKh('');
              setNameEn('');
              setPrice('25.00');
              setStock('20');
              setSku(`PRD-${Date.now().toString().slice(-4)}`);
              setDescription('');
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm hover:shadow cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'kh' ? '+ ថែមទំនិញថ្មី' : '+ Add Product'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="px-5 md:px-6 pt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider block">
            {language === 'kh' ? 'មុខទំនិញសរុប' : 'Total Items'}
          </span>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{products.length} មុខ</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider block">
            {language === 'kh' ? 'ចំនួនស្តុកសរុប' : 'Total In Stock'}
          </span>
          <p className="text-xl font-bold text-blue-600 mt-0.5">{totalStockCount} ឯកតា</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider block">
            {language === 'kh' ? 'តម្លៃស្តុកសរុប (USD)' : 'Total Inventory Value'}
          </span>
          <p className="text-xl font-bold text-emerald-600 tabular-nums mt-0.5">
            ${totalStockValue.toFixed(2)}
          </p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider block">
            {language === 'kh' ? 'ការជូនដំណឹងស្តុក' : 'Stock Alerts'}
          </span>
          <div className="flex items-center gap-2 mt-1 text-xs font-bold">
            {lowStockCount > 0 ? (
              <span className="text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{lowStockCount} ជិតអស់</span>
              </span>
            ) : (
              <span className="text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ស្តុកគ្រប់គ្រាន់</span>
              </span>
            )}
            {outOfStockCount > 0 && (
              <span className="text-rose-600 text-[11px]">({outOfStockCount} អស់ស្តុក)</span>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 md:p-6 space-y-4">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
          {/* Search box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'kh' ? 'ស្វែងរកឈ្មោះទំនិញ, SKU, ប្រភេទ...' : 'Search products or SKU...'}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Categories and Stock Status */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {/* Category pills */}
            <div className="flex items-center gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'all' ? (language === 'kh' ? 'ទាំងអស់' : 'All') : cat}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block"></div>

            {/* Stock status filter */}
            <select
              value={stockStatusFilter}
              onChange={(e: any) => setStockStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">គ្រប់ស្ថានភាពស្តុក</option>
              <option value="in_stock">នៅសល់ច្រើន (&gt; 5)</option>
              <option value="low_stock">ជិតអស់ពីស្តុក (1-5)</option>
              <option value="out_of_stock">អស់ពីស្តុក (0)</option>
            </select>
          </div>
        </div>

        {/* ========================================================= */}
        {/* VIEW 1: GRID CARDS VIEW */}
        {/* ========================================================= */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((prod) => (
              <div
                key={prod.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Image */}
                  <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
                    <img
                      src={prod.imageUrl}
                      alt={prod.nameKh}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-mono rounded-md shadow-2xs">
                        {prod.sku}
                      </span>
                      <span className="px-2 py-0.5 bg-blue-600/90 backdrop-blur-xs text-white text-[10px] font-semibold rounded-md shadow-2xs">
                        {prod.category}
                      </span>
                    </div>

                    {/* Top Right Quick Actions */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(prod)}
                        className="p-1.5 bg-white/95 hover:bg-white text-blue-600 rounded-lg shadow-sm transition-all hover:scale-105 cursor-pointer"
                        title={language === 'kh' ? 'កែប្រែទំនិញ (Edit & Save Online)' : 'Edit product online'}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(prod)}
                        className="p-1.5 bg-white/95 hover:bg-white text-rose-600 rounded-lg shadow-sm transition-all hover:scale-105 cursor-pointer"
                        title={language === 'kh' ? 'លុបទំនិញ' : 'Delete product'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-1 mb-1" title={prod.nameKh}>
                      {prod.nameKh}
                    </h3>
                    {prod.name && prod.name !== prod.nameKh && (
                      <p className="text-[11px] text-slate-400 line-clamp-1 mb-1.5">{prod.name}</p>
                    )}
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                      {prod.description || 'គ្មានការពិពណ៌នា'}
                    </p>

                    <div className="flex items-baseline justify-between pt-2 border-t border-slate-100">
                      {/* Price (Click to edit inline) */}
                      <div>
                        {inlineEditingPriceId === prod.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-slate-500">$</span>
                            <input
                              type="number"
                              step="0.5"
                              value={inlinePriceValue}
                              onChange={(e) => setInlinePriceValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveInlinePrice(prod);
                                if (e.key === 'Escape') setInlineEditingPriceId(null);
                              }}
                              className="w-16 px-1 py-0.5 text-xs font-bold text-blue-600 border border-blue-400 rounded focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => saveInlinePrice(prod)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                              title="រក្សាទុក Online"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setInlineEditingPriceId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => startInlineEditPrice(prod)}
                            className="cursor-pointer group/price flex items-baseline gap-1"
                            title="ចុចដើម្បីកែប្រែតម្លៃភ្លាមៗ"
                          >
                            <div>
                              <p className="text-base font-bold text-blue-600 tabular-nums flex items-center gap-1">
                                <span>${prod.price.toFixed(2)}</span>
                                <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover/price:opacity-100 text-slate-400 transition-opacity" />
                              </p>
                              <p className="text-[10px] text-slate-400 tabular-nums">
                                ស្មើនឹង {prod.priceKhr ? prod.priceKhr.toLocaleString() : Math.round(prod.price * 4100).toLocaleString()} ៛
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Stock with quick buttons and inline edit */}
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-medium">ស្តុកនៅសល់</span>
                        {inlineEditingStockId === prod.id ? (
                          <div className="flex items-center gap-1 mt-0.5 justify-end">
                            <input
                              type="number"
                              min="0"
                              value={inlineStockValue}
                              onChange={(e) => setInlineStockValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveInlineStock(prod);
                                if (e.key === 'Escape') setInlineEditingStockId(null);
                              }}
                              className="w-14 px-1 py-0.5 text-xs font-bold text-slate-900 border border-blue-400 rounded text-center focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => saveInlineStock(prod)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                              title="រក្សាទុក Online"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setInlineEditingStockId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                            <button
                              type="button"
                              onClick={() => handleQuickAdjustStock(prod, -1)}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs transition-colors cursor-pointer"
                              title="ដកស្តុក -1 (រក្សាទុក Online)"
                            >
                              -
                            </button>
                            <span 
                              onClick={() => startInlineEditStock(prod)}
                              title="ចុចដើម្បីវាយបញ្ចូលចំនួនស្តុកថ្មី"
                              className={`text-xs font-bold tabular-nums px-1 cursor-pointer hover:underline ${
                                prod.stock <= 0 ? 'text-rose-600' : prod.stock <= 5 ? 'text-amber-600' : 'text-slate-800'
                              }`}
                            >
                              {prod.stock}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuickAdjustStock(prod, 1)}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs transition-colors cursor-pointer"
                              title="ថែមស្តុក +1 (រក្សាទុក Online)"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(prod)}
                    className="flex-1 py-1.5 px-2 text-xs font-bold text-slate-700 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3 text-blue-600" />
                    <span>{language === 'kh' ? 'កែប្រែ (Edit)' : 'Edit'}</span>
                  </button>
                  {onSendProductToChat && (
                    <button
                      onClick={() => onSendProductToChat(prod)}
                      className="flex-1 py-1.5 px-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Send className="w-3 h-3" />
                      <span>{language === 'kh' ? 'ផ្ញើទៅឆាត' : 'Send'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: TABLE / SPREADSHEET INVENTORY VIEW */}
        {/* ========================================================= */}
        {viewMode === 'table' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">រូបភាព</th>
                    <th className="py-3 px-4">កូដ SKU</th>
                    <th className="py-3 px-4">ឈ្មោះទំនិញ</th>
                    <th className="py-3 px-4">ប្រភេទ</th>
                    <th className="py-3 px-4">តម្លៃ ($ USD / រៀល)</th>
                    <th className="py-3 px-4 text-center">ស្តុក</th>
                    <th className="py-3 px-4">ស្ថានភាព</th>
                    <th className="py-3 px-4 text-right">សកម្មភាព</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filtered.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* Image */}
                      <td className="py-2.5 px-4">
                        <img
                          src={prod.imageUrl}
                          alt={prod.nameKh}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80';
                          }}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                        />
                      </td>

                      {/* SKU */}
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-600">
                        {prod.sku}
                      </td>

                      {/* Name */}
                      <td className="py-2.5 px-4">
                        <p className="font-bold text-slate-900">{prod.nameKh}</p>
                        {prod.name && prod.name !== prod.nameKh && (
                          <p className="text-[11px] text-slate-400">{prod.name}</p>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {prod.category}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-2.5 px-4 font-bold text-blue-600 tabular-nums">
                        ${prod.price.toFixed(2)}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          ស្មើនឹង {prod.priceKhr ? prod.priceKhr.toLocaleString() : Math.round(prod.price * 4100).toLocaleString()} ៛
                        </span>
                      </td>

                      {/* Stock +/- inline */}
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuickAdjustStock(prod, -1)}
                            className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs cursor-pointer"
                            title="ដកស្តុក -1"
                          >
                            -
                          </button>
                          <span className={`font-bold tabular-nums px-1 min-w-6 text-center ${
                            prod.stock <= 0 ? 'text-rose-600' : prod.stock <= 5 ? 'text-amber-600' : 'text-slate-800'
                          }`}>
                            {prod.stock}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuickAdjustStock(prod, 1)}
                            className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs cursor-pointer"
                            title="ថែមស្តុក +1"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Stock status badge */}
                      <td className="py-2.5 px-4">
                        {prod.stock <= 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            អស់ពីស្តុក
                          </span>
                        ) : prod.stock <= 5 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            ជិតអស់ ({prod.stock})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            មានក្នុងស្តុក
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(prod)}
                            className="p-1.5 bg-slate-100 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors cursor-pointer"
                            title="កែប្រែទំនិញ (Edit Online)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {onSendProductToChat && (
                            <button
                              onClick={() => onSendProductToChat(prod)}
                              className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                              title="ផ្ញើទៅឆាត"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(prod)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="លុបទំនិញ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700">មិនមានទំនិញត្រូវនឹងលក្ខខណ្ឌស្វែងរកទេ</h3>
            <p className="text-xs text-slate-400 mt-1">សូមសាកល្បងផ្លាស់ប្តូរពាក្យស្វែងរក ឬប្រភេទផ្សេង</p>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* EDIT PRODUCT MODAL (SAVE ONLINE PERSISTENTLY) */}
      {/* ========================================================= */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Hidden file input for edit image upload */}
            <input
              type="file"
              ref={editFileInputRef}
              onChange={(e) => handleImageFileChange(e, true)}
              accept="image/*"
              className="hidden"
            />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Edit3 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>{language === 'kh' ? 'កែប្រែទិន្នន័យទំនិញ (Edit & Save Online)' : 'Edit Product Online'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Cloud DB
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">កែប្រែរួចនឹងរក្សាទុកក្នុង Online Database ភ្លាមៗ</p>
                </div>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Product Image preview and upload */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  {language === 'kh' ? 'រូបភាពទំនិញ (Product Image)' : 'Product Photo'}
                </label>
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => editFileInputRef.current?.click()}
                    title="ចុចដើម្បីប្តូររូបភាព"
                    className="w-20 h-20 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 relative group cursor-pointer shrink-0"
                  >
                    <img
                      src={editImageUrl}
                      alt="Product"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                      <Upload className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{language === 'kh' ? 'ប្តូររូបថ្មី (Upload)' : 'Upload New Photo'}</span>
                    </button>
                    
                    {/* Sample image quick picks */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-slate-400">គំរូ:</span>
                      {SAMPLE_IMAGES.map((sample, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setEditImageUrl(sample.url)}
                          className="w-6 h-6 rounded-md overflow-hidden border border-slate-200 hover:border-blue-500 transition-colors cursor-pointer"
                          title={sample.name}
                        >
                          <img src={sample.url} alt={sample.name} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Khmer Name */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {language === 'kh' ? 'ឈ្មោះទំនិញ (ភាសាខ្មែរ) *' : 'Khmer Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={editNameKh}
                  onChange={(e) => setEditNameKh(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                />
              </div>

              {/* English Name */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {language === 'kh' ? 'ឈ្មោះទំនិញជាភាសាអង់គ្លេស (English / Latin Name)' : 'English Name'}
                </label>
                <input
                  type="text"
                  value={editNameEn}
                  onChange={(e) => setEditNameEn(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Price & Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {language === 'kh' ? 'តម្លៃលក់ ($ USD) *' : 'Price ($ USD) *'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-blue-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
                    ស្មើនឹង {Math.round((parseFloat(editPrice) || 0) * 4100).toLocaleString()} រៀល
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {language === 'kh' ? 'ចំនួនក្នុងស្តុក (Stock) *' : 'Stock Quantity *'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {parseInt(editStock, 10) <= 0 ? '⚠️ អស់ពីស្តុក' : parseInt(editStock, 10) <= 5 ? '⚠️ ជិតអស់' : '✓ គ្រប់គ្រាន់'}
                  </p>
                </div>
              </div>

              {/* SKU & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    កូដ SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    ប្រភេទ (Category)
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium cursor-pointer"
                  >
                    <option value="Fashion">Fashion (សម្លៀកបំពាក់)</option>
                    <option value="Beauty">Beauty (គ្រឿងសម្អាង)</option>
                    <option value="Electronics">Electronics (អេឡិចត្រូនិក)</option>
                    <option value="General">General (ទូទៅ)</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ការពិពណ៌នាទំនិញ
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="ពិពណ៌នាលម្អិត..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleDelete(editingProduct)}
                  className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>លុបទំនិញ</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    បោះបង់
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingEdit ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>កំពុងរក្សាទុក Online...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>រក្សាទុក Online</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ADD NEW PRODUCT MODAL */}
      {/* ========================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Hidden file input */}
            <input
              type="file"
              ref={addFileInputRef}
              onChange={(e) => handleImageFileChange(e, false)}
              accept="image/*"
              className="hidden"
            />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>{language === 'kh' ? 'បន្ថែមទំនិញថ្មី (Save Online)' : 'Add New Product'}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5">
              {/* Product Photo upload */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {language === 'kh' ? 'រូបភាពទំនិញ' : 'Product Photo'}
                </label>
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => addFileInputRef.current?.click()}
                    className="w-16 h-16 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 relative group cursor-pointer shrink-0"
                  >
                    <img
                      src={imageUrl}
                      alt="New Product"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                      <Upload className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => addFileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>ជ្រើសរើសរូប (Upload)</span>
                    </button>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-slate-400">គំរូ:</span>
                      {SAMPLE_IMAGES.map((sample, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setImageUrl(sample.url)}
                          className="w-5 h-5 rounded-md overflow-hidden border border-slate-200 hover:border-blue-500 transition-colors cursor-pointer"
                          title={sample.name}
                        >
                          <img src={sample.url} alt={sample.name} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {language === 'kh' ? 'ឈ្មោះទំនិញ (ខ្មែរ) *' : 'Product Name (Khmer) *'}
                </label>
                <input
                  type="text"
                  required
                  value={nameKh}
                  onChange={(e) => setNameKh(e.target.value)}
                  placeholder="ឧ. រ៉ូបហូលខ្មែរ..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {language === 'kh' ? 'តម្លៃ ($ USD) *' : 'Price ($ USD) *'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none font-bold text-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {language === 'kh' ? 'ចំនួនស្តុក *' : 'Stock *'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">កូដ SKU</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">ប្រភេទ</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none font-medium cursor-pointer"
                  >
                    <option value="Fashion">Fashion</option>
                    <option value="Beauty">Beauty</option>
                    <option value="Electronics">Electronics</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">ការពិពណ៌នា</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ព័ត៌មានលម្អិត..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>រក្សាទុក Online</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
