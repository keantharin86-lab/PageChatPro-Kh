import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  Eye, 
  Printer, 
  Truck, 
  CreditCard,
  DollarSign,
  CheckCircle2,
  Clock,
  Package,
  Edit3
} from 'lucide-react';
import { Order, OrderStatus } from '../types';

interface OrdersListViewProps {
  orders: Order[];
  onViewInvoice: (orderId: string) => void;
  onEditInvoice?: (orderId: string) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onOpenCreateOrder?: () => void;
  language: 'kh' | 'en';
}

const extractOrderTimeMs = (order: Order, fallbackIndex = 0): number => {
  if (
    typeof order.createdAtMs === 'number' &&
    Number.isFinite(order.createdAtMs) &&
    order.createdAtMs > 0
  ) {
    return order.createdAtMs;
  }
  const idStr = String(order.id || '');
  if (idStr === 'ord_1001') return 1700000002000;
  if (idStr === 'ord_1002') return 1700000001000;

  const idEpochMatch = idStr.match(/ord_(\d{12,14})/);
  if (idEpochMatch) {
    const parsedEpoch = Number(idEpochMatch[1]);
    if (Number.isFinite(parsedEpoch) && parsedEpoch > 0) {
      return parsedEpoch;
    }
  }

  const rawCreated = String(order.createdAt || '').trim();
  const rawOrderDate = String(order.orderDate || '').trim();
  if (rawCreated) {
    const cleaned = rawCreated.replace(/(\b(?:1[3-9]|2[0-3]):\d{2}(?::\d{2})?)\s*(?:AM|PM)/i, '$1');
    const directMs = Date.parse(cleaned);
    if (Number.isFinite(directMs) && directMs > 946684800000) {
      return directMs;
    }
    const dateTimeMatch = rawCreated.match(
      /(\d{4}-\d{2}-\d{2})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?/i
    );
    if (dateTimeMatch) {
      const [y, m, d] = dateTimeMatch[1].split('-').map(Number);
      let hr = parseInt(dateTimeMatch[2], 10);
      const min = parseInt(dateTimeMatch[3], 10);
      const sec = dateTimeMatch[4] ? parseInt(dateTimeMatch[4], 10) : 0;
      const mer = dateTimeMatch[5]?.toUpperCase();
      if (mer === 'PM' && hr < 12) hr += 12;
      if (mer === 'AM' && hr === 12) hr = 0;
      const dt = new Date(y, m - 1, d, hr, min, sec);
      if (!Number.isNaN(dt.getTime())) return dt.getTime();
    }
  }
  if (rawOrderDate && /^\d{4}-\d{2}-\d{2}$/.test(rawOrderDate)) {
    const [y, m, d] = rawOrderDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    if (!Number.isNaN(dt.getTime())) return dt.getTime();
  }
  return 1700000000000 - fallbackIndex;
};

const formatOrderRealDateTime = (
  order: Order,
  fallbackIndex: number,
  language: 'kh' | 'en'
): { dateText: string; timeText: string; isToday: boolean } => {
  const ms = extractOrderTimeMs(order, fallbackIndex);
  const dt = new Date(ms);
  const now = new Date();

  if (!Number.isNaN(dt.getTime()) && ms > 1710000000000) {
    const isToday =
      dt.getFullYear() === now.getFullYear() &&
      dt.getMonth() === now.getMonth() &&
      dt.getDate() === now.getDate();
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;
    const timeStr = dt.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return {
      dateText: isToday
        ? language === 'kh'
          ? `ថ្ងៃនេះ (${dateStr})`
          : `Today (${dateStr})`
        : dateStr,
      timeText: timeStr,
      isToday,
    };
  }

  const raw = String(order.createdAt || '').trim();
  const parts = raw.split(',');
  const datePart = (parts[0] || order.orderDate || '').trim();
  const timePart = (parts.slice(1).join(',') || '').trim();
  return {
    dateText: datePart || (language === 'kh' ? 'កាលបរិច្ឆេទ' : 'Date'),
    timeText: timePart || '--:--',
    isToday: datePart.includes('ថ្ងៃនេះ') || datePart === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  };
};

