// IndexedDB Local Computer Database for 100% Offline Editing & Unlimited Storage
const DB_NAME = 'PageChatProDesktopDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

export interface OfflineEditLogItem {
  id: string;
  action: string;
  target: string;
  timestamp: string;
  synced: boolean;
}

function openDesktopDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveToDesktopIndexedDB(key: string, value: any): Promise<boolean> {
  try {
    const db = await openDesktopDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

export async function loadFromDesktopIndexedDB<T>(key: string): Promise<T | null> {
  try {
    const db = await openDesktopDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as T) ?? null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

export function exportDesktopDatabaseFile(payload: {
  pages: any[];
  threads: any[];
  orders: any[];
  products: any[];
  quickReplies: any[];
  autoReplies: any[];
}) {
  const dateStr = new Date().toISOString().split('T')[0];
  const fileData = {
    app: 'PageChat Pro Desktop Offline Edition',
    version: '2.0',
    savedAt: new Date().toISOString(),
    ...payload,
  };
  const blob = new Blob([JSON.stringify(fileData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PageChat_Desktop_Offline_${dateStr}.pagechat.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
