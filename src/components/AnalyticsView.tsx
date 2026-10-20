import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  DollarSign,
  Calendar,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Truck,
  ArrowUpRight,
  FileSpreadsheet,
  Receipt,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Order, ChatThread } from '../types';
import { OrderStatusChart } from './OrderStatusChart';

interface AnalyticsViewProps {
  orders: Order[];
  threads: ChatThread[];
  language: 'kh' | 'en';
}

const KHMER_MONTHS = [
  'មករា',
  'កុម្ភៈ',
  'មីនា',
  'មេសា',
  'ឧសភា',
  'មិថុនា',
  'កក្កដា',
  'សីហា',
  'កញ្ញា',
  'តុលា',
  'វិច្ឆិកា',
  'ធ្នូ',
];

function getLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalMonthStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Resolves any Order into a normalized YYYY-MM-DD date string.
 */
export function resolveOrderDate(order: Order): string {
  // 1. Explicit orderDate field (YYYY-MM-DD)
  if (order.orderDate && /^\d{4}-\d{2}-\d{2}$/.test(order.orderDate.trim())) {
    return order.orderDate.trim();
  }

  const created = (order.createdAt || '').trim();

  // 2. Starts with YYYY-MM-DD
  const isoMatch = created.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const now = new Date();

  // 3. Relative Khmer/English labels
  if (created.includes('ថ្ងៃនេះ') || created.toLowerCase().includes('today')) {
    return getLocalDateStr(now);
  }
  if (created.includes('ម្សិលមិញ') || created.toLowerCase().includes('yesterday')) {
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    return getLocalDateStr(yest);
  }

  // 4. Timestamp embedded in order.id (e.g. ord_1760934123456)
  const idMatch = (order.id || '').match(/ord_(\d{12,14})/);
  if (idMatch) {
    const ts = Number(idMatch[1]);
    if (!Number.isNaN(ts) && ts > 1600000000000) {
      return getLocalDateStr(new Date(ts));
    }
  }

  // 5. Fallback to Date.parse if valid
  const parsed = Date.parse(created);
  if (!Number.isNaN(parsed)) {
    return getLocalDateStr(new Date(parsed));
  }

  return getLocalDateStr(now);
}

