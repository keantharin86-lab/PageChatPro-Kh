export type TagColorKey =
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'purple'
  | 'cyan'
  | 'orange'
  | 'slate';

export interface TagColorTheme {
  key: TagColorKey;
  labelKh: string;
  labelEn: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
  swatchClass: string;
  ringClass: string;
}

export interface TagPresetItem {
  label: string;
  color: TagColorKey;
  isSystem?: boolean;
}

export const TAG_COLOR_PALETTE: TagColorTheme[] = [
  {
    key: 'blue',
    labelKh: 'ខៀវ (សួរព័ត៌មាន)',
    labelEn: 'Blue (Inquiry)',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-200',
    dotClass: 'bg-blue-500',
    swatchClass: 'bg-blue-500 hover:bg-blue-600',
    ringClass: 'ring-blue-500',
  },
  {
    key: 'emerald',
    labelKh: 'បៃតង (បានកុម្ម៉ង់)',
    labelEn: 'Green (Ordered)',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-200',
    dotClass: 'bg-emerald-500',
    swatchClass: 'bg-emerald-500 hover:bg-emerald-600',
    ringClass: 'ring-emerald-500',
  },
  {
    key: 'amber',
    labelKh: 'លឿងមាស (VIP / សំខាន់)',
    labelEn: 'Amber (VIP)',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-800',
    borderClass: 'border-amber-300',
    dotClass: 'bg-amber-500',
    swatchClass: 'bg-amber-500 hover:bg-amber-600',
    ringClass: 'ring-amber-500',
  },
  {
    key: 'rose',
    labelKh: 'ក្រហមផ្កាឈូក (រង់ចាំវេលុយ/បន្ទាន់)',
    labelEn: 'Rose (Urgent / Payment)',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-200',
    dotClass: 'bg-rose-500',
    swatchClass: 'bg-rose-500 hover:bg-rose-600',
    ringClass: 'ring-rose-500',
  },
  {
    key: 'purple',
    labelKh: 'ស្វាយ (ទិញដុំ / តំណាងចែកចាយ)',
    labelEn: 'Purple (Wholesale)',
    bgClass: 'bg-purple-50',
    textClass: 'text-purple-700',
    borderClass: 'border-purple-200',
    dotClass: 'bg-purple-500',
    swatchClass: 'bg-purple-500 hover:bg-purple-600',
    ringClass: 'ring-purple-500',
  },
  {
    key: 'cyan',
    labelKh: 'ផ្ទៃមេឃ (ភ្ញៀវថ្មី)',
    labelEn: 'Cyan (New Lead)',
    bgClass: 'bg-cyan-50',
    textClass: 'text-cyan-700',
    borderClass: 'border-cyan-200',
    dotClass: 'bg-cyan-500',
    swatchClass: 'bg-cyan-500 hover:bg-cyan-600',
    ringClass: 'ring-cyan-500',
  },
  {
    key: 'orange',
    labelKh: 'ទឹកក្រូច (កំពុងដឹកជញ្ជូន)',
    labelEn: 'Orange (Delivery)',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700',
    borderClass: 'border-orange-200',
    dotClass: 'bg-orange-500',
    swatchClass: 'bg-orange-500 hover:bg-orange-600',
    ringClass: 'ring-orange-500',
  },
  {
    key: 'slate',
    labelKh: 'ប្រផេះ (ទូទៅ)',
    labelEn: 'Slate (General)',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-200',
    dotClass: 'bg-slate-500',
    swatchClass: 'bg-slate-500 hover:bg-slate-600',
    ringClass: 'ring-slate-500',
  },
];

