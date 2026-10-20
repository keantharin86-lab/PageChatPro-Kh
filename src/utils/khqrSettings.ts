import { useState, useEffect } from 'react';

export interface KhqrConfig {
  qrImage: string;
  merchantName: string;
  accountNumber: string;
  bankName: string;
}

const STORAGE_KEY = 'malis_khqr_config';

// An elegant self-contained SVG QR code data URI so it works out-of-the-box without missing asset files
export const DEFAULT_KHQR_IMAGE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240"><rect width="240" height="240" fill="%23ffffff"/><rect x="20" y="20" width="60" height="60" fill="%23D32F2F" rx="8"/><rect x="30" y="30" width="40" height="40" fill="%23ffffff" rx="4"/><rect x="40" y="40" width="20" height="20" fill="%23D32F2F"/><rect x="160" y="20" width="60" height="60" fill="%23D32F2F" rx="8"/><rect x="170" y="30" width="40" height="40" fill="%23ffffff" rx="4"/><rect x="180" y="40" width="20" height="20" fill="%23D32F2F"/><rect x="20" y="160" width="60" height="60" fill="%23D32F2F" rx="8"/><rect x="30" y="170" width="40" height="40" fill="%23ffffff" rx="4"/><rect x="40" y="180" width="20" height="20" fill="%23D32F2F"/><rect x="100" y="25" width="15" height="15" fill="%231E293B"/><rect x="125" y="25" width="15" height="25" fill="%231E293B"/><rect x="100" y="55" width="25" height="15" fill="%231E293B"/><rect x="35" y="100" width="20" height="15" fill="%231E293B"/><rect x="65" y="110" width="15" height="20" fill="%231E293B"/><rect x="100" y="100" width="40" height="40" fill="%23D32F2F" rx="6"/><text x="120" y="125" fill="%23ffffff" font-size="12" font-weight="bold" text-anchor="middle" font-family="sans-serif">KHQR</text><rect x="160" y="100" width="20" height="15" fill="%231E293B"/><rect x="195" y="110" width="20" height="25" fill="%231E293B"/><rect x="100" y="160" width="15" height="35" fill="%231E293B"/><rect x="130" y="170" width="20" height="15" fill="%231E293B"/><rect x="165" y="160" width="25" height="15" fill="%231E293B"/><rect x="195" y="180" width="25" height="35" fill="%231E293B"/><rect x="125" y="200" width="25" height="15" fill="%231E293B"/></svg>`;

export const FALLBACK_KHQR_IMAGE = DEFAULT_KHQR_IMAGE;

export const DEFAULT_KHQR_CONFIG: KhqrConfig = {
  qrImage: DEFAULT_KHQR_IMAGE,
  merchantName: 'Sok Chea CHHAI',
  accountNumber: '005 452 334',
  bankName: 'ABA Bank (KHQR / Bakong)',
};

export function getKhqrConfig(): KhqrConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        qrImage: parsed.qrImage || DEFAULT_KHQR_IMAGE,
        merchantName: parsed.merchantName || DEFAULT_KHQR_CONFIG.merchantName,
        accountNumber: parsed.accountNumber || DEFAULT_KHQR_CONFIG.accountNumber,
        bankName: parsed.bankName || DEFAULT_KHQR_CONFIG.bankName,
      };
    }
  } catch (e) {
    console.error('Error reading KHQR config from storage:', e);
  }
  return DEFAULT_KHQR_CONFIG;
}

export function saveKhqrConfig(newConfig: Partial<KhqrConfig>): KhqrConfig {
  const current = getKhqrConfig();
  const updated: KhqrConfig = {
    ...current,
    ...newConfig,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('khqr-updated', { detail: updated }));
  } catch (e) {
    console.error('Error saving KHQR config to storage:', e);
  }
  return updated;
}

export function resetKhqrConfig(): KhqrConfig {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('khqr-updated', { detail: DEFAULT_KHQR_CONFIG }));
  } catch (e) {
    console.error('Error resetting KHQR config:', e);
  }
  return DEFAULT_KHQR_CONFIG;
}

export function useKhqrConfig() {
  const [config, setConfig] = useState<KhqrConfig>(getKhqrConfig());

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e?.detail) {
        setConfig(e.detail);
      } else {
        setConfig(getKhqrConfig());
      }
    };
    window.addEventListener('khqr-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('khqr-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const updateKhqr = (newConfig: Partial<KhqrConfig>) => {
    const res = saveKhqrConfig(newConfig);
    setConfig(res);
    return res;
  };

  const resetKhqr = () => {
    const res = resetKhqrConfig();
    setConfig(res);
    return res;
  };

  return { config, updateKhqr, resetKhqr };
}
