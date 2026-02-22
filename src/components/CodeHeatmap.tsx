'use client';

import { useMemo, useState } from 'react';
import { computeLineComplexity, getLineScoreWithReasons } from '@/lib/complexity';

interface Props {
  code: string;
}

export default function CodeHeatmap({ code }: Props) {
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);

  const scores = useMemo(() => computeLineComplexity(code), [code]);
  const lines  = code.split('\n');

  const maxScore = Math.max(...scores, 1);

  // Stats
  const simple   = scores.filter(s => s > 0 && s <= 2).length;
  const moderate = scores.filter(s => s > 2 && s <= 5).length;
  const complex  = scores.filter(s => s > 5 && s <= 9).length;
  const vcomplex = scores.filter(s => s > 9).length;

  return (
    <div className="space-y-4">
      {/* Legend + stats */}
      <div className="flex flex-wrap gap-2 items-center text-xs">
        <span className="font-semibold text-gray-600 mr-1">복잡도:</span>
        {[
          { label: `단순 (${simple}줄)`,      bg: 'bg-green-100',  border: 'border-green-400'  },
          { label: `보통 (${moderate}줄)`,    bg: 'bg-yellow-100', border: 'border-yellow-400' },
          { label: `복잡 (${complex}줄)`,     bg: 'bg-orange-100', border: 'border-orange-400' },
          { label: `매우복잡 (${vcomplex}줄)`,bg: 'bg-red-100',    border: 'border-red-400'    },
        ].map((item, i) => (
          <span key={i} className={`flex items-center gap-1 px-2 py-0.5 rounded border ${item.bg} ${item.border}`}>
            <span className={`inline-block w-2 h-2 rounded-sm border ${item.border} ${item.bg}`} />
            {item.label}
          </span>
        ))}
      </div>

      {/* Code viewer */}
      <div className="border rounded-xl overflow-hidden bg-gray-950">
        <div className="max-h-[500px] overflow-y-auto">
          {lines.map((line, i) => {
            const score = scores[i] ?? 0;
            const ls    = getLineScoreWithReasons(score, line);
            const lineNum = i + 1;
            const isHovered = hoveredLine === lineNum;

            return (
              <div
                key={i}
                className={`flex items-stretch text-xs font-mono group cursor-default transition-colors relative ${isHovered ? 'bg-gray-800' : ''}`}
                onMouseEnter={() => setHoveredLine(lineNum)}
                onMouseLeave={() => setHoveredLine(null)}
              >
                {/* Complexity bar */}
                <div
                  className="w-1 shrink-0"
                  style={{ backgroundColor: ls.borderColor }}
                />

                {/* Line number */}
                <div className="w-10 shrink-0 text-right text-gray-600 select-none px-2 py-0.5 border-r border-gray-800">
                  {lineNum}
                </div>

                {/* Score bar (mini) */}
                <div className="w-12 shrink-0 flex items-center px-1 border-r border-gray-800">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${Math.min(100, (score / maxScore) * 100)}%`,
                      backgroundColor: ls.borderColor,
                      minWidth: score > 0 ? '3px' : '0',
                    }}
                  />
                </div>

                {/* Code */}
                <pre className="flex-1 px-3 py-0.5 text-gray-300 overflow-x-auto whitespace-pre">
                  {line || ' '}
                </pre>

                {/* Tooltip */}
                {isHovered && score > 2 && (
                  <div className="absolute right-0 top-full z-20 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-xs whitespace-normal border border-gray-700 mt-0.5">
                    <div className="font-bold mb-1" style={{ color: ls.borderColor }}>
                      {ls.label} ({score}점)
                    </div>
                    {ls.reasons.length > 0
                      ? ls.reasons.map((r, ri) => (
                          <div key={ri} className="opacity-80">• {r}</div>
                        ))
                      : <div className="opacity-60">들여쓰기가 깊어요</div>
                    }
                  </div>
                )}
                {isHovered && score > 0 && score <= 2 && (
                  <div className="shrink-0 flex items-center px-2 text-gray-500 text-xs border-l border-gray-800">
                    {ls.label} ({score}점)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-gray-400">
        💡 <strong>빨간 줄</strong>이 가장 복잡한 부분입니다. 처음엔 초록 줄부터 읽고, 빨간 줄은 마지막에 분석하세요.
      </div>
    </div>
  );
}
