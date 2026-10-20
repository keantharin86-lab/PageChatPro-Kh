import React, { useState, useRef } from 'react';
import {
  Monitor,
  Wifi,
  WifiOff,
  Download,
  Upload,
  CheckCircle2,
  RefreshCw,
  HardDrive,
  Edit3,
  X,
  Laptop,
  Save,
  Sparkles,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  isOnline: boolean;
  forceOfflineMode: boolean;
  onToggleOfflineMode: () => void;
  onExportLocalFile: () => void;
  onImportLocalFile: (data: any) => void;
  onSyncNow: () => Promise<void>;
  pendingOfflineEditsCount: number;
  lastSavedTime: string;
  language: 'kh' | 'en';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  isOnline,
  forceOfflineMode,
  onToggleOfflineMode,
  onExportLocalFile,
  onImportLocalFile,
  onSyncNow,
  pendingOfflineEditsCount,
  lastSavedTime,
  language,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showDesktopModal, setShowDesktopModal] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      setShowDesktopModal(true);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        onImportLocalFile(parsed);
        setStatusMessage(
          language === 'kh'
            ? `បានបើក និងស្តារឯកសារកុំព្យូទ័រ "${file.name}" រួចរាល់!`
            : `Loaded local computer file "${file.name}"!`
        );
        setTimeout(() => setStatusMessage(null), 3500);
      } catch {
        setStatusMessage(
          language === 'kh'
            ? 'ឯកសារមិនត្រឹមត្រូវ សូមជ្រើសរើសឯកសារ .json'
            : 'Invalid JSON file format'
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await onSyncNow();
      setStatusMessage(
        language === 'kh'
          ? 'បាន Sync រាល់ការកែប្រែពីកុំព្យូទ័រទៅ Online រួចរាល់!'
          : 'All offline desktop edits synced online!'
      );
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Online / Offline Desktop Editable Status Pill */}
        <button
          type="button"
          onClick={() => setShowDesktopModal(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
            isOnline
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 ring-2 ring-amber-400/20'
          }`}
          title="ចុចគ្រប់គ្រងកម្មវិធីកុំព្យូទ័រ Offline & Online"
        >
          {isOnline ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          )}
          <span className="truncate">
            {isOnline
              ? language === 'kh'
                ? 'Online + កុំព្យូទ័រ'
                : 'Online + Desktop'
              : language === 'kh'
              ? 'Offline កុំព្យូទ័រ (អាច Edit បាន)'
              : 'Offline Desktop (Editable)'}
          </span>
          {pendingOfflineEditsCount > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-extrabold rounded-full text-[10px]">
              {pendingOfflineEditsCount}
            </span>
          )}
        </button>

        {/* Direct Install App Button (if not already installed in standalone) */}
        {!isInstalled && (
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="តម្លើងកម្មវិធីលើកុំព្យូទ័រ (Windows / Mac)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>{language === 'kh' ? 'តម្លើងលើកុំព្យូទ័រ' : 'Install App'}</span>
          </button>
        )}
      </div>

      {/* iOS Safari Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-slate-900">
            <h3 className="text-base font-bold">
              {language === 'kh' ? 'តម្លើងកម្មវិធីលើ iPhone / iPad' : 'Install on iPhone / iPad'}
            </h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              1. ចុចប៊ូតុង <strong>Share</strong> នៅក្នុងរបារ Safari ខាងក្រោម។
              <br />
              2. អូសចុះក្រោម រួចចុច <strong>Add to Home Screen</strong>។
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 w-full rounded-xl bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
            >
              {language === 'kh' ? 'យល់ព្រម' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Full Desktop Offline & Local File Editor Modal */}
      {showDesktopModal && (
        <div
          onClick={() => setShowDesktopModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white text-slate-900 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200"
          >
            {/* Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold">
                      {language === 'kh'
                        ? 'កម្មវិធីកុំព្យូទ័រ PageChat Pro (Offline & Online Editable)'
                        : 'PageChat Pro Desktop App (Offline & Online Editable)'}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOnline
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {isOnline ? '🟢 Online' : '🟠 Offline Mode'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {language === 'kh'
                      ? 'អាចបង្កើត និងកែប្រែ (Edit) គ្រប់មុខងារនៅលើកុំព្យូទ័រ ទោះបីគ្មានអ៊ីនធឺណិត (Offline) ដូចពេល Online ដែរ'
                      : 'Create and edit orders, messages, products, and invoices offline on your computer just like online'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDesktopModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {statusMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* 1. Offline / Online Switcher Banner */}
              <div
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  !isOnline
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-emerald-50/70 border-emerald-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {!isOnline ? (
                      <WifiOff className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Wifi className="w-4 h-4 text-emerald-600" />
                    )}
                    <span className="text-xs font-bold text-slate-900">
                      {!isOnline
                        ? language === 'kh'
                          ? 'កំពុងប្រើប្រាស់មុខងារ Offline លើកុំព្យូទ័រ (អាច Edit បាន ១០០%)'
                          : 'Running in Offline Desktop Mode (100% Editable)'
                        : language === 'kh'
                        ? 'កំពុងភ្ជាប់ Online + រក្សាទុកក្នុងកុំព្យូទ័រស្វ័យប្រវត្តិ (IndexedDB)'
                        : 'Online + Auto-Saving to Computer IndexedDB'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {language === 'kh'
                      ? `រក្សាទុកក្នុងកុំព្យូទ័រចុងក្រោយ៖ ${lastSavedTime} | ការកែប្រែរង់ចាំ Sync៖ ${pendingOfflineEditsCount}`
                      : `Last saved to computer: ${lastSavedTime} | Pending offline edits: ${pendingOfflineEditsCount}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={onToggleOfflineMode}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      forceOfflineMode
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-amber-600 hover:bg-amber-700 text-white'
                    }`}
                  >
                    {forceOfflineMode
                      ? language === 'kh'
                        ? 'ប្តូរទៅ Online វិញ'
                        : 'Switch to Online'
                      : language === 'kh'
                      ? 'បើកមុខងារ Offline'
                      : 'Switch to Offline Mode'}
                  </button>

                  {isOnline && (
                    <button
                      type="button"
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Sync</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 2. What works Offline on Computer (Editable Features Grid) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-2.5">
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    {language === 'kh'
                      ? 'មុខងារដែលអាចកែប្រែ (Edit) ពេល Offline លើកុំព្យូទ័រដូចពេល Online ១០០%៖'
                      : 'Features Editable Offline on Desktop Just Like Online:'}
                  </span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800">បង្កើត & កែប្រែវិក្កយបត្រ (Orders)</p>
                      <p className="text-[11px] text-slate-500">
                        បង្កើត Order ថ្មី, កែប្រែបុង, បោះពុម្ពវិក្កយបត្រ និងប្តូរស្ថានភាពដឹកជញ្ជូន
                      </p>
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800">ឆ្លើយតប & កែប្រែសារឆាត (Edit Chat)</p>
                      <p className="text-[11px] text-slate-500">
                        ផ្ញើសារ, កែប្រែអត្ថបទសារ, បញ្ចូលរូបភាព និងផ្ញើកាត KHQR ក្នុងឆាត
                      </p>
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800">បន្ថែម & កែប្រែទំនិញក្នុងស្តុក (Stock)</p>
                      <p className="text-[11px] text-slate-500">
                        បន្ថែមម៉ូដថ្មី, កែតម្លៃ, កែចំនួនស្តុក (+/-) និងប្តូររូបភាពផលិតផល
                      </p>
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800">កែប្រែអតិថិជន, KHQR & សាររហ័ស</p>
                      <p className="text-[11px] text-slate-500">
                        កែប្រែលេខទូរស័ព្ទ/ទីតាំងអតិថិជន, ប្តូររូប KHQR និងកែសាររហ័ស `/`
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Save / Open Local Computer File (.pagechat.json) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Save className="w-4 h-4 text-blue-600" />
                      <span>រក្សាទុកជាឯកសារលើកុំព្យូទ័រ (Save File)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      ទាញយកទិន្នន័យទាំងអស់ទុកក្នុង Folder កុំព្យូទ័រ (`.pagechat.json`) សម្រាប់ទុកប្រើ Offline
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onExportLocalFile();
                      setStatusMessage(
                        language === 'kh'
                          ? 'បានទាញយកឯកសារទិន្នន័យទុកលើកុំព្យូទ័ររួចរាល់!'
                          : 'Saved database file to computer!'
                      );
                    }}
                    className="mt-3 w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>រក្សាទុកឯកសារលើកុំព្យូទ័រ</span>
                  </button>
                </div>

                <div className="p-3.5 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <HardDrive className="w-4 h-4 text-emerald-600" />
                      <span>បើកឯកសារពីកុំព្យូទ័រមក Edit (Open File)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      ជ្រើសរើសឯកសារ `.json` ពីកុំព្យូទ័ររបស់អ្នកដើម្បីបើកមើល និងកែប្រែ (Edit) ពេលគ្មានអ៊ីនធឺណិត
                    </p>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileImport}
                    accept=".json,application/json"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>បើកឯកសារពីកុំព្យូទ័រ</span>
                  </button>
                </div>
              </div>

              {/* 4. Install as Native Desktop App (Windows / Mac PWA) */}
              <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Monitor className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold">
                      {isInstalled
                        ? 'កម្មវិធីត្រូវបានតម្លើងលើកុំព្យូទ័ររួចរាល់ (Installed Desktop App)'
                        : 'តម្លើងជាកម្មវិធីលើអេក្រង់កុំព្យូទ័រ (Windows / Mac Desktop App)'}
                    </p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      {isInstallable
                        ? 'ចុចប៊ូតុងខាងស្តាំដើម្បីតម្លើងកម្មវិធីទុកលើ Desktop បើកប្រើពេល Offline បានភ្លាមៗ'
                        : 'អ្នកក៏អាចចុចរូបតំណាង Install (⊕) នៅលើរបារអាសយដ្ឋាន Chrome / Edge ខាងលើ ដើម្បីដាក់កម្មវិធីលើ Desktop កុំព្យូទ័រ'}
                    </p>
                  </div>
                </div>
                {isInstallable && (
                  <button
                    type="button"
                    onClick={install}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer"
                  >
                    តម្លើងឥឡូវនេះ
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