function formatKhmerDateDisplay(yyyyMmDd: string, lang: 'kh' | 'en'): string {
  const parts = yyyyMmDd.split('-');
  if (parts.length !== 3) return yyyyMmDd;
  const year = Number(parts[0]);
  const monthIdx = Number(parts[1]) - 1;
  const day = Number(parts[2]);

  if (lang === 'kh') {
    const khMonth = KHMER_MONTHS[monthIdx] || parts[1];
    return `ថ្ងៃទី ${day} ខែ${khMonth} ឆ្នាំ ${year}`;
  }
  const dateObj = new Date(year, monthIdx, day);
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatKhmerMonthDisplay(yyyyMm: string, lang: 'kh' | 'en'): string {
  const parts = yyyyMm.split('-');
  if (parts.length !== 2) return yyyyMm;
  const year = Number(parts[0]);
  const monthIdx = Number(parts[1]) - 1;

  if (lang === 'kh') {
    const khMonth = KHMER_MONTHS[monthIdx] || parts[1];
    return `ខែ${khMonth} ឆ្នាំ ${year}`;
  }
  const dateObj = new Date(year, monthIdx, 1);
  return dateObj.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  orders,
  threads,
  language,
}) => {
  const todayStr = useMemo(() => getLocalDateStr(new Date()), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateStr(d);
  }, []);
  const currentMonthStr = useMemo(() => getLocalMonthStr(new Date()), []);
  const lastMonthStr = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return getLocalMonthStr(d);
  }, []);

  // Selected Day (1 Day view) and Selected Month (1 Month view)
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [breakdownTab, setBreakdownTab] = useState<'daily' | 'monthly'>('daily');

  // Enrich orders with normalized YYYY-MM-DD and YYYY-MM
  const normalizedOrders = useMemo(() => {
    return orders.map((o) => {
      const dateStr = resolveOrderDate(o);
      const monthStr = dateStr.slice(0, 7);
      return {
        ...o,
        resolvedDate: dateStr,
        resolvedMonth: monthStr,
      };
    });
  }, [orders]);

  // All-time valid totals
  const validOrders = useMemo(
    () => normalizedOrders.filter((o) => o.status !== 'cancelled'),
    [normalizedOrders]
  );
  const totalRevenue = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalRevenueKhr = validOrders.reduce((sum, o) => sum + (o.totalKhr || 0), 0);
  const conversionRate =
    threads.length > 0 ? ((orders.length / threads.length) * 100).toFixed(1) : '0';

  // 1-DAY SUMMARY (សម្រាប់ ១ ថ្ងៃដែលជ្រើសរើស)
  const dailySummary = useMemo(() => {
    const allInDay = normalizedOrders.filter((o) => o.resolvedDate === selectedDate);
    const validInDay = allInDay.filter((o) => o.status !== 'cancelled');
    const cancelledInDay = allInDay.filter((o) => o.status === 'cancelled');
    const deliveredInDay = allInDay.filter((o) => o.status === 'delivered');
    const shippingInDay = allInDay.filter(
      (o) =>
        o.status === 'shipping' ||
        o.status === 'shipped' ||
        o.status === 'packaging'
    );
    const pendingInDay = allInDay.filter(
      (o) => o.status === 'pending' || o.status === 'confirmed'
    );

    const revenueUsd = validInDay.reduce((sum, o) => sum + (o.total || 0), 0);
    const revenueKhr = validInDay.reduce((sum, o) => sum + (o.totalKhr || 0), 0);
    const deliveryFeeTotal = validInDay.reduce(
      (sum, o) => sum + (o.deliveryFee || 0),
      0
    );
    const itemsQtyTotal = validInDay.reduce(
      (sum, o) =>
        sum + (o.items || []).reduce((s, it) => s + (it.quantity || 0), 0),
      0
    );

    return {
      allOrders: allInDay,
      validCount: validInDay.length,
      totalCount: allInDay.length,
      cancelledCount: cancelledInDay.length,
      deliveredCount: deliveredInDay.length,
      shippingCount: shippingInDay.length,
      pendingCount: pendingInDay.length,
      revenueUsd,
      revenueKhr,
      deliveryFeeTotal,
      itemsQtyTotal,
    };
  }, [normalizedOrders, selectedDate]);

  // 1-MONTH SUMMARY (សម្រាប់ ១ ខែដែលជ្រើសរើស)
  const monthlySummary = useMemo(() => {
    const allInMonth = normalizedOrders.filter(
      (o) => o.resolvedMonth === selectedMonth
    );
    const validInMonth = allInMonth.filter((o) => o.status !== 'cancelled');
    const cancelledInMonth = allInMonth.filter((o) => o.status === 'cancelled');
    const deliveredInMonth = allInMonth.filter((o) => o.status === 'delivered');

    const revenueUsd = validInMonth.reduce((sum, o) => sum + (o.total || 0), 0);
    const revenueKhr = validInMonth.reduce((sum, o) => sum + (o.totalKhr || 0), 0);
    const itemsQtyTotal = validInMonth.reduce(
      (sum, o) =>
        sum + (o.items || []).reduce((s, it) => s + (it.quantity || 0), 0),
      0
    );

    // Group by day inside the selected month
    const dayMap = new Map<
      string,
      {
        date: string;
        totalOrders: number;
        validOrders: number;
        cancelledOrders: number;
        revenueUsd: number;
        revenueKhr: number;
        itemsCount: number;
      }
    >();

    allInMonth.forEach((ord) => {
      const d = ord.resolvedDate;
      const existing = dayMap.get(d) || {
        date: d,
        totalOrders: 0,
        validOrders: 0,
        cancelledOrders: 0,
        revenueUsd: 0,
        revenueKhr: 0,
        itemsCount: 0,
      };
      existing.totalOrders += 1;
      if (ord.status === 'cancelled') {
        existing.cancelledOrders += 1;
      } else {
        existing.validOrders += 1;
        existing.revenueUsd += ord.total || 0;
        existing.revenueKhr += ord.totalKhr || 0;
        existing.itemsCount += (ord.items || []).reduce(
          (s, it) => s + (it.quantity || 0),
          0
        );
      }
      dayMap.set(d, existing);
    });

    const dailyRows = Array.from(dayMap.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    const chartSeries = [...dailyRows]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        dayLabel: r.date.slice(8, 10) + '/' + r.date.slice(5, 7),
        fullDate: r.date,
        revenueUsd: Number(r.revenueUsd.toFixed(2)),
        revenueKhr: r.revenueKhr,
        orders: r.validOrders,
      }));

    const activeSellingDays = dailyRows.filter((r) => r.validOrders > 0).length;
    const avgDailyUsd =
      activeSellingDays > 0 ? revenueUsd / activeSellingDays : 0;

    return {
      allOrders: allInMonth,
      validCount: validInMonth.length,
      totalCount: allInMonth.length,
      cancelledCount: cancelledInMonth.length,
      deliveredCount: deliveredInMonth.length,
      revenueUsd,
      revenueKhr,
      itemsQtyTotal,
      activeSellingDays,
      avgDailyUsd,
      dailyRows,
      chartSeries,
    };
  }, [normalizedOrders, selectedMonth]);

  // ALL-MONTHS TABLE SUMMARY (សរុបតាមខែនីមួយៗ)
  const allMonthsSummary = useMemo(() => {
    const monthMap = new Map<
      string,
      {
        month: string;
        totalOrders: number;
        validOrders: number;
        cancelledOrders: number;
        revenueUsd: number;
        revenueKhr: number;
        activeDaysSet: Set<string>;
      }
    >();

    // Ensure current month is always listed
    monthMap.set(currentMonthStr, {
      month: currentMonthStr,
      totalOrders: 0,
      validOrders: 0,
      cancelledOrders: 0,
      revenueUsd: 0,
      revenueKhr: 0,
      activeDaysSet: new Set<string>(),
    });

    normalizedOrders.forEach((ord) => {
      const m = ord.resolvedMonth;
      const existing = monthMap.get(m) || {
        month: m,
        totalOrders: 0,
        validOrders: 0,
        cancelledOrders: 0,
        revenueUsd: 0,
        revenueKhr: 0,
        activeDaysSet: new Set<string>(),
      };

      existing.totalOrders += 1;
      if (ord.status === 'cancelled') {
        existing.cancelledOrders += 1;
      } else {
        existing.validOrders += 1;
        existing.revenueUsd += ord.total || 0;
        existing.revenueKhr += ord.totalKhr || 0;
        existing.activeDaysSet.add(ord.resolvedDate);
      }
      monthMap.set(m, existing);
    });

    return Array.from(monthMap.values())
      .map((item) => ({
        ...item,
        activeDays: item.activeDaysSet.size,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [normalizedOrders, currentMonthStr]);

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-200 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {language === 'kh'
                ? 'របាយការណ៍លក់ប្រចាំថ្ងៃ & ប្រចាំខែ (Sales Analytics)'
                : 'Daily & Monthly Sales Analytics'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'kh'
                ? 'ពិនិត្យចំណូលលក់សរុបក្នុង ១ ថ្ងៃ, សរុបក្នុង ១ ខែ, ស្ថានភាពកុម្ម៉ង់ និងប្រសិទ្ធភាពឆាត'
                : 'Track exact sales revenue for 1 day, 1 month, and order pipeline health'}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs bg-blue-50 text-blue-800 border border-blue-200/80 px-3 py-1.5 rounded-xl font-medium self-start sm:self-auto">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              {language === 'kh' ? 'ថ្ងៃនេះ៖ ' : 'Today: '}
              <strong>{formatKhmerDateDisplay(todayStr, language)}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ============================================================ */}
        {/* NEW: 1-DAY & 1-MONTH INTERACTIVE SUMMARY HUB                 */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* CARD 1: សរុបចំណូល ១ ថ្ងៃ (1-DAY SALES SUMMARY) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md mb-0.5">
                      {language === 'kh' ? 'របាយការណ៍ ១ ថ្ងៃ (Daily)' : '1-Day Summary'}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      {language === 'kh'
                        ? 'សរុបការលក់ប្រចាំថ្ងៃ (មើលក្នុង ១ ថ្ងៃ)'
                        : 'Daily Sales Total (1 Day)'}
                    </h3>
                  </div>
                </div>

                {/* Date Picker & Quick Day Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayStr)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${
                      selectedDate === todayStr
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {language === 'kh' ? 'ថ្ងៃនេះ' : 'Today'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(yesterdayStr)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${
                      selectedDate === yesterdayStr
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {language === 'kh' ? 'ម្សិលមិញ' : 'Yesterday'}
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedDate(e.target.value);
                        setSelectedMonth(e.target.value.slice(0, 7));
                      }
                    }}
                    className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:border-blue-500 tabular-nums cursor-pointer"
                  />
                </div>
              </div>

              {/* Selected Date Label */}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {language === 'kh' ? 'កាលបរិច្ឆេទកំពុងមើល៖ ' : 'Viewing Date: '}
                  <strong className="text-slate-800">
                    {formatKhmerDateDisplay(selectedDate, language)}
                  </strong>
                </span>
                <span className="font-semibold text-blue-600 tabular-nums">
                  {dailySummary.totalCount}{' '}
                  {language === 'kh' ? 'បុងសរុប' : 'orders'}
                </span>
              </div>

              {/* Big Revenue Numbers for 1 Day */}
              <div className="mt-3 p-4 rounded-xl bg-gradient-to-br from-blue-50/90 via-indigo-50/50 to-slate-50 border border-blue-200/70">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <span className="text-xs font-semibold text-blue-800 block">
                      {language === 'kh'
                        ? 'ចំណូលសរុបក្នុង ១ ថ្ងៃនេះ (USD)'
                        : '1-Day Total Revenue (USD)'}
                    </span>
                    <p className="text-3xl font-extrabold text-slate-900 tabular-nums mt-1">
                      ${dailySummary.revenueUsd.toFixed(2)}
                    </p>
                  </div>
                  <div className="sm:border-l sm:border-blue-200/70 sm:pl-4">
                    <span className="text-xs font-semibold text-emerald-800 block">
                      {language === 'kh'
                        ? 'គិតជាប្រាក់រៀលសរុប (KHR)'
                        : '1-Day Total in Riel (KHR)'}
                    </span>
                    <p className="text-xl font-extrabold text-emerald-700 tabular-nums mt-1">
                      {dailySummary.revenueKhr.toLocaleString()} ៛
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Mini Breakdown Pills for 1 Day */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] text-slate-500 block">
                  {language === 'kh' ? 'បុងលក់បាន (Valid)' : 'Valid Orders'}
                </span>
                <p className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">
                  {dailySummary.validCount} {language === 'kh' ? 'បុង' : ''}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] text-slate-500 block">
                  {language === 'kh' ? 'ចំនួនទំនិញលក់ចេញ' : 'Items Sold'}
                </span>
                <p className="text-sm font-bold text-blue-600 tabular-nums mt-0.5">
                  {dailySummary.itemsQtyTotal} {language === 'kh' ? 'មុខ/ឈុត' : 'pcs'}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] text-slate-500 block">
                  {language === 'kh' ? 'ដឹកជោគជ័យ / កំពុងដឹក' : 'Delivered / Ship'}
                </span>
                <p className="text-sm font-bold text-emerald-600 tabular-nums mt-0.5">
                  {dailySummary.deliveredCount} / {dailySummary.shippingCount}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] text-slate-500 block">
                  {language === 'kh' ? 'បុងបោះបង់ (Cancel)' : 'Cancelled'}
                </span>
                <p className="text-sm font-bold text-rose-600 tabular-nums mt-0.5">
                  {dailySummary.cancelledCount} {language === 'kh' ? 'បុង' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* CARD 2: សរុបចំណូល ១ ខែ (1-MONTH SALES SUMMARY) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md mb-0.5">
                      {language === 'kh' ? 'របាយការណ៍ ១ ខែ (Monthly)' : '1-Month Summary'}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      {language === 'kh'
                        ? 'សរុបការលក់ប្រចាំខែ (មើលក្នុង ១ ខែ)'
                        : 'Monthly Sales Total (1 Month)'}
                    </h3>
                  </div>
                </div>

                {/* Month Picker & Quick Month Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedMonth(currentMonthStr)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${
                      selectedMonth === currentMonthStr
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {language === 'kh' ? 'ខែនេះ' : 'This Month'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMonth(lastMonthStr)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${
                      selectedMonth === lastMonthStr
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {language === 'kh' ? 'ខែមុន' : 'Last Month'}
                  </button>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => {
                      if (e.target.value) setSelectedMonth(e.target.value);
                    }}
                    className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 tabular-nums cursor-pointer"
                  />
                </div>
              </div>

              {/* Selected Month Label */}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {language === 'kh' ? 'ខែកំពុងមើល៖ ' : 'Viewing Month: '}
                  <strong className="text-slate-800">
                    {formatKhmerMonthDisplay(selectedMonth, language)}
                  </strong>
                </span>
                <span className="font-semibold text-emerald-700 tabular-nums">
                  {monthlySummary.totalCount}{' '}
                  {language === 'kh' ? 'បុងក្នុងខែនេះ' : 'orders in month'}
                </span>
              </div>

              {/* Big Revenue Numbers for 1 Month */}
              <div className="mt-3 p-4 rounded-xl bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-slate-50 border border-emerald-200/70">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <span className="text-xs font-semibold text-emerald-900 block">
                      {language === 'kh'
                        ? 'ចំណូលសរុបក្នុង ១ ខែនេះ (USD)'
                        : '1-Month Total Revenue (USD)'}
                    </span>
                    <p className="text-3xl font-extrabold text-slate-900 tabular-nums mt-1">
                      ${monthlySummary.revenueUsd.toFixed(2)}
                    </p>
                  </div>
                  <div className="sm:border-l sm:border-emerald-200/70 sm:pl-4">
                    <span className="text-xs font-semibold text-emerald-800 block">
                      {language === 'kh'
                        ? 'គិតជាប្រាក់រៀលសរុប (KHR)'
                        : '1-Month Total in Riel (KHR)'}
                    </span>
                    <p className="text-xl font-extrabold text-emerald-700 tabular-nums mt-1">
                      {monthlySummary.revenueKhr.toLocaleString()} ៛
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Mini Breakdown Pills for 1 Month */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] text-slate-500 block">
                  {language === 'kh' ? 'បុងលក់បានសរុប' : 'Valid Orders'}
                </span>
                <p className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">
                  {monthlySummary.validCount} {language === 'kh' ? 'បុង' : ''}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] text-slate-500 block">
                  {language === 'kh' ? 'ទំនិញលក់បានសរុប' : 'Items Sold'}
                </span>
                <p className="text-sm font-bold text-emerald-700 tabular-nums mt-0.5">
                  {monthlySummary.itemsQtyTotal} {language === 'kh' ? 'មុខ/ឈុត' : 'pcs'}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] text-slate-500 block">
                  {language === 'kh' ? 'មធ្យមភាគ / ១ ថ្ងៃ' : 'Daily Avg'}
                </span>
                <p className="text-sm font-bold text-blue-600 tabular-nums mt-0.5">
                  ${monthlySummary.avgDailyUsd.toFixed(2)}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] text-slate-500 block">
                  {language === 'kh' ? 'ចំនួនថ្ងៃមានលក់' : 'Active Days'}
                </span>
                <p className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">
                  {monthlySummary.activeSellingDays} {language === 'kh' ? 'ថ្ងៃ' : 'days'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* DAILY & MONTHLY BREAKDOWN TABLE + CHART                      */}
        {/* ============================================================ */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>
                  {language === 'kh'
                    ? 'តារាងបូកសរុបចំណូលតាមថ្ងៃ និងតាមខែលម្អិត'
                    : 'Detailed Daily & Monthly Sales Breakdown'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'kh'
                  ? 'ចុចលើថ្ងៃ ឬខែណាមួយក្នុងតារាង ដើម្បីមើលរបាយការណ៍លម្អិតនៃថ្ងៃ ឬខែនោះភ្លាមៗ'
                  : 'Click any day or month row to inspect its orders in detail'}
              </p>
            </div>

            {/* View Switcher: Daily in Month vs Monthly */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setBreakdownTab('daily')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  breakdownTab === 'daily'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {language === 'kh'
                  ? `សរុបតាមថ្ងៃ (${formatKhmerMonthDisplay(selectedMonth, 'kh')})`
                  : `Daily in ${selectedMonth}`}
              </button>
              <button
                type="button"
                onClick={() => setBreakdownTab('monthly')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  breakdownTab === 'monthly'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {language === 'kh'
                  ? 'សរុបតាមខែនីមួយៗ (១ ខែៗ)'
                  : 'Monthly Summary (By Month)'}
              </button>
            </div>
          </div>

          {breakdownTab === 'daily' ? (
            <div className="space-y-5">
              {/* BarChart of Daily Revenue inside the Selected Month */}
              {monthlySummary.chartSeries.length > 0 && (
                <div className="h-52 w-full bg-slate-50/70 border border-slate-200/70 rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-slate-500 mb-2">
                    {language === 'kh'
                      ? `ក្រាហ្វចំណូលតាមថ្ងៃក្នុង ${formatKhmerMonthDisplay(selectedMonth, 'kh')} (USD)`
                      : `Daily Revenue Trend in ${selectedMonth} (USD)`}
                  </p>
                  <ResponsiveContainer width="100%" height="85%">
                    <BarChart data={monthlySummary.chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="dayLabel"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg">
                              <p className="font-bold mb-1">
                                {formatKhmerDateDisplay(d.fullDate, language)}
                              </p>
                              <p className="text-emerald-400 font-semibold tabular-nums">
                                ${d.revenueUsd.toFixed(2)} ({d.revenueKhr.toLocaleString()} ៛)
                              </p>
                              <p className="text-slate-300 text-[11px]">
                                {language === 'kh' ? 'ចំនួនបុង៖ ' : 'Orders: '}
                                {d.orders}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="revenueUsd"
                        fill="#2563eb"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={44}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Daily Summary Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="px-4 py-3">
                        {language === 'kh' ? 'កាលបរិច្ឆេទ (១ ថ្ងៃៗ)' : 'Date (Day)'}
                      </th>
                      <th className="px-4 py-3 text-center">
                        {language === 'kh' ? 'បុងសរុប' : 'Total Orders'}
                      </th>
                      <th className="px-4 py-3 text-center">
                        {language === 'kh' ? 'បុងជោគជ័យ/កំពុងដឹក' : 'Valid Orders'}
                      </th>
                      <th className="px-4 py-3 text-center">
                        {language === 'kh' ? 'ទំនិញសរុប' : 'Items Sold'}
                      </th>
                      <th className="px-4 py-3 text-right">
                        {language === 'kh' ? 'ចំណូល ១ ថ្ងៃ (USD)' : 'Daily Sales (USD)'}
                      </th>
                      <th className="px-4 py-3 text-right">
                        {language === 'kh' ? 'ចំណូល ១ ថ្ងៃ (រៀល)' : 'Daily Sales (KHR)'}
                      </th>
                      <th className="px-4 py-3 text-right">
                        {language === 'kh' ? 'សកម្មភាព' : 'Action'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlySummary.dailyRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="p-6 text-center text-slate-400"
                        >
                          {language === 'kh'
                            ? 'មិនទាន់មានទិន្នន័យលក់ក្នុងខែនេះទេ'
                            : 'No sales recorded for this month'}
                        </td>
                      </tr>
                    ) : (
                      monthlySummary.dailyRows.map((row) => {
                        const isSelected = row.date === selectedDate;
                        return (
                          <tr
                            key={row.date}
                            onClick={() => setSelectedDate(row.date)}
                            className={`transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50/70 font-medium'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">
                                  {formatKhmerDateDisplay(row.date, language)}
                                </span>
                                {row.date === todayStr && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-md">
                                    {language === 'kh' ? 'ថ្ងៃនេះ' : 'Today'}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 tabular-nums">
                                {row.date}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-slate-700 tabular-nums">
                              {row.totalOrders}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 tabular-nums">
                                {row.validOrders}
                              </span>
                              {row.cancelledOrders > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700 tabular-nums">
                                  -{row.cancelledOrders} បោះបង់
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-slate-700 tabular-nums">
                              {row.itemsCount}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-blue-600 tabular-nums">
                              ${row.revenueUsd.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums">
                              {row.revenueKhr.toLocaleString()} ៛
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDate(row.date);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-600'
                                }`}
                              >
                                {isSelected
                                  ? language === 'kh'
                                    ? 'កំពុងមើល'
                                    : 'Selected'
                                  : language === 'kh'
                                  ? 'មើលថ្ងៃនេះ'
                                  : 'Select Day'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {monthlySummary.dailyRows.length > 0 && (
                    <tfoot className="bg-slate-900 text-white font-bold text-xs">
                      <tr>
                        <td className="px-4 py-3">
                          {language === 'kh'
                            ? `សរុបរួមប្រចាំ${formatKhmerMonthDisplay(selectedMonth, 'kh')}`
                            : `Total for ${selectedMonth}`}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">
                          {monthlySummary.totalCount}
                        </td>
                        <td className="px-4 py-3 text-center text-emerald-400 tabular-nums">
                          {monthlySummary.validCount}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">
                          {monthlySummary.itemsQtyTotal}
                        </td>
                        <td className="px-4 py-3 text-right text-amber-300 tabular-nums text-sm">
                          ${monthlySummary.revenueUsd.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-300 tabular-nums">
                          {monthlySummary.revenueKhr.toLocaleString()} ៛
                        </td>
                        <td className="px-4 py-3"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Orders List for the Selected 1 Day */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-800">
                      {language === 'kh'
                        ? `បញ្ជីវិក្កយបត្រក្នុងថ្ងៃទី៖ ${formatKhmerDateDisplay(selectedDate, 'kh')} (${dailySummary.allOrders.length} បុង)`
                        : `Orders on ${formatKhmerDateDisplay(selectedDate, 'en')} (${dailySummary.allOrders.length})`}
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-blue-700 tabular-nums">
                    {language === 'kh' ? 'សរុបថ្ងៃនេះ៖ ' : 'Day Total: '}
                    ${dailySummary.revenueUsd.toFixed(2)} ({dailySummary.revenueKhr.toLocaleString()} ៛)
                  </span>
                </div>

                {dailySummary.allOrders.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    {language === 'kh'
                      ? 'មិនមានបុងកុម្ម៉ង់នៅក្នុងថ្ងៃដែលបានជ្រើសរើសនេះទេ'
                      : 'No orders recorded on this date'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {dailySummary.allOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-blue-600 tabular-nums">
                              #{ord.orderNumber}
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {ord.customerName}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {(ord.items || [])
                              .map((it) => `${it.name} ×${it.quantity}`)
                              .join(', ')}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-extrabold text-slate-900 tabular-nums">
                            ${ord.total.toFixed(2)}
                          </p>
                          <p className="text-[10px] text-emerald-700 font-semibold tabular-nums">
                            {ord.totalKhr.toLocaleString()} ៛
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* MONTHLY BREAKDOWN TABLE (១ ខែៗ) */
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-3">
                      {language === 'kh' ? 'ខែ-ឆ្នាំ (១ ខែៗ)' : 'Month'}
                    </th>
                    <th className="px-4 py-3 text-center">
                      {language === 'kh' ? 'ចំនួនថ្ងៃមានលក់' : 'Active Days'}
                    </th>
                    <th className="px-4 py-3 text-center">
                      {language === 'kh' ? 'បុងសរុបក្នុងខែ' : 'Total Orders'}
                    </th>
                    <th className="px-4 py-3 text-center">
                      {language === 'kh' ? 'បុងជោគជ័យ' : 'Valid Orders'}
                    </th>
                    <th className="px-4 py-3 text-right">
                      {language === 'kh' ? 'ចំណូលសរុប ១ ខែ (USD)' : 'Monthly Total (USD)'}
                    </th>
                    <th className="px-4 py-3 text-right">
                      {language === 'kh' ? 'ចំណូលសរុប ១ ខែ (រៀល)' : 'Monthly Total (KHR)'}
                    </th>
                    <th className="px-4 py-3 text-right">
                      {language === 'kh' ? 'សកម្មភាព' : 'Action'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allMonthsSummary.map((mRow) => {
                    const isSelectedMonth = mRow.month === selectedMonth;
                    return (
                      <tr
                        key={mRow.month}
                        onClick={() => {
                          setSelectedMonth(mRow.month);
                          setBreakdownTab('daily');
                        }}
                        className={`transition-colors cursor-pointer ${
                          isSelectedMonth
                            ? 'bg-emerald-50/70 font-medium'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">
                              {formatKhmerMonthDisplay(mRow.month, language)}
                            </span>
                            {mRow.month === currentMonthStr && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-md">
                                {language === 'kh' ? 'ខែនេះ' : 'Current'}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 tabular-nums">
                            {mRow.month}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-700 tabular-nums">
                          {mRow.activeDays} {language === 'kh' ? 'ថ្ងៃ' : 'days'}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-700 tabular-nums">
                          {mRow.totalOrders}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 tabular-nums">
                            {mRow.validOrders}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600 tabular-nums text-sm">
                          ${mRow.revenueUsd.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums">
                          {mRow.revenueKhr.toLocaleString()} ៛
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMonth(mRow.month);
                              setBreakdownTab('daily');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            <span>
                              {language === 'kh' ? 'មើលតាមថ្ងៃ' : 'View Days'}
                            </span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Core All-Time KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">
                {language === 'kh' ? 'ចំណូលលក់សរុបរួម (All-Time USD)' : 'All-Time Sales'}
              </span>
              <DollarSign className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              ${totalRevenue.toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-400 tabular-nums mt-1">
              ស្មើនឹង {totalRevenueKhr.toLocaleString()} រៀល
            </p>
          </div>

          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">
                {language === 'kh' ? 'ចំនួនកុម្ម៉ង់សរុបរួម' : 'Total Orders'}
              </span>
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {orders.length}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">
              +12% {language === 'kh' ? 'ធៀបសប្តាហ៍មុន' : 'vs last week'}
            </p>
          </div>

          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">
                {language === 'kh' ? 'អត្រាបម្លែងការលក់' : 'Conversion Rate'}
              </span>
              <TrendingUp className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {conversionRate}%
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {language === 'kh' ? 'ពីការឆាតសួរទៅជាទិញ' : 'Chat inquiries converted'}
            </p>
          </div>

          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">
                {language === 'kh' ? 'ល្បឿនឆ្លើយតបមធ្យម' : 'Avg Response Time'}
              </span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              1.4 {language === 'kh' ? 'នាទី' : 'min'}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">
              {language === 'kh' ? 'លឿនជាង ៩៥% នៃហាងដទៃ' : 'Faster than industry avg'}
            </p>
          </div>
        </div>

        {/* Order Status Distribution Pie Chart */}
        <OrderStatusChart orders={orders} language={language} />

        {/* Detailed breakdown grids */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Channel Share */}
          <div className="p-5 bg-white border border-slate-200/90 rounded-2xl">
            <h3 className="text-sm font-bold text-slate-800 mb-3">
              {language === 'kh' ? 'ចំណូលតាមបណ្តាញសង្គម (Channel Share)' : 'Traffic by Channel'}
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Facebook Messenger (ទំព័រហ្វេសប៊ុក)</span>
                  <span className="tabular-nums">68%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '68%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Telegram Channel & Group</span>
                  <span className="tabular-nums">22%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-sky-500 h-2 rounded-full" style={{ width: '22%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>TikTok Shop Inquiries</span>
                  <span className="tabular-nums">10%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-slate-900 h-2 rounded-full" style={{ width: '10%' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Services Distribution */}
          <div className="p-5 bg-white border border-slate-200/90 rounded-2xl">
            <h3 className="text-sm font-bold text-slate-800 mb-3">
              {language === 'kh' ? 'ក្រុមហ៊ុនដឹកជញ្ជូនដែលពេញនិយម' : 'Delivery Providers'}
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>J&T Express (តាមខេត្ត)</span>
                  <span className="tabular-nums">54%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full" style={{ width: '54%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>វីរៈប៊ុនថាំ (Virak Buntham)</span>
                  <span className="tabular-nums">36%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-emerald-600 h-2 rounded-full" style={{ width: '36%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>កាពីតូល & Grab Express</span>
                  <span className="tabular-nums">10%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full" style={{ width: '10%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
