'use client';

import type { FunctionItem } from '@/lib/parser';

export default function FunctionList({ functions }: { functions: FunctionItem[] }) {
  const utilFns = functions.filter(f => !f.isComponent);
  const componentFns = functions.filter(f => f.isComponent);

  if (functions.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-4">함수가 없습니다.</p>;
  }

  const Row = ({ fn }: { fn: FunctionItem }) => (
    <div className="flex items-start gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
      <div className="text-xl">{fn.isComponent ? '🧩' : fn.isAsync ? '⏳' : '🔧'}</div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <code className="font-mono font-bold text-gray-800 text-sm">{fn.name}</code>
          {fn.isAsync && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">async</span>}
          {fn.isComponent && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">컴포넌트</span>}
          <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">{fn.kind}</span>
          <span className="text-xs text-gray-400 ml-auto">{fn.startLine}–{fn.endLine}줄</span>
        </div>
        {fn.params.length > 0 && (
          <div className="mt-1 text-xs text-gray-500">
            매개변수: {fn.params.map((p, i) => (
              <code key={i} className="bg-white border px-1 rounded mx-0.5">{p}</code>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {componentFns.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">🧩 컴포넌트 함수</h4>
          <div className="space-y-1">{componentFns.map((fn, i) => <Row key={i} fn={fn} />)}</div>
        </div>
      )}
      {utilFns.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">🔧 유틸리티 함수</h4>
          <div className="space-y-1">{utilFns.map((fn, i) => <Row key={i} fn={fn} />)}</div>
        </div>
      )}
      <div className="text-xs text-gray-400 border-t pt-2">
        💡 <strong>초보자 팁:</strong> async 함수는 데이터를 서버에서 가져올 때, 이벤트 핸들러는 사용자 동작을 처리할 때 쓰입니다.
      </div>
    </div>
  );
}
