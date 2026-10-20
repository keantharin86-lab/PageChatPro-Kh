import React from 'react';
import {
  MessageSquare,
  ShoppingBag,
  Package,
  BarChart3,
  Smartphone,
} from 'lucide-react';
import { ActiveViewType } from './Sidebar';

interface MobileBottomNavProps {
  activeView: ActiveViewType;
  onChangeView: (view: ActiveViewType) => void;
  totalUnread: number;
  totalOrdersCount: number;
  onOpenMobileDrawer: () => void;
  language: 'kh' | 'en';
  forceShow?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onChangeView,
  totalUnread,
  totalOrdersCount,
  language,
  forceShow = false,
}) => {
  const tabs: {
    id: ActiveViewType;
    labelKh: string;
    labelEn: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }[] = [
    {
      id: 'inbox',
      labelKh: 'ប្រអប់សារ',
      labelEn: 'Inbox',
      icon: MessageSquare,
      badge: totalUnread > 0 ? totalUnread : undefined,
    },
    {
      id: 'orders',
      labelKh: 'ការកុម្ម៉ង់',
      labelEn: 'Orders',
      icon: ShoppingBag,
      badge: totalOrdersCount > 0 ? totalOrdersCount : undefined,
    },
    {
      id: 'products',
      labelKh: 'ទំនិញ',
      labelEn: 'Products',
      icon: Package,
    },
    {
      id: 'analytics',
      labelKh: 'របាយការណ៍',
      labelEn: 'Sales',
      icon: BarChart3,
    },
    {
      id: 'mobile_app',
      labelKh: 'កម្មវិធីទូរស័ព្ទ',
      labelEn: 'Mobile App',
      icon: Smartphone,
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className={`${
        forceShow ? 'grid' : 'grid md:hidden'
      } grid-cols-5 items-center h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 shrink-0 z-30 select-none px-1`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeView === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeView(tab.id)}
            className={`relative min-h-[48px] min-w-[44px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
              isActive
                ? 'text-blue-600'
                : 'text-slate-500 hover:text-slate-900 active:bg-slate-100'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Icon className="w-5 h-5" />
              {tab.badge !== undefined && (
                <span className="absolute -top-1.5 -right-3 px-1.5 min-w-[18px] h-[16px] rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold tracking-tight mt-1 whitespace-nowrap truncate max-w-[68px]">
              {language === 'kh' ? tab.labelKh : tab.labelEn}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
