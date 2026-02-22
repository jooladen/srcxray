'use client';

import type { DangerItem } from '@/lib/danger-detector';

const LEVEL_STYLE = {
  high:   { bg: 'bg-red-50 border-red-300',    badge: 'bg-red-100 text-red-700',    label: '🔴 높음' },
  medium: { bg: 'bg-yellow-50 border-yellow-300', badge: 'bg-yellow-100 text-yellow-700', label: '🟡 중간' },
  low:    { bg: 'bg-blue-50 border-blue-300',  badge: 'bg-blue-100 text-blue-700',  label: '🔵 낮음' },
};

export default function DangerCard({ dangers }: { dangers: DangerItem[] }) {
  if (dangers.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-3">✅</div>
        <p className="text-lg font-bold text-green-700">위험 신호 없음!</p>
        <p className="text-sm text-gray-500 mt-1">이 파일에서 초보자 위험 패턴이 감지되지 않았어요.</p>
      </div>
    );
  }

  const high   = dangers.filter(d => d.level === 'high');
  const medium = dangers.filter(d => d.level === 'medium');
  const low    = dangers.filter(d => d.level === 'low');

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        총 <strong>{dangers.length}개</strong>의 주의 패턴을 발견했어요.
        {high.length > 0 && <span className="text-red-600 font-semibold ml-1">🔴 즉시 확인 필요 {high.length}개</span>}
      </p>

      <div className="space-y-3">
        {[...high, ...medium, ...low].map((d, i) => {
          const style = LEVEL_STYLE[d.level];
          return (
            <div key={i} className={`border rounded-xl p-4 ${style.bg}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{d.emoji}</span>
                  <span className="font-bold text-gray-800 text-sm">{d.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {d.lines.length > 0 && (
                    <span className="text-xs text-gray-500">
                      📍 {d.lines.slice(0, 3).map(l => `${l}줄`).join(', ')}
                      {d.lines.length > 3 && ` 외 ${d.lines.length - 3}개`}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${style.badge}`}>
                    {style.label}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 ml-8">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold text-gray-500">왜?</span> {d.description}
                </p>
                <p className="text-sm text-green-700 bg-white/60 rounded-lg px-2.5 py-1.5">
                  <span className="font-semibold">💡 해결:</span> {d.solution}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-gray-400 border-t pt-3">
        ⚠️ 이 감지는 정적 분석 기반으로, 실제 동작에 따라 위험하지 않을 수 있습니다.
      </div>
    </div>
  );
}
