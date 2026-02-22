const STORAGE_KEY = 'srcxray-history';
const MAX_ITEMS = 5;

export interface HistoryItem {
  id: string;
  fileName: string;
  code: string;
  lineCount: number;
  analyzedAt: string;
}

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(fileName: string, code: string): HistoryItem[] {
  const prev = loadHistory().filter(h => h.fileName !== fileName);
  const next: HistoryItem[] = [
    {
      id: Math.random().toString(36).slice(2),
      fileName,
      code,
      lineCount: code.split('\n').length,
      analyzedAt: new Date().toISOString(),
    },
    ...prev,
  ].slice(0, MAX_ITEMS);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
  return next;
}

export function deleteHistory(id: string): HistoryItem[] {
  const next = loadHistory().filter(h => h.id !== id);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
  return next;
}