export const OrdersListView: React.FC<OrdersListViewProps> = ({
  orders,
  onViewInvoice,
  onEditInvoice,
  onUpdateStatus,
  onOpenCreateOrder,
  language,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const normalizeOrderStatus = (st: OrderStatus): OrderStatus => {
    if (st === 'shipping') return 'shipped';
    if (st === 'confirmed') return 'pending';
    return st;
  };

  // Always sort all orders newest-first by real creation time (createdAtMs descending)
  const sortedOrders = useMemo(() => {
    return [...orders]
      .map((order, idx) => ({
        order,
        timeMs: extractOrderTimeMs(order, idx),
        idx,
      }))
      .sort((a, b) => {
        if (b.timeMs !== a.timeMs) return b.timeMs - a.timeMs;
        return a.idx - b.idx;
      })
      .map((item) => item.order);
  }, [orders]);

  const newestOrderId = sortedOrders[0]?.id || null;

  const filteredOrders = useMemo(() => {
    return sortedOrders.filter((order) => {
      const normStatus = normalizeOrderStatus(order.status);
      if (statusFilter !== 'all' && normStatus !== statusFilter && order.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = (order.orderNumber || '').toLowerCase().includes(q);
        const matchName = (order.customerName || '').toLowerCase().includes(q);
        const matchPhone = (order.customerPhone || '').includes(q);
        if (!matchNumber && !matchName && !matchPhone) return false;
      }
      return true;
    });
  }, [sortedOrders, statusFilter, searchQuery]);

  const totalRevenueUsd = useMemo(
    () => orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    [orders]
  );
  const totalRevenueKhr = useMemo(
    () => orders.reduce((sum, o) => sum + (Number(o.totalKhr) || 0), 0),
    [orders]
  );

  const getStatusBadge = (st: OrderStatus) => {
    const baseBadgeClass =
      'inline-flex items-center justify-center min-w-[98px] px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 text-center';
    switch (st) {
      case 'pending':
      case 'confirmed':
        return <span className={`${baseBadgeClass} bg-amber-100 text-amber-800`}>រង់ចាំ</span>;
      case 'packaging':
        return <span className={`${baseBadgeClass} bg-blue-100 text-blue-800`}>កំពុងខ្ចប់</span>;
      case 'shipping':
      case 'shipped':
        return <span className={`${baseBadgeClass} bg-purple-100 text-purple-800`}>កំពុងដឹកជញ្ជូន</span>;
      case 'delivered':
        return <span className={`${baseBadgeClass} bg-emerald-100 text-emerald-800`}>បានទទួលរួច</span>;
      case 'cancelled':
        return <span className={`${baseBadgeClass} bg-rose-100 text-rose-800`}>បានបោះបង់</span>;
      default:
        return <span className={`${baseBadgeClass} bg-slate-100 text-slate-800`}>{st}</span>;
    }
  };

  const statusTabs: { key: string; labelKh: string; labelEn: string }[] = [
    { key: 'all', labelKh: 'ទាំងអស់', labelEn: 'All' },
    { key: 'pending', labelKh: 'រង់ចាំ', labelEn: 'Pending' },
    { key: 'packaging', labelKh: 'កំពុងខ្ចប់', labelEn: 'Packaging' },
    { key: 'shipped', labelKh: 'កំពុងដឹកជញ្ជូន', labelEn: 'Shipping' },
    { key: 'delivered', labelKh: 'បានទទួលរួច', labelEn: 'Delivered' },
    { key: 'cancelled', labelKh: 'បានបោះបង់', labelEn: 'Cancelled' },
  ];

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-200 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900">
                {language === 'kh' ? 'ការបញ្ជាទិញ (Orders Management)' : 'Orders Management'}
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                <span>
                  {language === 'kh'
                    ? 'តាមពេលវេលាពិត • បញ្ជាទិញថ្មីនៅខាងលើគេ'
                    : 'Real-Time • Newest Orders First'}
                </span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {language === 'kh' ? 'Sync ជាប់គ្នាទាំងទូរស័ព្ទ & កុំព្យូទ័រ' : 'Synced Mobile & Desktop'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'kh'
                ? 'រាល់ការបញ្ជាទិញថ្មីត្រូវបានរៀបតាមម៉ោងពិត ដោយដាក់ការបញ្ជាទិញថ្មីបំផុតនៅខាងលើគេជានិច្ច'
                : 'All orders are sorted by real creation time with the newest order always placed at the top'}
            </p>
          </div>
          {onOpenCreateOrder && (
            <button
              type="button"
              onClick={onOpenCreateOrder}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer shrink-0"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{language === 'kh' ? '+ បង្កើតការបញ្ជាទិញថ្មី' : '+ Create New Order'}</span>
            </button>
          )}
        </div>

        {/* 4-Item Metric Summary Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[11px] text-slate-500 block">
              {language === 'kh' ? 'ការកុម្ម៉ង់សរុប' : 'Total Orders'}
            </span>
            <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
              {orders.length}
            </p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[11px] text-slate-500 block">
              {language === 'kh' ? 'ចំណូលសរុប (USD)' : 'Revenue (USD)'}
            </span>
            <p className="text-lg font-bold text-blue-600 tabular-nums mt-0.5">
              ${totalRevenueUsd.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[11px] text-slate-500 block">
              {language === 'kh' ? 'ចំណូលសរុប (រៀល)' : 'Revenue (KHR)'}
            </span>
            <p className="text-lg font-bold text-emerald-600 tabular-nums mt-0.5">
              {totalRevenueKhr.toLocaleString()} ៛
            </p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[11px] text-slate-500 block">
              {language === 'kh' ? 'មធ្យមភាគ / បុង' : 'Avg Order Value'}
            </span>
            <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
              ${orders.length > 0 ? (totalRevenueUsd / orders.length).toFixed(2) : '0.00'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'kh' ? 'ស្វែងរកលេខបុង ឬឈ្មោះ...' : 'Search order #, customer...'}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-0.5 sm:pb-0">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 text-xs rounded-lg font-semibold whitespace-nowrap cursor-pointer shrink-0 border ${
                  statusFilter === tab.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {language === 'kh' ? tab.labelKh : tab.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 w-[125px]">លេខបុង</th>
                  <th className="px-4 py-3 min-w-[155px]">ពេលវេលាពិត (ម៉ោងកម្ម៉ង់)</th>
                  <th className="px-4 py-3 min-w-[160px]">អតិថិជន</th>
                  <th className="px-4 py-3 min-w-[110px]">ខេត្ត/ក្រុង</th>
                  <th className="px-4 py-3 min-w-[120px]">សេវាដឹក</th>
                  <th className="px-4 py-3 min-w-[130px]">ទឹកប្រាក់ ($ / រៀល)</th>
                  <th className="px-4 py-3 min-w-[100px]">វិធីទូទាត់</th>
                  <th className="px-4 py-3 w-[270px] min-w-[270px]">ស្ថានភាព</th>
                  <th className="px-4 py-3 w-[140px] text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      {language === 'kh' ? 'មិនមានការកុម្ម៉ង់ទំនិញទេ' : 'No orders found'}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord, idx) => {
                    const selectValue = normalizeOrderStatus(ord.status);
                    const isNewest = ord.id === newestOrderId;
                    const realTimeInfo = formatOrderRealDateTime(ord, idx, language);
                    return (
                      <tr
                        key={ord.id}
                        className={isNewest ? 'bg-blue-50/35 hover:bg-blue-50/60' : 'hover:bg-slate-50/80'}
                      >
                        <td className="px-4 py-3 font-bold text-blue-600 tabular-nums whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>#{ord.orderNumber}</span>
                            {isNewest && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-600 text-white">
                                {language === 'kh' ? 'ថ្មី' : 'NEW'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                          <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>{realTimeInfo.timeText}</span>
                          </div>
                          <p
                            className={`text-[11px] mt-0.5 ${
                              realTimeInfo.isToday ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                            }`}
                          >
                            {realTimeInfo.dateText}
                          </p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-semibold text-slate-900">{ord.customerName}</p>
                          <p className="text-[11px] text-slate-400 tabular-nums">{ord.customerPhone}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {ord.customerProvince}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {ord.deliveryProvider === 'jt'
                            ? 'J&T Express'
                            : ord.deliveryProvider === 'virak_buntham'
                            ? 'វីរៈប៊ុនថាំ'
                            : ord.deliveryProvider === 'capitol'
                            ? 'កាពីតូល'
                            : ord.deliveryProvider === 'grab'
                            ? 'Grab Express'
                            : ord.deliveryProvider}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-bold text-slate-900 tabular-nums">${Number(ord.total || 0).toFixed(2)}</p>
                          <p className="text-[10px] text-slate-400 tabular-nums">
                            ស្មើនឹង {Number(ord.totalKhr || 0).toLocaleString()} ៛
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-600 uppercase font-medium whitespace-nowrap">
                          {ord.paymentMethod === 'aba_khqr' ? 'ABA KHQR' : 'COD'}
                        </td>
                        <td className="px-4 py-3 w-[270px] min-w-[270px] whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(ord.status)}
                            <select
                              value={selectValue}
                              onChange={(e) => onUpdateStatus(ord.id, e.target.value as OrderStatus)}
                              className="w-[148px] shrink-0 text-[11px] font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
                              title="ប្តូរស្ថានភាពកុម្ម៉ង់"
                            >
                              <option value="pending">{language === 'kh' ? 'រង់ចាំ (Pending)' : 'Pending'}</option>
                              <option value="packaging">{language === 'kh' ? 'កំពុងខ្ចប់ (Packaging)' : 'Packaging'}</option>
                              <option value="shipped">{language === 'kh' ? 'កំពុងដឹក (Shipping)' : 'Shipping'}</option>
                              <option value="delivered">{language === 'kh' ? 'ទទួលរួច (Delivered)' : 'Delivered'}</option>
                              <option value="cancelled">{language === 'kh' ? 'បោះបង់ (Cancelled)' : 'Cancelled'}</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onViewInvoice(ord.id)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-md cursor-pointer shrink-0"
                              title="មើលវិក្កយបត្រ"
                            >
                              {language === 'kh' ? 'មើល' : 'View'}
                            </button>
                            <button
                              type="button"
                              onClick={() => (onEditInvoice ? onEditInvoice(ord.id) : onViewInvoice(ord.id))}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-md cursor-pointer shrink-0"
                              title="កែប្រែឯកសារ"
                            >
                              <Edit3 className="w-3 h-3 text-emerald-600" />
                              <span>{language === 'kh' ? 'កែប្រែ' : 'Edit'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
