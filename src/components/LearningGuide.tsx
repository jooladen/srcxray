'use client';

import { useState } from 'react';
import type { LearningSection } from '@/lib/parser';

function TimeBar({ minutes, total }: { minutes: number; total: number }) {
  const pct = Math.round((minutes / total) * 100);
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0">~{minutes}분</span>
    </div>
  );
}

export default function LearningGuide({ sections }: { sections: LearningSection[] }) {
  const totalMinutes = sections.reduce((s, sec) => s + sec.minutes, 0);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggle = (i: number) => setChecked(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const allDone = sections.length > 0 && checked.size === sections.length;
  const progressPct = sections.length ? (checked.size / sections.length) * 100 : 0;

  if (sections.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-4">코드를 분석하면 학습 가이드가 생성됩니다.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">⏱️ 10분 학습 플랜</h3>
            <p className="text-blue-100 text-sm mt-0.5">순서대로 읽으면 전체 코드를 이해할 수 있어요</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{totalMinutes}</div>
            <div className="text-blue-200 text-xs">분 예상</div>
          </div>
        </div>
      </div>

      {/* Progress tracker */}
      <div className="flex gap-1">
        {sections.map((_, i) => (
          <div key={i} className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: checked.has(i) ? '100%' : '0%',
                backgroundColor: '#60a5fa',
              }}
            />
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-1.5 bg-blue-400 rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Completion banner */}
      {allDone && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl p-4 text-center">
          <div className="text-2xl mb-1">🎉</div>
          <p className="font-bold">와! 이 파일 완전히 파악했어요!</p>
          <p className="text-sm text-green-100">개발자 맞죠? 다음 파일도 분석해보세요!</p>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-3">
        {sections.map((sec, i) => (
          <div
            key={i}
            onClick={() => toggle(i)}
            className={`border rounded-xl p-4 cursor-pointer transition-all select-none
              ${checked.has(i)
                ? 'border-green-400 bg-green-50 shadow-sm'
                : 'border-gray-200 hover:border-blue-300 hover:shadow-sm bg-white'
              }`}
          >
            <div className="flex items-start gap-3">
              {/* Step number / check */}
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                ${checked.has(i)
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-600 text-white'
                }`}
              >
                {checked.has(i) ? '✓' : sec.order}
              </div>
              <div className="flex-1 min-w-0">
                {/* Title */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl">{sec.emoji}</span>
                  <h4 className={`font-bold ${checked.has(i) ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                    {sec.title}
                  </h4>
                  {sec.lineHint && (
                    <code className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ml-auto">
                      📍 {sec.lineHint}
                    </code>
                  )}
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mt-1">{sec.description}</p>

                {/* Items */}
                <ul className="mt-2 space-y-1">
                  {sec.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-400 mt-0.5 shrink-0">▸</span>
                      <span className="text-gray-700 font-mono text-xs leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Time bar */}
                <TimeBar minutes={sec.minutes} total={totalMinutes} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
        <strong>💡 초보자를 위한 조언:</strong> 처음엔 전체를 이해하려 하지 말고, 각 섹션을 &quot;아, 이런 게 있구나&quot; 수준으로만 읽어도 충분합니다. 두 번째 읽을 때 더 잘 보입니다!
      </div>
    </div>
  );
}
