import React, { useState, useEffect, useRef } from 'react';
import {
  HardDrive,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Search,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Cloud,
  LogOut,
  Send,
  Database,
  ShieldCheck,
  FolderOpen,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  getAccessToken,
  listGoogleDriveFiles,
  getDriveStorageAbout,
  uploadMultipartFileToDrive,
  downloadJsonFileFromDrive,
  deleteFileFromDrive,
  DriveFileItem,
  DriveStorageInfo,
} from '../services/googleDriveAuth';
import { Order, ChatThread, ProductItem, QuickReplyTemplate } from '../types';

interface GoogleDriveViewProps {
  orders: Order[];
  threads: ChatThread[];
  products: ProductItem[];
  quickReplies: QuickReplyTemplate[];
  onRestoreBackupData: (backup: {
    orders?: Order[];
    threads?: ChatThread[];
    products?: ProductItem[];
    quickReplies?: QuickReplyTemplate[];
  }) => void;
  onSendFileToChat?: (text: string, imageUrl?: string) => void;
  language: 'kh' | 'en';
}

interface PendingConfirmAction {
  type: 'delete' | 'overwrite_backup' | 'restore_backup';
  title: string;
  description: string;
  confirmLabel: string;
  isDestructive?: boolean;
  onConfirm: () => Promise<void>;
}

