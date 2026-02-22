'use client';

import type { ImportItem } from '@/lib/parser';

const CATEGORY_META: Record<ImportItem['category'], { label: string; color: string; emoji: string }> = {
  react:  { label: 'React 코어',    color: 'bg-sky-100 text-sky-700 border-sky-200',    emoji: '⚛️'  },
  ui:     { label: 'UI 라이브러리', color: 'bg-purple-100 text-purple-700 border-purple-200', emoji: '🎨' },
  util:   { label: '유틸리티',      color: 'bg-amber-100 text-amber-700 border-amber-200',   emoji: '🔧' },
  local:  { label: '내부 파일',     color: 'bg-green-100 text-green-700 border-green-200',   emoji: '📁' },
  other:  { label: '기타 패키지',   color: 'bg-gray-100 text-gray-600 border-gray-200',      emoji: '📦' },
};

export default function ImportMap({ imports }: { imports: ImportItem[] }) {
  if (imports.length === 0) {
    return <p className="text-gray-500 text-sm">import 구문이 없습니다.</p>;
  }

  const grouped = imports.reduce<Record<string, ImportItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs mb-2">
        {Object.entries(CATEGORY_META).map(([key, { label, color, emoji }]) =>
          grouped[key]?.length ? (
            <span key={key} className={`px-2 py-1 rounded-full border ${color}`}>
              {emoji} {label} ({grouped[key].length})
            </span>
          ) : null
        )}
      </div>

      {(Object.keys(CATEGORY_META) as ImportItem['category'][]).map(cat =>
        grouped[cat]?.length ? (
          <div key={cat}>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
            </h4>
            <div className="space-y-1">
              {grouped[cat].map((imp, i) => (
                <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-lg p-2 text-sm">
                  <code className="font-mono text-blue-700 font-semibold shrink-0">
                    {imp.source}
                  </code>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-700 flex flex-wrap gap-1">
                    {imp.specifiers.length > 0
                      ? imp.specifiers.map((s, j) => (
                          <code key={j} className="bg-white border px-1.5 rounded text-xs font-mono">{s}</code>
                        ))
                      : <span className="italic text-gray-400">side effect only</span>
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}

      <div className="text-xs text-gray-400 border-t pt-2 mt-2">
        💡 <strong>초보자 팁:</strong> import는 레고 블록을 가져오는 것입니다. 어디서 가져오는지(왼쪽)와 무엇을 가져오는지(오른쪽)를 확인하세요.
      </div>
    </div>
  );
}
