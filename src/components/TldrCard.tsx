'use client';

import { useState } from 'react';
import type { FileTldr } from '@/lib/tldr';
import type { AnalysisResult } from '@/lib/parser';
import { generateMarkdownReport } from '@/lib/report-text';

const BADGE_COLORS: Record<string, string> = {
  blue:   'bg-blue-100/30 text-white border border-blue-300/30',
  purple: 'bg-purple-100/30 text-white border border-purple-300/30',
  orange: 'bg-orange-100/30 text-white border border-orange-300/30',
  green:  'bg-green-100/30 text-white border border-green-300/30',
  gray:   'bg-white/10 text-white/80 border border-white/20',
};

interface Props {
  tldr: FileTldr;
  result: AnalysisResult;
  fileName: string;
}

export default function TldrCard({ tldr, result, fileName }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = generateMarkdownReport(result, tldr, fileName);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="animate-fadeIn bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Label */}
          <div className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-1">
            📋 이 파일이 하는 일
          </div>

          {/* Summary */}
          <p className="text-lg font-bold leading-snug mb-3">
            &ldquo;{tldr.summary}&rdquo;
          </p>

          {/* Role chips */}
          {tldr.role.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tldr.role.map((r, i) => (
                <span key={i} className="text-xs bg-white/15 px-2.5 py-1 rounded-full font-medium">
                  {r}
                </span>
              ))}
            </div>
          )}

          {/* Stat badges */}
          <div className="flex flex-wrap gap-2">
            {tldr.badges.map((b, i) => (
              <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${BADGE_COLORS[b.color]}`}>
                {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* Copy button (F-05) */}
        <button
          onClick={handleCopy}
          className="shrink-0 flex flex-col items-center gap-1 bg-white/15 hover:bg-white/25 transition-colors rounded-xl px-3 py-2 text-white"
          title="분석 결과를 마크다운으로 복사"
        >
          <span className="text-xl">{copied ? '✅' : '📋'}</span>
          <span className="text-xs font-medium">{copied ? '복사됨!' : '복사'}</span>
        </button>
      </div>
    </div>
  );
}