export const DEFAULT_TAG_PRESETS: TagPresetItem[] = [
  { label: 'VIP', color: 'amber', isSystem: true },
  { label: 'សួរតម្លៃ', color: 'blue', isSystem: true },
  { label: 'រង់ចាំវេលុយ', color: 'rose', isSystem: true },
  { label: 'បានកុម្ម៉ង់', color: 'emerald', isSystem: true },
  { label: 'ទិញដុំ', color: 'purple', isSystem: true },
  { label: 'ដឹកបន្ទាន់', color: 'orange', isSystem: true },
  { label: 'ភ្ញៀវថ្មី', color: 'cyan', isSystem: true },
  { label: 'អតិថិជនចាស់', color: 'emerald', isSystem: true },
];

const TAG_COLOR_STORAGE_KEY = 'pagechat_tag_color_map_v1';
const TAG_PRESETS_STORAGE_KEY = 'pagechat_tag_presets_v1';

const DEFAULT_COLOR_BY_NAME: Record<string, TagColorKey> = {
  VIP: 'amber',
  'សួរតម្លៃ': 'blue',
  'រង់ចាំវេលុយ': 'rose',
  'បានកុម្ម៉ង់': 'emerald',
  'ទិញដុំ': 'purple',
  'ដឹកបន្ទាន់': 'orange',
  'ភ្ញៀវថ្មី': 'cyan',
  'អតិថិជនចាស់': 'emerald',
  'ទិញញឹកញាប់': 'amber',
  'បង់ប្រាក់រួច': 'emerald',
};

export function loadSavedTagColorMap(): Record<string, TagColorKey> {
  try {
    const raw = localStorage.getItem(TAG_COLOR_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_COLOR_BY_NAME };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return { ...DEFAULT_COLOR_BY_NAME, ...parsed };
    }
  } catch {
    // ignore storage errors
  }
  return { ...DEFAULT_COLOR_BY_NAME };
}

export function saveTagColorMap(map: Record<string, TagColorKey>): void {
  try {
    localStorage.setItem(TAG_COLOR_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('pagechat-tag-colors-updated'));
  } catch {
    // ignore storage errors
  }
}

export function loadSavedTagPresets(): TagPresetItem[] {
  try {
    const raw = localStorage.getItem(TAG_PRESETS_STORAGE_KEY);
    if (!raw) return DEFAULT_TAG_PRESETS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_TAG_PRESETS;
}

export function saveTagPresets(presets: TagPresetItem[]): void {
  try {
    localStorage.setItem(TAG_PRESETS_STORAGE_KEY, JSON.stringify(presets));
    window.dispatchEvent(new CustomEvent('pagechat-tag-colors-updated'));
  } catch {
    // ignore storage errors
  }
}

export function resolveTagColorKey(
  tag: string,
  customerTagColors?: Record<string, string>,
  globalColorMap?: Record<string, TagColorKey>
): TagColorKey {
  const trimmed = tag.trim();
  const customOverride = customerTagColors?.[trimmed] as TagColorKey | undefined;
  if (customOverride && TAG_COLOR_PALETTE.some((p) => p.key === customOverride)) {
    return customOverride;
  }
  const map = globalColorMap || loadSavedTagColorMap();
  const mapped = map[trimmed];
  if (mapped && TAG_COLOR_PALETTE.some((p) => p.key === mapped)) {
    return mapped;
  }
  if (DEFAULT_COLOR_BY_NAME[trimmed]) {
    return DEFAULT_COLOR_BY_NAME[trimmed];
  }
  // Deterministic color fallback for unknown tags based on character sum
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash + trimmed.charCodeAt(i) * (i + 1)) % TAG_COLOR_PALETTE.length;
  }
  return TAG_COLOR_PALETTE[hash]?.key || 'blue';
}

export function getTagColorTheme(
  tag: string,
  customerTagColors?: Record<string, string>,
  globalColorMap?: Record<string, TagColorKey>
): TagColorTheme {
  const key = resolveTagColorKey(tag, customerTagColors, globalColorMap);
  return TAG_COLOR_PALETTE.find((p) => p.key === key) || TAG_COLOR_PALETTE[0];
}
