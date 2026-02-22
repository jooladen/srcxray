'use client';

import type { HistoryItem } from '@/lib/history';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

interface Props {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
}

export default function HistoryPanel({ history, onSelect, onDelete }: Props) {
  if (history.length === 0) return null;

  return (
    <div className="mt-6 text-left">
      <p className="text-sm text-gray-500 mb-2 text-center">🕐 최근 분석한 파일</p>
      <div className="flex flex-col gap-1.5 max-w-md mx-auto">
        {history.map(item => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <button
              onClick={() => onSelect(item)}
              className="flex-1 flex items-center gap-2 text-left min-w-0"
            >
              <span className="text-base">📄</span>
              <div className="min-w-0">
                <div className="font-medium text-gray-800 text-sm truncate">{item.fileName}</div>
                <div className="text-xs text-gray-400">{item.lineCount}줄 · {timeAgo(item.analyzedAt)}</div>
              </div>
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="text-gray-300 hover:text-red-400 transition-colors text-sm shrink-0"
              title="삭제"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
