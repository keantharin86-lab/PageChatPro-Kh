import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.apps.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.scripts',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory and sessionStorage so page reloads preserve Google Drive Auto-Backup
let cachedAccessToken: string | null = (() => {
  try {
    return sessionStorage.getItem('pagechat_gdrive_access_token');
  } catch {
    return null;
  }
})();

const setDriveAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  try {
    if (token) {
      sessionStorage.setItem('pagechat_gdrive_access_token', token);
    } else {
      sessionStorage.removeItem('pagechat_gdrive_access_token');
    }
  } catch {}
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        setDriveAccessToken(null);
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      setDriveAccessToken(null);
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    setDriveAccessToken(credential.accessToken);
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentGoogleUser = (): User | null => {
  return auth.currentUser;
};

export const logoutGoogle = async () => {
  await auth.signOut();
  setDriveAccessToken(null);
};

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

export interface DriveStorageInfo {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
  userEmail?: string;
  userDisplayName?: string;
  userPhotoUrl?: string;
}

export const getDriveStorageAbout = async (): Promise<DriveStorageInfo> => {
  const token = await getAccessToken();
  if (!token) throw new Error('NO_ACCESS_TOKEN');

  const res = await fetch(
    'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink),storageQuota(limit,usage,usageInDrive)',
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('NO_ACCESS_TOKEN');
    }
    throw new Error(`Drive API error: ${res.status}`);
  }
  const data = await res.json();
  return {
    limit: data.storageQuota?.limit,
    usage: data.storageQuota?.usage,
    usageInDrive: data.storageQuota?.usageInDrive,
    userEmail: data.user?.emailAddress,
    userDisplayName: data.user?.displayName,
    userPhotoUrl: data.user?.photoLink,
  };
};

export const listGoogleDriveFiles = async (
  searchQuery = '',
  filterType: 'all' | 'backups' | 'images' | 'sheets' = 'all'
): Promise<DriveFileItem[]> => {
  const token = await getAccessToken();
  if (!token) throw new Error('NO_ACCESS_TOKEN');

  const conditions: string[] = ['trashed = false'];
  if (searchQuery.trim()) {
    const escaped = searchQuery.trim().replace(/'/g, "\\'");
    conditions.push(`name contains '${escaped}'`);
  }
  if (filterType === 'backups') {
    conditions.push(`(name contains 'PageChat' or mimeType = 'application/json')`);
  } else if (filterType === 'images') {
    conditions.push(`mimeType contains 'image/'`);
  } else if (filterType === 'sheets') {
    conditions.push(`(mimeType = 'text/csv' or mimeType = 'application/vnd.google-apps.spreadsheet')`);
  }

  const q = encodeURIComponent(conditions.join(' and '));
  const fields = encodeURIComponent(
    'files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink,iconLink,thumbnailLink)'
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=30&orderBy=modifiedTime desc&fields=${fields}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('NO_ACCESS_TOKEN');
    }
    const errText = await res.text();
    throw new Error(errText || `Failed to list files (${res.status})`);
  }

  const data = await res.json();
  return data.files || [];
};

export const uploadMultipartFileToDrive = async ({
  name,
  content,
  mimeType,
  existingFileId,
  description,
}: {
  name: string;
  content: Blob | string;
  mimeType: string;
  existingFileId?: string;
  description?: string;
}): Promise<DriveFileItem> => {
  const token = await getAccessToken();
  if (!token) throw new Error('NO_ACCESS_TOKEN');

  const metadata: Record<string, any> = {
    name,
    mimeType,
  };
  if (description) {
    metadata.description = description;
  }

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  const fileBlob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  form.append('file', fileBlob);

  const endpoint = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink';

  const res = await fetch(endpoint, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('NO_ACCESS_TOKEN');
    }
    const errText = await res.text();
    throw new Error(errText || `Failed to upload file (${res.status})`);
  }

  return await res.json();
};

export const downloadJsonFileFromDrive = async (fileId: string): Promise<any> => {
  const token = await getAccessToken();
  if (!token) throw new Error('NO_ACCESS_TOKEN');

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('NO_ACCESS_TOKEN');
    }
    throw new Error(`Failed to download file (${res.status})`);
  }
  return await res.json();
};

