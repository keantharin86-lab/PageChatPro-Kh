import React, { useState } from 'react';
import { 
  MessageSquare, 
  ShoppingBag, 
  Zap, 
  Package, 
  BarChart3, 
  ChevronDown, 
  Check, 
  Store, 
  Globe, 
  Radio, 
  Bot, 
  Sparkles, 
  PlusCircle, 
  Layers,
  X,
  Smartphone,
  HardDrive
} from 'lucide-react';
import { PageAccount } from '../types';

export type ActiveViewType = 
  | 'inbox' 
  | 'orders' 
  | 'quick_replies' 
  | 'products' 
  | 'analytics' 
  | 'gemini_chat' 
  | 'voice_live' 
  | 'image_studio' 
  | 'pages'
  | 'google_drive'
  | 'mobile_app';

interface SidebarProps {
  pages: PageAccount[];
  selectedPage: PageAccount;
  onSelectPage: (page: PageAccount) => void;
  onOpenConnectPageModal: () => void;
  activeView: ActiveViewType;
  onChangeView: (view: ActiveViewType) => void;
  totalUnread: number;
  totalOrdersCount: number;
  language: 'kh' | 'en';
  onToggleLanguage: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenFacebookLiveModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  pages,
  selectedPage,
  onSelectPage,
  onOpenConnectPageModal,
  activeView,
  onChangeView,
  totalUnread,
  totalOrdersCount,
  language,
  onToggleLanguage,
  isMobileOpen = false,
  onCloseMobile,
  onOpenFacebookLiveModal,
}) => {
  const [showPageMenu, setShowPageMenu] = useState(false);

  const navItems = [
    {
      id: 'inbox' as const,
      labelKh: 'ប្រអប់សារ (Inbox)',
      labelEn: 'Page Inbox',
      icon: MessageSquare,
      badge: totalUnread > 0 ? `${totalUnread}` : null,
      badgeColor: 'blue',
    },
    {
      id: 'mobile_app' as const,
      labelKh: 'កម្មវិធីទូរស័ព្ទដៃ (App)',
      labelEn: 'Mobile Phone App',
      icon: Smartphone,
      badge: 'iOS/Android',
      badgeColor: 'emerald',
    },
    {
      id: 'pages' as const,
      labelKh: 'គ្រប់គ្រងទំព័រ (Pages)',
      labelEn: 'Page Accounts',
      icon: Store,
      badge: `${pages.length}`,
      badgeColor: 'blue',
    },
    {
      id: 'google_drive' as const,
      labelKh: 'Google Drive Cloud',
      labelEn: 'Google Drive Cloud',
      icon: HardDrive,
      badge: 'Drive',
      badgeColor: 'emerald',
    },
    {
      id: 'gemini_chat' as const,
      labelKh: 'ជំនួយការ AI Gemini',
      labelEn: 'Gemini Chatbot',
      icon: Bot,
      badge: '3.8/Pro',
      badgeColor: 'indigo',
    },
    {
      id: 'voice_live' as const,
      labelKh: 'សន្ទនា AI Voice Live',
      labelEn: 'Voice AI (Live 3.8)',
      icon: Radio,
      badge: 'Voice',
      badgeColor: 'emerald',
    },
    {
      id: 'image_studio' as const,
      labelKh: 'ស្ទូឌីយោរូបភាព AI',
      labelEn: 'AI Image Studio',
      icon: Sparkles,
      badge: 'Nano 2.1',
      badgeColor: 'purple',
    },
    {
      id: 'orders' as const,
      labelKh: 'ការបញ្ជាទិញ (Orders)',
      labelEn: 'Orders',
      icon: ShoppingBag,
      badge: totalOrdersCount > 0 ? `${totalOrdersCount}` : null,
      badgeColor: 'blue',
    },
    {
      id: 'quick_replies' as const,
      labelKh: 'សាររហ័ស & Bot',
      labelEn: 'Quick Reply & Bot',
      icon: Zap,
      badge: null,
      badgeColor: 'blue',
    },
    {
      id: 'products' as const,
      labelKh: 'កាតាឡុកទំនិញ (Stock)',
      labelEn: 'Product Catalog',
      icon: Package,
      badge: null,
      badgeColor: 'blue',
    },
    {
      id: 'analytics' as const,
      labelKh: 'របាយការណ៍លក់',
      labelEn: 'Sales Analytics',
      icon: BarChart3,
      badge: null,
      badgeColor: 'blue',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 select-none transform transition-transform duration-200 ease-in-out md:static md:translate-x-0 md:w-64 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* App Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              💬
            </div>
            <div>
              <h1 className="font-semibold text-white text-base leading-tight">
                PageChat <span className="text-blue-400 font-normal text-xs">PRO</span>
              </h1>
              <p className="text-[11px] text-slate-400">
                {language === 'kh' ? 'ប្រព័ន្ធគ្រប់គ្រងទំព័រ' : 'Social Page Manager'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleLanguage}
              title={language === 'kh' ? 'ប្តូរទៅភាសាអង់គ្លេស' : 'Switch to Khmer'}
              className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-1 transition-colors"
            >
              <Globe className="w-3 h-3" />
              <span>{language === 'kh' ? 'ខ្មែរ' : 'EN'}</span>
            </button>
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 md:hidden"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Page Selector Dropdown */}
        <div className="p-3 border-b border-slate-800 relative">
          <button
            onClick={() => setShowPageMenu(!showPageMenu)}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={selectedPage.avatar}
                alt={selectedPage.name}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-slate-600 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-white truncate">
                  {selectedPage.name}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>{selectedPage.followerCount}</span>
                </div>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
          </button>

          {showPageMenu && (
            <div className="absolute top-full left-3 right-3 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1">
              <div className="px-3 py-1 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                {language === 'kh' ? 'ទំព័រដែលបានភ្ជាប់' : 'Connected Pages'}
              </div>
              {pages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectPage(p);
                    setShowPageMenu(false);
                  }}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-700/70 text-left transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={p.avatar}
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{p.category}</p>
                    </div>
                  </div>
                  {p.id === selectedPage.id && (
                    <Check className="w-4 h-4 text-blue-400 shrink-0 ml-1" />
                  )}
                </button>
              ))}

              <div className="border-t border-slate-700/80 my-1 pt-1 px-1.5 space-y-1">
                <button
                  onClick={() => {
                    setShowPageMenu(false);
                    onOpenConnectPageModal();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-md text-xs font-semibold text-blue-400 hover:text-white hover:bg-blue-600/30 flex items-center gap-2 transition-colors text-left"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{language === 'kh' ? '+ ភ្ជាប់ទំព័រថ្មី' : '+ Connect New Page'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowPageMenu(false);
                    onChangeView('pages');
                  }}
                  className="w-full px-2.5 py-1.5 rounded-md text-xs text-slate-300 hover:text-white hover:bg-slate-700/70 flex items-center gap-2 transition-colors text-left"
                >
                  <Store className="w-3.5 h-3.5 text-slate-400" />
                  <span>{language === 'kh' ? 'គ្រប់គ្រងទំព័រទាំងអស់' : 'Manage Connected Pages'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Facebook Live Online Messenger Button */}
        {onOpenFacebookLiveModal && (
          <div className="px-3 pt-2">
            <button
              type="button"
              onClick={() => {
                onOpenFacebookLiveModal();
                onCloseMobile?.();
              }}
              className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition-all ${
                (selectedPage.isLiveOnline || selectedPage.accessToken)
                  ? 'bg-emerald-950/60 border-emerald-500/40 hover:bg-emerald-900/60 text-emerald-300 shadow-xs ring-1 ring-emerald-500/30'
                  : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800 text-slate-300'
              }`}
              title="ស្ថានភាព Live Online លើ Messenger"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-3 h-3 rounded-full shrink-0 ${
                  (selectedPage.isLiveOnline || selectedPage.accessToken)
                    ? 'bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20'
                    : 'bg-amber-400'
                }`} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {language === 'kh' ? 'Live Online (Messenger)' : 'Live Online (Messenger)'}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {(selectedPage.isLiveOnline || selectedPage.accessToken)
                      ? (language === 'kh' ? 'កំពុងដំណើរការ' : 'Active & Listening')
                      : (language === 'kh' ? 'ចុចបើក Live' : 'Click to go live')}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                (selectedPage.isLiveOnline || selectedPage.accessToken)
                  ? 'bg-emerald-500 text-slate-950 font-black'
                  : 'bg-slate-700 text-slate-300'
              }`}>
                {(selectedPage.isLiveOnline || selectedPage.accessToken) ? 'ONLINE' : 'OFFLINE'}
              </span>
            </button>
          </div>
        )}

        {/* Nav Menu */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onChangeView(item.id);
                  onCloseMobile?.();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{language === 'kh' ? item.labelKh : item.labelEn}</span>
                </div>
                {item.badge !== null && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                      isActive
                        ? 'bg-white text-blue-700'
                        : 'bg-blue-600/30 text-blue-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Status / Profile */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-1">
            <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>{language === 'kh' ? 'ប្រព័ន្ធដំណើរការធម្មតា' : 'Live Connected'}</span>
            </div>
            <span className="text-[10px] text-slate-500">v2.4</span>
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-800/40 border border-slate-800">
            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
              A
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-200 truncate">{selectedPage.activeStaff}</p>
              <p className="text-[10px] text-slate-400 truncate">Page Admin</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
