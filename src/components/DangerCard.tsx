'use client';

import { useState, useMemo } from 'react';
import type { DangerItem, DangerLevel } from '@/lib/danger-detector';

// ─── 상수 ───

type DangerCategory = 'hooks' | 'rendering' | 'state' | 'performance' | 'security' | 'style';

const LEVEL_STYLE: Record<DangerLevel, { bg: string; badge: string; label: string; border: string }> = {
  critical: {
    bg: 'bg-red-50',
    badge: 'bg-red-600 text-white',
    label: '🚨 절대 금지',
    border: 'border-red-400',
  },
  high: {
    bg: 'bg-orange-50',
    badge: 'bg-red-100 text-red-700',
    label: '🔴 높음',
    border: 'border-orange-300',
  },
  medium: {
    bg: 'bg-yellow-50',
    badge: 'bg-yellow-100 text-yellow-700',
    label: '🟡 중간',
    border: 'border-yellow-300',
  },
  low: {
    bg: 'bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    label: '🔵 낮음',
    border: 'border-blue-200',
  },
};

const CATEGORY_META: Record<DangerCategory, { label: string; emoji: string; color: string }> = {
  hooks:       { label: 'Hooks',    emoji: '🪝', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  rendering:   { label: '렌더링',   emoji: '🖥️', color: 'bg-sky-100 text-sky-700 border-sky-300' },
  state:       { label: '상태관리', emoji: '📊', color: 'bg-green-100 text-green-700 border-green-300' },
  performance: { label: '성능',     emoji: '⚡', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  security:    { label: '보안',     emoji: '🔒', color: 'bg-red-100 text-red-700 border-red-300' },
  style:       { label: '스타일',   emoji: '🎨', color: 'bg-gray-100 text-gray-600 border-gray-300' },
};

const LEVEL_WEIGHT: Record<DangerLevel, number> = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
};

// ─── 점수 대시보드 ───

function DangerSummary({ dangers }: { dangers: DangerItem[] }) {
  const score = useMemo(() => {
    let s = 100;
    for (const d of dangers) {
      s -= LEVEL_WEIGHT[d.level];
    }
    return Math.max(0, s);
  }, [dangers]);

  const scoreColor = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600';
  const scoreBg = score >= 80 ? 'bg-green-50 border-green-200' : score >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  const counts = useMemo(() => ({
    critical: dangers.filter(d => d.level === 'critical').length,
    high: dangers.filter(d => d.level === 'high').length,
    medium: dangers.filter(d => d.level === 'medium').length,
    low: dangers.filter(d => d.level === 'low').length,
  }), [dangers]);

  return (
    <div className={`rounded-xl border p-4 ${scoreBg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-black ${scoreColor}`}>{score}</span>
          <span className="text-sm text-gray-500">/100점</span>
        </div>
        <div className="flex gap-2 text-xs">
          {counts.critical > 0 && <span className="bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">🚨 {counts.critical}</span>}
          {counts.high > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">🔴 {counts.high}</span>}
          {counts.medium > 0 && <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">🟡 {counts.medium}</span>}
          {counts.low > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">🔵 {counts.low}</span>}
        </div>
      </div>
      {counts.critical > 0 && (
        <p className="text-xs text-red-600 font-semibold mt-2">
          치명적 안티패턴 {counts.critical}개 — 반드시 수정이 필요합니다!
        </p>
      )}
    </div>
  );
}

// ─── 카테고리 필터 Pill ───

function CategoryFilterPills({
  dangers,
  activeCategory,
  onToggle,
}: {
  dangers: DangerItem[];
  activeCategory: DangerCategory | null;
  onToggle: (cat: DangerCategory | null) => void;
}) {
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<DangerCategory, number>> = {};
    for (const d of dangers) {
      const cat = d.category as DangerCategory;
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [dangers]);

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <button
        onClick={() => onToggle(null)}
        className={`px-3 py-1.5 rounded-full border font-semibold transition-colors ${
          activeCategory === null
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
        }`}
      >
        전체 ({dangers.length})
      </button>
      {(Object.keys(CATEGORY_META) as DangerCategory[]).map(cat => {
        const count = categoryCounts[cat];
        if (!count) return null;
        const meta = CATEGORY_META[cat];
        const isActive = activeCategory === cat;
        return (
          <button
            key={cat}
            onClick={() => onToggle(isActive ? null : cat)}
            className={`px-3 py-1.5 rounded-full border font-semibold transition-colors ${
              isActive ? meta.color + ' ring-2 ring-offset-1' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {meta.emoji} {meta.label} ({count})
          </button>
        );
      })}
    </div>
  );
}

// ─── 접이식 위험 카드 ───

function DangerItemCard({
  danger,
  isExpanded,
  onToggle,
  onScrollToLine,
}: {
  danger: DangerItem;
  isExpanded: boolean;
  onToggle: () => void;
  onScrollToLine?: (line: number) => void;
}) {
  const style = LEVEL_STYLE[danger.level];

  return (
    <div className={`border rounded-xl overflow-hidden ${style.border} ${style.bg}`}>
      {/* 헤더 (항상 표시) */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{danger.emoji}</span>
          <span className="font-bold text-gray-800 text-sm truncate">{danger.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {danger.lines.length > 0 && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              📍 {danger.lines.slice(0, 3).map(l => (
                <span
                  key={l}
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); onScrollToLine?.(l); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onScrollToLine?.(l); } }}
                  className="text-blue-600 hover:underline hover:text-blue-800 cursor-pointer"
                >
                  {l}줄
                </span>
              ))}
              {danger.lines.length > 3 && ` 외 ${danger.lines.length - 3}개`}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${style.badge}`}>
            {style.label}
          </span>
          <span className="text-gray-400 text-sm">{isExpanded ? '▾' : '▸'}</span>
        </div>
      </button>

      {/* 본문 (확장 시만) */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-black/5">
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-500">왜?</span> {danger.description}
          </p>
          <p className="text-sm text-green-700 bg-white/60 rounded-lg px-3 py-2">
            <span className="font-semibold">💡 해결:</span> {danger.solution}
          </p>

          {danger.codeExample && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                <p className="font-bold text-red-600 mb-1.5">❌ Before</p>
                <pre className="whitespace-pre-wrap font-mono text-red-800 leading-relaxed">{danger.codeExample.bad}</pre>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                <p className="font-bold text-green-600 mb-1.5">✅ After</p>
                <pre className="whitespace-pre-wrap font-mono text-green-800 leading-relaxed">{danger.codeExample.good}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ───

const LEVEL_ORDER: Record<DangerLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export default function DangerCard({
  dangers,
  onScrollToLine,
}: {
  dangers: DangerItem[];
  onScrollToLine?: (line: number) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<DangerCategory | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredDangers = useMemo(() => {
    const filtered = activeCategory
      ? dangers.filter(d => d.category === activeCategory)
      : dangers;
    return [...filtered].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  }, [dangers, activeCategory]);

  if (dangers.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-3">✅</div>
        <p className="text-lg font-bold text-green-700">위험 신호 없음!</p>
        <p className="text-sm text-gray-500 mt-1">이 파일에서 초보자 위험 패턴이 감지되지 않았어요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DangerSummary dangers={dangers} />
      <CategoryFilterPills
        dangers={dangers}
        activeCategory={activeCategory}
        onToggle={setActiveCategory}
      />

      <div className="space-y-2">
        {filteredDangers.map(d => (
          <DangerItemCard
            key={d.id}
            danger={d}
            isExpanded={expandedId === d.id}
            onToggle={() => setExpandedId(expandedId === d.id ? null : d.id)}
            onScrollToLine={onScrollToLine}
          />
        ))}
      </div>

      <div className="text-xs text-gray-400 border-t pt-3">
        ⚠️ 이 감지는 정적 분석 기반으로, 실제 동작에 따라 위험하지 않을 수 있습니다.
      </div>
    </div>
  );
}