export const deleteFileFromDrive = async (fileId: string): Promise<void> => {
  const token = await getAccessToken();
  if (!token) throw new Error('NO_ACCESS_TOKEN');

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok && res.status !== 204) {
    if (res.status === 401) {
      setDriveAccessToken(null);
      throw new Error('NO_ACCESS_TOKEN');
    }
    throw new Error(`Failed to delete file (${res.status})`);
  }
};

const AUTO_BACKUP_FILE_NAME = 'PageChat_Pro_AutoBackup_Cloud.json';
const AUTO_BACKUP_FILE_ID_KEY = 'pagechat_gdrive_autobackup_file_id';

export const autoBackupStoreDataToDrive = async (payload: {
  orders: any[];
  threads: any[];
  products: any[];
  quickReplies: any[];
  autoReplies?: any[];
  pages?: any[];
}): Promise<{ syncedToDrive: boolean; fileName: string; syncedAt: string }> => {
  const nowIso = new Date().toISOString();
  const backupData = {
    app: 'PageChat Pro (Auto Backup Every 1 Min)',
    exportedAt: nowIso,
    counts: {
      orders: payload.orders?.length || 0,
      threads: payload.threads?.length || 0,
      products: payload.products?.length || 0,
      quickReplies: payload.quickReplies?.length || 0,
    },
    orders: payload.orders || [],
    threads: payload.threads || [],
    products: payload.products || [],
    quickReplies: payload.quickReplies || [],
    autoReplies: payload.autoReplies || [],
    pages: payload.pages || [],
  };

  const token = await getAccessToken();
  if (!token) {
    return {
      syncedToDrive: false,
      fileName: AUTO_BACKUP_FILE_NAME,
      syncedAt: nowIso,
    };
  }

  let targetFileId: string | undefined;
  try {
    targetFileId = localStorage.getItem(AUTO_BACKUP_FILE_ID_KEY) || undefined;
  } catch {}

  if (!targetFileId) {
    try {
      const existingFiles = await listGoogleDriveFiles(AUTO_BACKUP_FILE_NAME, 'backups');
      const matched = existingFiles.find((f) => f.name === AUTO_BACKUP_FILE_NAME);
      if (matched?.id) {
        targetFileId = matched.id;
        try {
          localStorage.setItem(AUTO_BACKUP_FILE_ID_KEY, targetFileId);
        } catch {}
      }
    } catch {}
  }

  try {
    const uploaded = await uploadMultipartFileToDrive({
      name: AUTO_BACKUP_FILE_NAME,
      content: JSON.stringify(backupData, null, 2),
      mimeType: 'application/json',
      existingFileId: targetFileId,
      description: `PageChat Pro 1-Minute Auto Cloud Backup (${backupData.counts.products} Products, ${backupData.counts.orders} Orders, ${backupData.counts.threads} Chats)`,
    });
    if (uploaded?.id) {
      try {
        localStorage.setItem(AUTO_BACKUP_FILE_ID_KEY, uploaded.id);
      } catch {}
    }
    return {
      syncedToDrive: true,
      fileName: uploaded.name || AUTO_BACKUP_FILE_NAME,
      syncedAt: nowIso,
    };
  } catch (err: any) {
    // If cached fileId was deleted on Drive (404), clear cached ID and create fresh file
    if (targetFileId) {
      try {
        localStorage.removeItem(AUTO_BACKUP_FILE_ID_KEY);
      } catch {}
      const uploadedRetry = await uploadMultipartFileToDrive({
        name: AUTO_BACKUP_FILE_NAME,
        content: JSON.stringify(backupData, null, 2),
        mimeType: 'application/json',
        description: `PageChat Pro 1-Minute Auto Cloud Backup (${backupData.counts.products} Products, ${backupData.counts.orders} Orders, ${backupData.counts.threads} Chats)`,
      });
      if (uploadedRetry?.id) {
        try {
          localStorage.setItem(AUTO_BACKUP_FILE_ID_KEY, uploadedRetry.id);
        } catch {}
      }
      return {
        syncedToDrive: true,
        fileName: uploadedRetry.name || AUTO_BACKUP_FILE_NAME,
        syncedAt: nowIso,
      };
    }
    throw err;
  }
};

