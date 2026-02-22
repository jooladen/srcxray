'use client';

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
          <div key={i} className="flex-1 h-1.5 bg-gray-200 rounded-full">
            <div className="h-1.5 bg-blue-400 rounded-full w-0" />
          </div>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map((sec, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all bg-white">
            <div className="flex items-start gap-3">
              {/* Step number */}
              <div className="shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                {sec.order}
              </div>
              <div className="flex-1 min-w-0">
                {/* Title */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl">{sec.emoji}</span>
                  <h4 className="font-bold text-gray-800">{sec.title}</h4>
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
