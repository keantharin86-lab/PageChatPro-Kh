import React, { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  Package,
  Activity,
} from 'lucide-react';
import { Order } from '../types';

interface OrderStatusChartProps {
  orders: Order[];
  language: 'kh' | 'en';
}

export interface StatusCategoryData {
  key: 'pending' | 'shipping' | 'delivered' | 'cancelled';
  name: string;
  nameKh: string;
  nameEn: string;
  count: number;
  percentage: number;
  revenueUsd: number;
  revenueKhr: number;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

const STATUS_CONFIG = {
  pending: {
    nameKh: 'រង់ចាំពិនិត្យ (Pending)',
    nameEn: 'Pending',
    color: '#f59e0b', // Amber 500
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-200',
    icon: Clock,
  },
  shipping: {
    nameKh: 'កំពុងដឹកជញ្ជូន (Shipping)',
    nameEn: 'Shipping',
    color: '#3b82f6', // Blue 500
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-200',
    icon: Truck,
  },
  delivered: {
    nameKh: 'ដឹកជញ្ជូនជោគជ័យ (Delivered)',
    nameEn: 'Delivered',
    color: '#10b981', // Emerald 500
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-200',
    icon: CheckCircle2,
  },
  cancelled: {
    nameKh: 'បានបោះបង់ (Cancelled)',
    nameEn: 'Cancelled',
    color: '#ef4444', // Red 500
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-200',
    icon: XCircle,
  },
} as const;

export const OrderStatusChart: React.FC<OrderStatusChartProps> = ({
  orders,
  language,
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { statusData, activeChartData, pipelineHealthScore, subStageCounts } = useMemo(() => {
    const buckets: Record<
      'pending' | 'shipping' | 'delivered' | 'cancelled',
      { count: number; revenueUsd: number; revenueKhr: number }
    > = {
      pending: { count: 0, revenueUsd: 0, revenueKhr: 0 },
      shipping: { count: 0, revenueUsd: 0, revenueKhr: 0 },
      delivered: { count: 0, revenueUsd: 0, revenueKhr: 0 },
      cancelled: { count: 0, revenueUsd: 0, revenueKhr: 0 },
    };

    let packagingCount = 0;
    let shippedCount = 0;

    orders.forEach((order) => {
      const rawStatus = order.status;
      let mappedKey: 'pending' | 'shipping' | 'delivered' | 'cancelled' = 'pending';

      if (rawStatus === 'pending' || rawStatus === 'confirmed') {
        mappedKey = 'pending';
      } else if (
        rawStatus === 'shipping' ||
        rawStatus === 'shipped' ||
        rawStatus === 'packaging'
      ) {
        mappedKey = 'shipping';
        if (rawStatus === 'packaging') packagingCount += 1;
        else shippedCount += 1;
      } else if (rawStatus === 'delivered') {
        mappedKey = 'delivered';
      } else if (rawStatus === 'cancelled') {
        mappedKey = 'cancelled';
      }

      buckets[mappedKey].count += 1;
      buckets[mappedKey].revenueUsd += order.total || 0;
      buckets[mappedKey].revenueKhr += order.totalKhr || 0;
    });

    const total = orders.length;

    const fullData: StatusCategoryData[] = (
      ['pending', 'shipping', 'delivered', 'cancelled'] as const
    ).map((key) => {
      const cfg = STATUS_CONFIG[key];
      const count = buckets[key].count;
      const percentage = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;

      return {
        key,
        name: language === 'kh' ? cfg.nameKh : cfg.nameEn,
        nameKh: cfg.nameKh,
        nameEn: cfg.nameEn,
        count,
        percentage,
        revenueUsd: buckets[key].revenueUsd,
        revenueKhr: buckets[key].revenueKhr,
        color: cfg.color,
        bgClass: cfg.bgClass,
        textClass: cfg.textClass,
        borderClass: cfg.borderClass,
      };
    });

    // Only pass non-zero slices to Recharts Pie, or placeholder if no orders exist
    const nonZero = fullData.filter((d) => d.count > 0);

    // Health score: non-cancelled orders with bonus weight for delivered & shipping progress
    const nonCancelledCount = total - buckets.cancelled.count;
    const healthScore =
      total > 0 ? Math.round((nonCancelledCount / total) * 100) : 100;

    return {
      statusData: fullData,
      activeChartData: nonZero,
      pipelineHealthScore: healthScore,
      subStageCounts: { packagingCount, shippedCount },
    };
  }, [orders, language]);

  const highlightedStatus =
    activeIndex !== null && activeChartData[activeIndex]
      ? activeChartData[activeIndex]
      : null;

  return (
    <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              {language === 'kh'
                ? 'សុខភាពនៃការកុម្ម៉ង់ & ស្ថានភាពដឹកជញ្ជូន (Order Pipeline)'
                : 'Order Pipeline & Status Distribution'}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {language === 'kh'
              ? 'តាមដានសមាមាត្រនៃការកុម្ម៉ង់តាមដំណាក់កាលនីមួយៗ (Pending, Shipping, Delivered, Cancelled)'
              : 'Visual distribution of order statuses across your fulfillment pipeline'}
          </p>
        </div>

        {/* Pipeline Health Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl self-start sm:self-auto">
          <Activity
            className={`w-4 h-4 ${
              pipelineHealthScore >= 85
                ? 'text-emerald-600'
                : pipelineHealthScore >= 65
                ? 'text-amber-500'
                : 'text-rose-600'
            }`}
          />
          <div className="text-xs">
            <span className="text-slate-500 mr-1.5">
              {language === 'kh' ? 'សុខភាពប្រតិបត្តិការ៖' : 'Pipeline Health:'}
            </span>
            <span
              className={`font-bold tabular-nums ${
                pipelineHealthScore >= 85
                  ? 'text-emerald-700'
                  : pipelineHealthScore >= 65
                  ? 'text-amber-700'
                  : 'text-rose-700'
              }`}
            >
              {pipelineHealthScore}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Content: Recharts Pie + Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Recharts Donut Chart */}
        <div className="lg:col-span-5 relative h-64 flex items-center justify-center">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-2xl w-full h-full bg-slate-50/50">
              <Package className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">
                {language === 'kh' ? 'មិនទាន់មានទិន្នន័យកុម្ម៉ង់នៅឡើយទេ' : 'No orders in pipeline yet'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {language === 'kh'
                  ? 'បង្កើតការកុម្ម៉ង់ថ្មីពីប្រអប់សារដើម្បីមើលក្រាហ្វវិភាគ'
                  : 'Create an order from chat threads to see status distribution'}
              </p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activeChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={64}
                    outerRadius={92}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="name"
                    stroke="#ffffff"
                    strokeWidth={2}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {activeChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.key}`}
                        fill={entry.color}
                        opacity={
                          activeIndex === null || activeIndex === index ? 1 : 0.45
                        }
                        className="transition-opacity duration-200 cursor-pointer outline-none"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload as StatusCategoryData;
                      return (
                        <div className="bg-slate-900 text-white px-3 py-2 rounded-xl shadow-lg border border-slate-700 text-xs">
                          <div className="flex items-center gap-2 font-bold mb-1">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span>{item.name}</span>
                          </div>
                          <div className="space-y-0.5 text-[11px] text-slate-300 tabular-nums">
                            <p>
                              {language === 'kh' ? 'ចំនួនបុង៖ ' : 'Orders: '}
                              <span className="text-white font-semibold">
                                {item.count} ({item.percentage}%)
                              </span>
                            </p>
                            <p>
                              {language === 'kh' ? 'ទឹកប្រាក់៖ ' : 'Value: '}
                              <span className="text-emerald-400 font-semibold">
                                ${item.revenueUsd.toFixed(2)}
                              </span>{' '}
                              ({item.revenueKhr.toLocaleString()} ៛)
                            </p>
                          </div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Donut Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                {highlightedStatus ? (
                  <>
                    <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[115px]">
                      {language === 'kh'
                        ? highlightedStatus.nameKh.split(' (')[0]
                        : highlightedStatus.nameEn}
                    </span>
                    <span
                      className="text-2xl font-extrabold tabular-nums mt-0.5"
                      style={{ color: highlightedStatus.color }}
                    >
                      {highlightedStatus.count}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                      {highlightedStatus.percentage}% • $
                      {highlightedStatus.revenueUsd.toFixed(0)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-medium text-slate-400">
                      {language === 'kh' ? 'បុងសរុប' : 'Total Orders'}
                    </span>
                    <span className="text-2xl font-extrabold text-slate-900 tabular-nums mt-0.5">
                      {orders.length}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 tabular-nums">
                      $
                      {orders
                        .reduce((sum, o) => sum + (o.total || 0), 0)
                        .toFixed(2)}
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: 4 Status Pipeline Breakdown Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {statusData.map((st) => {
            const IconComponent = STATUS_CONFIG[st.key].icon;
            const chartIdx = activeChartData.findIndex((d) => d.key === st.key);
            const isHovered = activeIndex !== null && activeIndex === chartIdx;

            return (
              <div
                key={st.key}
                onMouseEnter={() => {
                  if (chartIdx !== -1) setActiveIndex(chartIdx);
                }}
                onMouseLeave={() => setActiveIndex(null)}
                className={`p-3.5 rounded-xl border transition-all cursor-default ${
                  isHovered
                    ? `${st.bgClass} ${st.borderClass} shadow-xs scale-[1.01]`
                    : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${st.color}18`,
                        color: st.color,
                      }}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {st.name}
                      </p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        ${st.revenueUsd.toFixed(2)} •{' '}
                        {st.revenueKhr.toLocaleString()} ៛
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-base font-extrabold text-slate-900 tabular-nums">
                      {st.count}
                    </span>
                    <span className="block text-[10px] font-semibold text-slate-500 tabular-nums">
                      {st.percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-2.5 w-full bg-slate-200/70 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(st.percentage, st.count > 0 ? 4 : 0)}%`,
                      backgroundColor: st.color,
                    }}
                  />
                </div>

                {/* Sub-stage detail for shipping */}
                {st.key === 'shipping' &&
                  (subStageCounts.packagingCount > 0 ||
                    subStageCounts.shippedCount > 0) && (
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-200/60">
                      <span>
                        {language === 'kh' ? 'កំពុងខ្ចប់៖ ' : 'Packaging: '}
                        <strong className="text-slate-700 tabular-nums">
                          {subStageCounts.packagingCount}
                        </strong>
                      </span>
                      <span>
                        {language === 'kh' ? 'ផ្ញើចេញរួច៖ ' : 'In Transit: '}
                        <strong className="text-slate-700 tabular-nums">
                          {subStageCounts.shippedCount}
                        </strong>
                      </span>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
