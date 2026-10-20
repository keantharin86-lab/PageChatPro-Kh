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
  language: 'kh' | 'en';
}

export const OrdersListView: React.FC<OrdersListViewProps> = ({
  orders,
  onViewInvoice,
  onEditInvoice,
  onUpdateStatus,
  language,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = order.orderNumber.toLowerCase().includes(q);
        const matchName = order.customerName.toLowerCase().includes(q);
        const matchPhone = order.customerPhone.includes(q);
        if (!matchNumber && !matchName && !matchPhone) return false;
      }
      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  const totalRevenueUsd = orders.reduce((sum, o) => sum + o.total, 0);
  const totalRevenueKhr = orders.reduce((sum, o) => sum + o.totalKhr, 0);

  const getStatusBadge = (st: OrderStatus) => {
    switch (st) {
      case 'pending':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">រង់ចាំ</span>;
      case 'packaging':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">កំពុងខ្ចប់</span>;
      case 'shipping':
      case 'shipped':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">កំពុងដឹកជញ្ជូន</span>;
      case 'delivered':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">បានទទួលរួច</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">បានបោះបង់</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">{st}</span>;
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-200 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {language === 'kh' ? 'ការបញ្ជាទិញ (Orders Management)' : 'Orders Management'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'kh'
                ? 'តាមដានស្ថានភាពកុម្ម៉ង់ទំនិញដែលបានបង្កើតចេញពីការជជែក និងបោះពុម្ពវិក្កយបត្រ'
                : 'Track customer orders created from chat threads'}
            </p>
          </div>
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
          <div className="relative w-full sm:w-72">
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
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
            {['all', 'pending', 'packaging', 'shipped', 'delivered', 'cancelled'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-colors capitalize cursor-pointer ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {st === 'all' ? (language === 'kh' ? 'ទាំងអស់' : 'All') : st}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">លេខបុង</th>
                  <th className="px-4 py-3">អតិថិជន</th>
                  <th className="px-4 py-3">ខេត្ត/ក្រុង</th>
                  <th className="px-4 py-3">សេវាដឹក</th>
                  <th className="px-4 py-3">ទឹកប្រាក់ ($ / រៀល)</th>
                  <th className="px-4 py-3">វិធីទូទាត់</th>
                  <th className="px-4 py-3">ស្ថានភាព</th>
                  <th className="px-4 py-3 text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      {language === 'kh' ? 'មិនមានការកុម្ម៉ង់ទំនិញទេ' : 'No orders found'}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-bold text-blue-600 tabular-nums">
                        #{ord.orderNumber}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{ord.customerName}</p>
                        <p className="text-[11px] text-slate-400 tabular-nums">{ord.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {ord.customerProvince}
                      </td>
                      <td className="px-4 py-3 text-slate-600 capitalize">
                        {ord.deliveryProvider === 'jt' ? 'J&T Express' : ord.deliveryProvider === 'virak_buntham' ? 'វីរៈប៊ុនថាំ' : ord.deliveryProvider}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900 tabular-nums">${ord.total.toFixed(2)}</p>
                        <p className="text-[10px] text-slate-400 tabular-nums">ស្មើនឹង {ord.totalKhr.toLocaleString()} ៛</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 uppercase font-medium">
                        {ord.paymentMethod === 'aba_khqr' ? 'ABA KHQR' : 'COD'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {getStatusBadge(ord.status)}
                          <select
                            value={ord.status}
                            onChange={(e) => onUpdateStatus(ord.id, e.target.value as OrderStatus)}
                            className="text-[11px] bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 text-slate-600 focus:outline-none cursor-pointer"
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
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onViewInvoice(ord.id)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                            title="មើលវិក្កយបត្រ"
                          >
                            {language === 'kh' ? 'មើល' : 'View'}
                          </button>
                          <button
                            onClick={() => onEditInvoice ? onEditInvoice(ord.id) : onViewInvoice(ord.id)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-md transition-colors cursor-pointer"
                            title="កែប្រែឯកសារ"
                          >
                            <Edit3 className="w-3 h-3 text-emerald-600" />
                            <span>{language === 'kh' ? 'កែប្រែ' : 'Edit'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
