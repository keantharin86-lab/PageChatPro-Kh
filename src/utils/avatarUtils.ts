import { Customer, PageAccount } from '../types';

const GENERIC_STOCK_AVATARS = [
  'photo-1534528741775-53994a69daeb',
  'photo-1507003211169-0a1dd7228f2d',
];

export function isGenericStockCustomerAvatar(url?: string): boolean {
  if (!url || !url.trim()) return true;
  return GENERIC_STOCK_AVATARS.some((stockId) => url.includes(stockId));
}

export function buildClientFallbackAvatarDataUrl(name?: string, pageName?: string): string {
  const cleanName = (name || 'អតិថិជន').replace(/\(.*?\)/g, '').trim() || 'អតិថិជន';
  const words = cleanName.split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? `${Array.from(words[0])[0] || ''}${Array.from(words[words.length - 1])[0] || ''}`.toUpperCase()
      : Array.from(cleanName).slice(0, 2).join('').toUpperCase();

  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = (hash * 31 + cleanName.charCodeAt(i)) >>> 0;
  }
  const palettes = [
    ['#0084FF', '#00C6FF'],
    ['#0062E0', '#19AFFF'],
    ['#4F46E5', '#06B6D4'],
    ['#0284C7', '#38BDF8'],
    ['#2563EB', '#60A5FA'],
    ['#0D9488', '#2DD4BF'],
  ];
  const [c1, c2] = palettes[hash % palettes.length];
  const shortPage = (pageName || 'FB Page').split(' - ')[0].slice(0, 14);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="240" height="240" rx="120" fill="url(#g)"/>
    <circle cx="120" cy="86" r="42" fill="#ffffff" fill-opacity="0.22"/>
    <path d="M44 214 C44 158 80 138 120 138 C160 138 196 158 196 214" fill="#ffffff" fill-opacity="0.22"/>
    <text x="120" y="132" text-anchor="middle" font-family="sans-serif" font-size="60" font-weight="800" fill="#ffffff">${initials}</text>
    <rect x="34" y="182" width="172" height="32" rx="16" fill="#0f172a" fill-opacity="0.45"/>
    <text x="120" y="203" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="700" fill="#ffffff">${shortPage}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function resolveCustomerOriginalPageAvatar(
  customer?: Partial<Customer> | null,
  page?: Partial<PageAccount> | null
): string {
  if (!customer) {
    return buildClientFallbackAvatarDataUrl('អតិថិជន', page?.name);
  }
  const existing = (customer.avatarUrl || '').trim();
  if (existing && !isGenericStockCustomerAvatar(existing)) {
    return existing;
  }
  const psid = customer.psid || customer.id || 'fb_cust';
  const pageId = page?.id || 'page_default';
  const custName = customer.name || 'អតិថិជន Facebook';
  const pageName = page?.name || 'Facebook Page';
  return `/api/facebook/avatar/${encodeURIComponent(psid)}?pageId=${encodeURIComponent(pageId)}&name=${encodeURIComponent(custName)}&pageName=${encodeURIComponent(pageName)}`;
}

export function resolvePageOriginalAvatar(page?: Partial<PageAccount> | null): string {
  if (page?.avatar && page.avatar.trim()) {
    return page.avatar.trim();
  }
  return buildClientFallbackAvatarDataUrl(page?.name || 'FB Page', 'Facebook Page');
}
