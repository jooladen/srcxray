'use client';

import { useState, useCallback, useEffect } from 'react';
import type { AnalysisResult } from '@/lib/parser';
import type { InjectionBreakdown, ExecutionStep } from '@/lib/debug-injector';
import type { UiElement } from '@/lib/ui-map-extractor';

interface Props {
  code: string;
  result: AnalysisResult;
  fileName: string;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface WizardState {
  ready: boolean;
  step: WizardStep;
  injecting: boolean;
  animatedCount: number;
  injectedSource: string;
  breakdown: InjectionBreakdown | null;
  totalCount: number;
  execSteps: ExecutionStep[];
  uiElements: UiElement[];
  copied: boolean;
  csvDownloaded: boolean;
}

const INITIAL: WizardState = {
  ready: false,
  step: 1,
  injecting: false,
  animatedCount: 0,
  injectedSource: '',
  breakdown: null,
  totalCount: 0,
  execSteps: [],
  uiElements: [],
  copied: false,
  csvDownloaded: false,
};

const NUM_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

const USE_GUIDE = [
  'VSCode에서 원본 파일 열기',
  'Ctrl+A → Ctrl+V  (주입된 코드 붙여넣기)',
  'npm run dev 실행',
  'F12 → Console 탭 열기',
  '컴포넌트 사용해보기 → [L:숫자] 로그 확인 🎉',
];

const BREAKDOWN_ITEMS: Array<{
  key: keyof InjectionBreakdown;
  emoji: string;
  label: string;
  bg: string;
}> = [
  { key: 'props',   emoji: '🧩', label: 'props',  bg: 'bg-blue-50 border-blue-200 text-blue-700' },
  { key: 'state',   emoji: '⚡', label: 'state',  bg: 'bg-purple-50 border-purple-200 text-purple-700' },
  { key: 'effect',  emoji: '🔁', label: 'effect', bg: 'bg-orange-50 border-orange-200 text-orange-700' },
  { key: 'handler', emoji: '🔧', label: 'fn',     bg: 'bg-green-50 border-green-200 text-green-700' },
  { key: 'render',  emoji: '🖼', label: 'render', bg: 'bg-pink-50 border-pink-200 text-pink-700' },
];

// ── 진행 도트 ──────────────────────────────────────────────
function WizardProgress({ step }: { step: WizardStep }) {
  return (
    <div className="flex items-center mb-5">
      {([1, 2, 3, 4, 5] as WizardStep[]).map((n, i) => (
        <div key={n} className="flex items-center flex-1 last:flex-none">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
              transition-all duration-300 shrink-0 ${
              n < step
                ? 'bg-blue-600 text-white'
                : n === step
                ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                : 'bg-gray-200 text-gray-400'
            }`}
          >
            {n < step ? '✓' : n}
          </div>
          {i < 4 && (
            <div
              className={`h-0.5 flex-1 mx-1 transition-all duration-500 ${
                n < step ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── 뒤로 / 다음 공통 버튼 ──────────────────────────────────
function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm
        hover:bg-gray-50 transition-colors"
    >
      ← 뒤로
    </button>
  );
}

function NextBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm
        hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
    >
      {label}
    </button>
  );
}

// ── 메인 컴포넌트 ───────────────────────────────────────────
export default function DebugInjectorPanel({ code, result, fileName }: Props) {
  const [state, setState] = useState<WizardState>(INITIAL);

  // ① 마운트 시 모든 계산 미리 수행
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ injectLogs, predictExecutionOrder }, { extractUiElements }] = await Promise.all([
        import('@/lib/debug-injector'),
        import('@/lib/ui-map-extractor'),
      ]);
      const injResult = injectLogs(code, result);
      const execSteps = predictExecutionOrder(result);
      const uiElements = extractUiElements(code, result);
      if (!cancelled) {
        setState((s) => ({
          ...s,
          ready: true,
          injectedSource: injResult.injectedSource,
          breakdown: injResult.breakdown,
          totalCount: injResult.totalCount,
          execSteps,
          uiElements,
        }));
      }
    })();
    return () => { cancelled = true; };
  }, [code, result]);

  // ② Step 2 카운트업 애니메이션
  useEffect(() => {
    if (state.step !== 2 || !state.injecting) return;
    const target = state.totalCount;
    const duration = 700;
    const start = performance.now();
    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setState((s) => ({ ...s, animatedCount: Math.round(eased * target) }));
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        setState((s) => ({ ...s, injecting: false, animatedCount: target }));
      }
    };
    requestAnimationFrame(tick);
    return () => { cancelled = true; };
  }, [state.step, state.injecting, state.totalCount]);

  const goTo = useCallback((step: WizardStep) => setState((s) => ({ ...s, step })), []);

  const startInject = useCallback(() => {
    setState((s) => ({ ...s, step: 2, injecting: true, animatedCount: 0 }));
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(state.injectedSource);
      setState((s) => ({ ...s, copied: true }));
      setTimeout(() => setState((s) => ({ ...s, copied: false })), 2000);
    } catch { /* silent */ }
  }, [state.injectedSource]);

  const handleDownloadOriginal = useCallback(() => {
    const base = fileName.replace(/\.tsx?$/, '') || 'component';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}.original.tsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, fileName]);

  const handleDownloadCsv = useCallback(async () => {
    const { generateCsv, downloadCsv } = await import('@/lib/ui-map-extractor');
    const csv = generateCsv(state.uiElements);
    const base = fileName.replace(/\.tsx?$/, '') || 'component';
    downloadCsv(csv, `${base}.ui-map.csv`);
    setState((s) => ({ ...s, csvDownloaded: true }));
  }, [state.uiElements, fileName]);

  const handleReset = useCallback(() => {
    setState((s) => ({
      ...s,
      step: 1,
      injecting: false,
      animatedCount: 0,
      copied: false,
      csvDownloaded: false,
    }));
  }, []);

  if (result.components.length === 0 || !state.ready) return null;

  const { step, breakdown, totalCount, animatedCount, injecting, execSteps, uiElements, copied } = state;
  const mountSteps  = execSteps.filter((s) => s.phase === 'mount');
  const updateSteps = execSteps.filter((s) => s.phase === 'update');

  const containerCls =
    step === 1
      ? 'border border-gray-200 rounded-2xl bg-white p-5'
      : 'border-2 border-blue-400 rounded-2xl bg-blue-50 p-5';

  return (
    <div className={containerCls}>
      <WizardProgress step={step} />

      {/* ── Step 1: 준비 완료 ── */}
      {step === 1 && breakdown && (
        <div>
          <h3 className="font-bold text-gray-800 text-base mb-1 flex items-center gap-2">
            <span>🎉</span> 분석 완료!
          </h3>
          <p className="text-gray-500 text-sm mb-4">
            총{' '}
            <span className="font-bold text-blue-600">{totalCount}개</span>{' '}
            위치에 Log를 넣을 수 있어요
          </p>

          <div className="grid grid-cols-5 gap-2 mb-5">
            {BREAKDOWN_ITEMS.map(({ key, emoji, label, bg }) =>
              breakdown[key] > 0 ? (
                <div key={key} className={`border rounded-xl p-3 text-center ${bg}`}>
                  <div className="text-xl mb-1">{emoji}</div>
                  <div className="text-lg font-black">{breakdown[key]}</div>
                  <div className="text-xs opacity-70">{label}</div>
                </div>
              ) : null,
            )}
          </div>

          <div className="flex justify-end">
            <NextBtn onClick={startInject} label="다음: Log 주입하기 →" />
          </div>
        </div>
      )}

      {/* ── Step 2: 주입 ── */}
      {step === 2 && breakdown && (
        <div>
          <h3 className="font-bold text-gray-800 text-base mb-4 flex items-center gap-2">
            <span>{injecting ? '🔧' : '✅'}</span>
            {injecting ? 'Log 주입 중...' : `${totalCount}개 위치에 주입 완료!`}
          </h3>

          {/* 프로그레스 바 */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 bg-blue-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-100"
                style={{
                  width: `${totalCount > 0 ? Math.round((animatedCount / totalCount) * 100) : 0}%`,
                }}
              />
            </div>
            <span className="text-blue-700 font-mono font-bold text-sm min-w-[4.5rem] text-right">
              {animatedCount} / {totalCount}개
            </span>
          </div>

          {!injecting && (
            <div className="flex flex-wrap gap-2 mb-5">
              {BREAKDOWN_ITEMS.map(({ key, label, bg }) =>
                breakdown[key] > 0 ? (
                  <span key={key} className={`text-xs px-2.5 py-1 rounded-full border ${bg}`}>
                    {label} {breakdown[key]}
                  </span>
                ) : null,
              )}
            </div>
          )}

          <div className="flex justify-between">
            <BackBtn onClick={() => goTo(1)} />
            {!injecting && <NextBtn onClick={() => goTo(3)} label="다음: 실행순서 보기 →" />}
          </div>
        </div>
      )}

      {/* ── Step 3: 실행 순서 예측 ── */}
      {step === 3 && (
        <div>
          <h3 className="font-bold text-gray-800 text-base mb-4 flex items-center gap-2">
            <span>🔮</span> 이런 순서로 로그가 찍힐 거예요
          </h3>

          {mountSteps.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-400 mb-2 tracking-wide">
                ── Mount 단계 ───────────────────────
              </div>
              <div className="space-y-1.5">
                {mountSteps.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="shrink-0 leading-5">{NUM_EMOJI[i] ?? `${i + 1}.`}</span>
                    <span className="leading-5">
                      <span className="text-gray-400 font-mono text-xs">[L:{s.line}]</span>{' '}
                      {s.label}
                      {s.note && <span className="text-gray-400 text-xs ml-1">{s.note}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {updateSteps.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-400 mb-2 tracking-wide">
                ── 상태 변경 후 ────────────────────
              </div>
              <div className="space-y-1.5">
                {updateSteps.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="shrink-0 leading-5">
                      {NUM_EMOJI[mountSteps.length + i] ?? `${mountSteps.length + i + 1}.`}
                    </span>
                    <span className="leading-5">
                      {s.label}
                      {s.note && <span className="text-orange-500 text-xs ml-1">{s.note}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <BackBtn onClick={() => goTo(2)} />
            <NextBtn onClick={() => goTo(4)} label="다음: 코드 복사 →" />
          </div>
        </div>
      )}

      {/* ── Step 4: 복사 & 가이드 ── */}
      {step === 4 && (
        <div>
          <h3 className="font-bold text-gray-800 text-base mb-4 flex items-center gap-2">
            <span>📋</span> 주입된 코드를 복사하세요
          </h3>

          <div className="flex gap-2 mb-5">
            <button
              onClick={handleCopy}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                copied
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {copied ? '✅ 복사됨!' : '📋 코드 복사'}
            </button>
            <button
              onClick={handleDownloadOriginal}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700
                border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              💾 원본 백업
            </button>
          </div>

          <div className="border-t border-blue-200 pt-4">
            <h4 className="font-bold text-gray-700 text-sm mb-3">이렇게 하세요</h4>
            <div className="space-y-2">
              {USE_GUIDE.map((guide, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-gray-600">
                  <span className="shrink-0 font-bold text-gray-400 min-w-[4.5rem]">
                    Step {i + 1}.
                  </span>
                  <span>{guide}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between mt-5">
            <BackBtn onClick={() => goTo(3)} />
            <NextBtn onClick={() => goTo(5)} label="다음: CSV 내보내기 →" />
          </div>
        </div>
      )}

      {/* ── Step 5: 마무리 + CSV ── */}
      {step === 5 && breakdown && (
        <div>
          <h3 className="font-bold text-gray-800 text-xl mb-1 flex items-center gap-2">
            <span>🏆</span> 디버그 주입 완료! 🎊
          </h3>
          <p className="text-gray-500 text-sm mb-4">
            총 {totalCount}개 위치에 Log 주입 · 실행순서 {execSteps.length}단계 예측
          </p>

          {/* 주입 결과 요약 카드 */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            {BREAKDOWN_ITEMS.map(({ key, emoji, label, bg }) =>
              breakdown[key] > 0 ? (
                <div key={key} className={`border rounded-xl p-2 text-center ${bg}`}>
                  <div className="text-lg">{emoji}</div>
                  <div className="text-base font-black">{breakdown[key]}</div>
                  <div className="text-xs opacity-70">{label}</div>
                </div>
              ) : null,
            )}
          </div>

          {/* CSV 다운로드 (선택 사항) */}
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 mb-4">
            <h4 className="font-bold text-gray-700 text-sm mb-1 flex items-center gap-2">
              <span>📊</span> UI 요소 맵 (선택)
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              버튼·입력·링크의 위치와 핸들러를 엑셀 CSV로 내보내기
            </p>
            {uiElements.length > 0 ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadCsv}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    state.csvDownloaded
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {state.csvDownloaded ? '✅ 완료' : `⬇ CSV (${uiElements.length}개 요소)`}
                </button>
                <button
                  onClick={handleDownloadOriginal}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-gray-700
                    border border-gray-300 hover:bg-gray-100 transition-colors"
                >
                  💾 원본 백업
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400">이 파일에는 이벤트 요소가 없어요</p>
            )}
          </div>

          <div className="flex justify-between">
            <BackBtn onClick={() => goTo(4)} />
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg border border-blue-300 text-blue-600 text-sm
                hover:bg-blue-50 transition-colors"
            >
              ↩ 처음으로
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