export const GoogleDriveView: React.FC<GoogleDriveViewProps> = ({
  orders,
  threads,
  products,
  quickReplies,
  onRestoreBackupData,
  onSendFileToChat,
  language,
}) => {
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [storageInfo, setStorageInfo] = useState<DriveStorageInfo | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'backups' | 'images' | 'sheets'>('all');

  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmAction | null>(null);
  const [isExecutingConfirm, setIsExecutingConfirm] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, accessToken) => {
        setUser(authedUser);
        setToken(accessToken);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const fetchDriveData = async (query = searchQuery, filter = filterType) => {
    const currentToken = await getAccessToken();
    if (!currentToken) {
      setNeedsAuth(true);
      return;
    }

    setIsLoadingFiles(true);
    try {
      const [fileList, about] = await Promise.all([
        listGoogleDriveFiles(query, filter),
        getDriveStorageAbout().catch(() => null),
      ]);
      setFiles(fileList);
      if (about) setStorageInfo(about);
    } catch (err: any) {
      if (err.message === 'NO_ACCESS_TOKEN') {
        setNeedsAuth(true);
      } else {
        setStatusBanner({
          type: 'error',
          message:
            language === 'kh'
              ? `មិនអាចទាញទិន្នន័យពី Google Drive បានទេ៖ ${err.message}`
              : `Could not load Google Drive files: ${err.message}`,
        });
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (!needsAuth && token) {
      fetchDriveData(searchQuery, filterType);
    }
  }, [needsAuth, token, filterType]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setStatusBanner(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        setStatusBanner({
          type: 'success',
          message:
            language === 'kh'
              ? 'បានភ្ជាប់គណនី Google Drive ដោយជោគជ័យ!'
              : 'Successfully connected to Google Drive!',
        });
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setStatusBanner({
        type: 'error',
        message:
          language === 'kh'
            ? `ការភ្ជាប់ Google Drive បរាជ័យ៖ ${err.message || 'សូមព្យាយាមម្តងទៀត'}`
            : `Google Sign-In failed: ${err.message || 'Please try again'}`,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setUser(null);
    setToken(null);
    setFiles([]);
    setStorageInfo(null);
    setNeedsAuth(true);
  };

  const formatBytes = (bytes?: string | number) => {
    if (!bytes) return '—';
    const num = Number(bytes);
    if (isNaN(num) || num === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return `${parseFloat((num / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Backup full PageChat Pro state to Google Drive
  const executeBackupToDrive = async (existingFileId?: string) => {
    const currentToken = await getAccessToken();
    if (!currentToken) {
      setNeedsAuth(true);
      return;
    }

    setIsUploading(true);
    setStatusBanner(null);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = existingFileId
        ? files.find((f) => f.id === existingFileId)?.name || `PageChat_Pro_Backup_${dateStr}.json`
        : `PageChat_Pro_Backup_${dateStr}.json`;

      const backupPayload = {
        app: 'PageChat Pro',
        exportedAt: new Date().toISOString(),
        counts: {
          orders: orders.length,
          threads: threads.length,
          products: products.length,
          quickReplies: quickReplies.length,
        },
        orders,
        threads,
        products,
        quickReplies,
      };

      await uploadMultipartFileToDrive({
        name: fileName,
        content: JSON.stringify(backupPayload, null, 2),
        mimeType: 'application/json',
        existingFileId,
        description: `PageChat Pro Full Backup (${orders.length} Orders, ${threads.length} Chats, ${products.length} Products)`,
      });

      setStatusBanner({
        type: 'success',
        message:
          language === 'kh'
            ? `បានរក្សាទុកទិន្នន័យ احتياطي (Backup) "${fileName}" ទៅក្នុង Google Drive រួចរាល់!`
            : `Saved backup "${fileName}" to Google Drive!`,
      });
      await fetchDriveData(searchQuery, filterType);
    } catch (err: any) {
      if (err.message === 'NO_ACCESS_TOKEN') {
        setNeedsAuth(true);
      } else {
        setStatusBanner({
          type: 'error',
          message:
            language === 'kh'
              ? `បរាជ័យក្នុងការ Backup ទៅ Google Drive៖ ${err.message}`
              : `Failed to backup to Google Drive: ${err.message}`,
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleBackupClick = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const targetName = `PageChat_Pro_Backup_${dateStr}.json`;
    const existing = files.find((f) => f.name === targetName);

    if (existing) {
      // Mandatory user confirmation before overwriting existing file on Google Drive
      setPendingConfirm({
        type: 'overwrite_backup',
        title:
          language === 'kh'
            ? 'បញ្ជាក់ការសរសេរជាន់លើឯកសារ Backup ក្នុង Google Drive?'
            : 'Overwrite Existing Backup File in Google Drive?',
        description:
          language === 'kh'
            ? `ឯកសារ "${existing.name}" មាននៅក្នុង Google Drive រួចហើយ។ តើអ្នកពិតជាចង់ធ្វើបច្ចុប្បន្នភាព (Overwrite) ឯកសារនេះជាមួយនឹងការកុម្ម៉ង់ (${orders.length}), សារឆាត (${threads.length}), និងទំនិញ (${products.length}) បច្ចុប្បន្នមែនទេ?`
            : `File "${existing.name}" already exists in your Google Drive. Do you want to update its contents with your current ${orders.length} orders, ${threads.length} chats, and ${products.length} products?`,
        confirmLabel: language === 'kh' ? 'បញ្ជាក់ការកែប្រែ (Overwrite)' : 'Update File',
        isDestructive: false,
        onConfirm: async () => {
          await executeBackupToDrive(existing.id);
        },
      });
    } else {
      executeBackupToDrive();
    }
  };

  // Export Orders CSV to Google Drive
  const handleExportOrdersCsvToDrive = async () => {
    const currentToken = await getAccessToken();
    if (!currentToken) {
      setNeedsAuth(true);
      return;
    }

    setIsUploading(true);
    setStatusBanner(null);
    try {
      const headers = [
        'Order Number',
        'Customer Name',
        'Phone',
        'Province',
        'Address',
        'Items',
        'Total (USD)',
        'Total (KHR)',
        'Payment Method',
        'Delivery Provider',
        'Status',
        'Created At',
      ];
      const rows = orders.map((o) => [
        o.orderNumber,
        `"${(o.customerName || '').replace(/"/g, '""')}"`,
        `"${(o.customerPhone || '').replace(/"/g, '""')}"`,
        `"${(o.customerProvince || '').replace(/"/g, '""')}"`,
        `"${(o.customerAddress || '').replace(/"/g, '""')}"`,
        `"${(o.items || []).map((i) => `${i.name} x${i.quantity}`).join('; ').replace(/"/g, '""')}"`,
        o.total.toFixed(2),
        o.totalKhr,
        o.paymentMethod,
        o.deliveryProvider,
        o.status,
        o.createdAt,
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `PageChat_Orders_${dateStr}.csv`;

      await uploadMultipartFileToDrive({
        name: fileName,
        content: csvContent,
        mimeType: 'text/csv',
        description: `PageChat Pro Orders Report (${orders.length} orders)`,
      });

      setStatusBanner({
        type: 'success',
        message:
          language === 'kh'
            ? `បាននាំចេញតារាងបញ្ជាទិញ "${fileName}" ទៅកាន់ Google Drive រួចរាល់!`
            : `Exported orders report "${fileName}" to Google Drive!`,
      });
      await fetchDriveData(searchQuery, filterType);
    } catch (err: any) {
      if (err.message === 'NO_ACCESS_TOKEN') {
        setNeedsAuth(true);
      } else {
        setStatusBanner({
          type: 'error',
          message:
            language === 'kh'
              ? `បរាជ័យក្នុងការនាំចេញ CSV៖ ${err.message}`
              : `Failed to export CSV: ${err.message}`,
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Upload any local file (image, PDF, JSON, etc.) to Google Drive
  const handleLocalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const currentToken = await getAccessToken();
    if (!currentToken) {
      setNeedsAuth(true);
      return;
    }

    setIsUploading(true);
    setStatusBanner(null);
    try {
      const uploaded = await uploadMultipartFileToDrive({
        name: file.name,
        content: file,
        mimeType: file.type || 'application/octet-stream',
        description: 'Uploaded from PageChat Pro',
      });
      setStatusBanner({
        type: 'success',
        message:
          language === 'kh'
            ? `បានបង្ហោះឯកសារ "${uploaded.name}" ទៅក្នុង Google Drive ដោយជោគជ័យ!`
            : `Uploaded "${uploaded.name}" to Google Drive!`,
      });
      await fetchDriveData(searchQuery, filterType);
    } catch (err: any) {
      if (err.message === 'NO_ACCESS_TOKEN') {
        setNeedsAuth(true);
      } else {
        setStatusBanner({
          type: 'error',
          message:
            language === 'kh'
              ? `ការបង្ហោះឯកសារបរាជ័យ៖ ${err.message}`
              : `File upload failed: ${err.message}`,
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Restore store data from a Google Drive JSON backup (with mandatory confirmation dialog)
  const handleRestoreFromDriveFile = (file: DriveFileItem) => {
    setPendingConfirm({
      type: 'restore_backup',
      title:
        language === 'kh'
          ? `ទាញយក និងស្តារទិន្នន័យពី "${file.name}"?`
          : `Restore App Data from "${file.name}"?`,
      description:
        language === 'kh'
          ? `សកម្មភាពនេះនឹងស្តារបញ្ជីការកុម្ម៉ង់, សារជជែក Messenger, និងបញ្ជីទំនិញពីឯកសារ "${file.name}" ក្នុង Google Drive ចូលមកក្នុងកម្មវិធី PageChat Pro។`
          : `This will restore orders, Messenger conversations, and product catalog items from "${file.name}" into PageChat Pro.`,
      confirmLabel: language === 'kh' ? 'បញ្ជាក់ការស្តារទិន្នន័យ' : 'Confirm Restore',
      isDestructive: false,
      onConfirm: async () => {
        const data = await downloadJsonFileFromDrive(file.id);
        if (!data || (!data.orders && !data.threads && !data.products)) {
          throw new Error(
            language === 'kh'
              ? 'ទម្រង់ឯកសារ JSON មិនមែនជាឯកសារ Backup របស់ PageChat Pro ទេ'
              : 'Invalid PageChat Pro backup JSON format'
          );
        }
        onRestoreBackupData({
          orders: Array.isArray(data.orders) ? data.orders : undefined,
          threads: Array.isArray(data.threads) ? data.threads : undefined,
          products: Array.isArray(data.products) ? data.products : undefined,
          quickReplies: Array.isArray(data.quickReplies) ? data.quickReplies : undefined,
        });
        setStatusBanner({
          type: 'success',
          message:
            language === 'kh'
              ? `បានស្តារទិន្នន័យពី "${file.name}" ដោយជោគជ័យ!`
              : `Successfully restored data from "${file.name}"!`,
        });
      },
    });
  };

  // Delete file from Google Drive (with mandatory confirmation dialog)
  const handleDeleteDriveFileRequest = (file: DriveFileItem) => {
    setPendingConfirm({
      type: 'delete',
      title:
        language === 'kh'
          ? `លុបឯកសារ "${file.name}" ចេញពី Google Drive?`
          : `Delete "${file.name}" from Google Drive?`,
      description:
        language === 'kh'
          ? `តើអ្នកពិតជាចង់លុបឯកសារ "${file.name}" ចេញពីគណនី Google Drive របស់អ្នកមែនទេ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានឡើយ។`
          : `Are you sure you want to permanently delete "${file.name}" from your Google Drive? This action cannot be undone.`,
      confirmLabel: language === 'kh' ? 'បញ្ជាក់ការលុបឯកសារ' : 'Delete File',
      isDestructive: true,
      onConfirm: async () => {
        await deleteFileFromDrive(file.id);
        setFiles((prev) => prev.filter((f) => f.id !== file.id));
        setStatusBanner({
          type: 'success',
          message:
            language === 'kh'
              ? `បានលុបឯកសារ "${file.name}" ចេញពី Google Drive រួចរាល់។`
              : `Deleted "${file.name}" from Google Drive.`,
        });
      },
    });
  };

  const handleConfirmModalProceed = async () => {
    if (!pendingConfirm) return;
    setIsExecutingConfirm(true);
    try {
      await pendingConfirm.onConfirm();
      setPendingConfirm(null);
    } catch (err: any) {
      if (err.message === 'NO_ACCESS_TOKEN') {
        setNeedsAuth(true);
      } else {
        setStatusBanner({
          type: 'error',
          message: err.message || 'Operation failed',
        });
      }
      setPendingConfirm(null);
    } finally {
      setIsExecutingConfirm(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Top Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">
                {language === 'kh'
                  ? 'Google Drive Cloud & ប្រព័ន្ធរក្សាទុកទិន្នន័យ'
                  : 'Google Drive Cloud & Data Backup'}
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Workspace API
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {language === 'kh'
                ? 'រក្សាទុកការកុម្ម៉ង់ សារឆាត Messenger រូបភាពផលិតផល និងគ្រប់គ្រងឯកសារក្នុង Google Drive ផ្ទាល់'
                : 'Backup orders, Messenger chats, product photos, and manage files directly in Google Drive'}
            </p>
          </div>
        </div>

        {!needsAuth && user && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                  {(user.displayName || user.email || 'G')[0].toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800 leading-none">
                  {user.displayName || 'Google User'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">{user.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-colors cursor-pointer"
              title="ផ្តាច់គណនី Google Drive"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{language === 'kh' ? 'ចាកចេញ' : 'Sign Out'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="p-6 max-w-6xl w-full mx-auto space-y-6">
        {statusBanner && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium ${
              statusBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : statusBanner.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Authentication Gate: Official Sign in with Google button */}
        {needsAuth ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-lg mx-auto my-8 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4 text-blue-600">
              <Cloud className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">
              {language === 'kh'
                ? 'ភ្ជាប់គណនី Google Drive របស់អ្នក'
                : 'Connect Your Google Drive Account'}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              {language === 'kh'
                ? 'សូមចូលគណនីជាមួយ Google ដើម្បីអនុញ្ញាតឱ្យកម្មវិធី PageChat Pro រក្សាទុកទិន្នន័យការកុម្ម៉ង់ (Orders), សារជជែក Messenger, នាំចេញរបាយការណ៍ CSV និងគ្រប់គ្រងឯកសាររូបភាពក្នុង Google Drive របស់អ្នកដោយសុវត្ថិភាព។'
                : 'Sign in with Google to allow PageChat Pro to back up your orders and Messenger conversations, export CSV reports, and manage product files in your Google Drive.'}
            </p>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="gsi-material-button"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      xmlnsXlink="http://www.w3.org/1999/xlink"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      ></path>
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      ></path>
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      ></path>
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      ></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {isLoggingIn ? 'Connecting to Google...' : 'Sign in with Google'}
                  </span>
                  <span style={{ display: 'none' }}>Sign in with Google</span>
                </div>
              </button>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-3 gap-3 text-left">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold text-slate-800">📦 Backup ទិន្នន័យ</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  រក្សាទុក Orders & សារ Messenger មិនឱ្យបាត់
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold text-slate-800">📊 របាយការណ៍ CSV</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  នាំចេញតារាងលក់ទៅ Google Drive
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold text-slate-800">🖼️ ឯកសារ & រូបភាព</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  បង្ហោះ និងផ្ញើឯកសារចូលឆាតភ្លាមៗ
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Quick Cloud Actions Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Full Cloud Backup */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Database className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      JSON Cloud Sync
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {language === 'kh'
                      ? 'Backup ទិន្នន័យហាងទាំងមូលទៅ Drive'
                      : 'Backup Store Data to Drive'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {language === 'kh'
                      ? `រួមបញ្ចូល៖ ការកុម្ម៉ង់ (${orders.length}), សារឆាត (${threads.length}), និងទំនិញ (${products.length})`
                      : `Includes ${orders.length} orders, ${threads.length} chats, and ${products.length} products`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleBackupClick}
                  disabled={isUploading}
                  className="mt-4 w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Cloud className="w-4 h-4" />
                  <span>
                    {isUploading
                      ? language === 'kh'
                        ? 'កំពុងរក្សាទុក...'
                        : 'Saving...'
                      : language === 'kh'
                      ? 'Backup ទៅ Google Drive ឥឡូវនេះ'
                      : 'Backup to Google Drive Now'}
                  </span>
                </button>
              </div>

              {/* Card 2: Export Orders CSV */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <FileSpreadsheet className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                      CSV / Sheets
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {language === 'kh'
                      ? 'នាំចេញបញ្ជីការកុម្ម៉ង់ (CSV)'
                      : 'Export Orders Report (CSV)'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {language === 'kh'
                      ? `បង្កើតតារាងរបាយការណ៍លក់សរុប (${orders.length} វិក្កយបត្រ) ទុកក្នុង Google Drive`
                      : `Save all ${orders.length} order invoices as a spreadsheet in Google Drive`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportOrdersCsvToDrive}
                  disabled={isUploading}
                  className="mt-4 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>
                    {language === 'kh' ? 'នាំចេញ CSV ទៅ Google Drive' : 'Export CSV to Drive'}
                  </span>
                </button>
              </div>

              {/* Card 3: Upload File / Image + Storage Info */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </span>
                    {storageInfo?.usage && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        ប្រើប្រាស់៖ {formatBytes(storageInfo.usage)}
                        {storageInfo.limit ? ` / ${formatBytes(storageInfo.limit)}` : ''}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {language === 'kh'
                      ? 'បង្ហោះរូបភាព ឬឯកសារទៅ Google Drive'
                      : 'Upload Files & Photos to Drive'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {language === 'kh'
                      ? 'បង្ហោះរូបទំនិញ វិក្កយបត្រ ឬឯកសារផ្សេងៗចូលទៅក្នុង Google Drive'
                      : 'Upload product photos, receipts, or documents directly to Google Drive'}
                  </p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLocalFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="mt-4 w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {language === 'kh' ? 'ជ្រើសរើសឯកសារបង្ហោះ' : 'Select File to Upload'}
                  </span>
                </button>
              </div>
            </div>

            {/* File Browser Section */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <FolderOpen className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    {language === 'kh' ? 'ឯកសារក្នុង Google Drive របស់អ្នក' : 'Your Google Drive Files'}
                  </h2>
                  <div className="flex items-center gap-1 ml-2">
                    {[
                      { id: 'all', labelKh: 'ទាំងអស់', labelEn: 'All' },
                      { id: 'backups', labelKh: 'Backups (.json)', labelEn: 'Backups' },
                      { id: 'sheets', labelKh: 'តារាង (.csv)', labelEn: 'CSV/Sheets' },
                      { id: 'images', labelKh: 'រូបភាព', labelEn: 'Images' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFilterType(tab.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          filterType === tab.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {language === 'kh' ? tab.labelKh : tab.labelEn}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      fetchDriveData(searchQuery, filterType);
                    }}
                    className="relative flex-1 sm:w-64"
                  >
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        language === 'kh' ? 'ស្វែងរកឈ្មោះឯកសារ...' : 'Search Drive files...'
                      }
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                  </form>
                  <button
                    type="button"
                    onClick={() => fetchDriveData(searchQuery, filterType)}
                    disabled={isLoadingFiles}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                    title="ផ្ទុកឡើងវិញ"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {isLoadingFiles ? (
                <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                  <span>
                    {language === 'kh'
                      ? 'កំពុងទាញបញ្ជីឯកសារពី Google Drive...'
                      : 'Loading files from Google Drive...'}
                  </span>
                </div>
              ) : files.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  {language === 'kh'
                    ? 'មិនទាន់មានឯកសារត្រូវនឹងការស្វែងរកក្នុង Google Drive ទេ។ សូមចុច "Backup ទៅ Google Drive ឥឡូវនេះ" ខាងលើ!'
                    : 'No matching files found in Google Drive. Click "Backup to Google Drive Now" above to create one!'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {files.map((file) => {
                    const isJsonBackup =
                      file.mimeType === 'application/json' || file.name.endsWith('.json');
                    const isImage = file.mimeType?.startsWith('image/');
                    const isSheet =
                      file.mimeType === 'text/csv' ||
                      file.mimeType?.includes('spreadsheet') ||
                      file.name.endsWith('.csv');

                    return (
                      <div
                        key={file.id}
                        className="p-3.5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {file.thumbnailLink ? (
                            <img
                              src={file.thumbnailLink}
                              alt={file.name}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                isJsonBackup
                                  ? 'bg-blue-50 text-blue-600'
                                  : isSheet
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : isImage
                                  ? 'bg-pink-50 text-pink-600'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isJsonBackup ? (
                                <Database className="w-5 h-5" />
                              ) : isSheet ? (
                                <FileSpreadsheet className="w-5 h-5" />
                              ) : isImage ? (
                                <ImageIcon className="w-5 h-5" />
                              ) : (
                                <FileText className="w-5 h-5" />
                              )}
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{file.name}</p>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              <span>{formatBytes(file.size)}</span>
                              {file.modifiedTime && (
                                <>
                                  <span>•</span>
                                  <span>
                                    {new Date(file.modifiedTime).toLocaleString(
                                      language === 'kh' ? 'km-KH' : 'en-US'
                                    )}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {isJsonBackup && (
                            <button
                              type="button"
                              onClick={() => handleRestoreFromDriveFile(file)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                              title="ស្តារទិន្នន័យចូលក្នុងកម្មវិធី"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>{language === 'kh' ? 'ស្តារទិន្នន័យ (Restore)' : 'Restore'}</span>
                            </button>
                          )}

                          {onSendFileToChat && (
                            <button
                              type="button"
                              onClick={() => {
                                const shareText = `📎 ឯកសារពី Google Drive: ${file.name}${
                                  file.webViewLink ? `\n🔗 ${file.webViewLink}` : ''
                                }`;
                                onSendFileToChat(
                                  shareText,
                                  isImage ? file.thumbnailLink : undefined
                                );
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                              title="ផ្ញើទៅកាន់អតិថិជនក្នុង Messenger"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{language === 'kh' ? 'ផ្ញើចូលឆាត' : 'Send to Chat'}</span>
                            </button>
                          )}

                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>{language === 'kh' ? 'បើកមើល' : 'Open'}</span>
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteDriveFileRequest(file)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                            title="លុបឯកសារពី Google Drive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{language === 'kh' ? 'លុប' : 'Delete'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Mandatory User Confirmation Dialog for Mutating / Destructive Drive Operations */}
      {pendingConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  pendingConfirm.isDestructive
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-amber-100 text-amber-600'
                }`}
              >
                {pendingConfirm.isDestructive ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900">{pendingConfirm.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed mt-1.5">
                  {pendingConfirm.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isExecutingConfirm}
                onClick={() => setPendingConfirm(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                {language === 'kh' ? 'បោះបង់ (Cancel)' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isExecutingConfirm}
                onClick={handleConfirmModalProceed}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 ${
                  pendingConfirm.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isExecutingConfirm && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{pendingConfirm.confirmLabel}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
