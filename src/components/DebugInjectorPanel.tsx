'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { AnalysisResult } from '@/lib/parser';
import type { InjectionBreakdown, ExecutionStep } from '@/lib/debug-injector';
import type { UiElement, ChildComponentInfo } from '@/lib/ui-map-extractor';

interface Props {
  code: string;
  result: AnalysisResult;
  fileName: string;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;
type ViewMode = 'express' | 'wizard';

interface WizardState {
  ready: boolean;
  mode: ViewMode;
  step: WizardStep;
  injecting: boolean;
  animatedCount: number;
  injectedSource: string;
  breakdown: InjectionBreakdown | null;
  totalCount: number;
  execSteps: ExecutionStep[];
  uiElements: UiElement[];
  childComponents: ChildComponentInfo[];
  copied: boolean;
  csvDownloaded: boolean;
}

const INITIAL: WizardState = {
  ready: false,
  mode: 'express',
  step: 1,
  injecting: false,
  animatedCount: 0,
  injectedSource: '',
  breakdown: null,
  totalCount: 0,
  execSteps: [],
  uiElements: [],
  childComponents: [],
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

// ── 마커 패턴 ──────────────────────────────────────────────
const MARKER_START = '// @@SRCXRAY-START';
const MARKER_END   = '// @@SRCXRAY-END';
const MARKER_EXPR  = '@@SRCXRAY-EXPR-BODY-';

// ── 접이식 섹션 ──────────────────────────────────────────────
function Collapsible({ title, badge, children, defaultOpen = false }: {
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold
          text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>
            ▸
          </span>
          {title}
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">
              {badge}
            </span>
          )}
        </span>
      </button>
      {open && <div className="px-4 py-3 border-t border-gray-200">{children}</div>}
    </div>
  );
}

// ── 코드 미리보기 ──────────────────────────────────────────────
function CodePreview({ source, onCopy, copied }: {
  source: string;
  onCopy: () => void;
  copied: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstHighlightRef = useRef<HTMLDivElement>(null);

  // 줄 분석: 마커 제거 + 주입 줄 하이라이트 정보
  const lines = useMemo(() => {
    const raw = source.split('\n');
    const result: Array<{ text: string; highlighted: boolean; lineNum: number }> = [];
    let insideBlock = false;
    let displayLineNum = 0;

    for (const line of raw) {
      // 마커 주석 줄은 숨김
      if (line.includes(MARKER_START) || line.includes(MARKER_END)) {
        insideBlock = line.includes(MARKER_START);
        continue;
      }
      // EXPR-BODY 변환 마커가 포함된 줄은 마커 부분만 제거하고 표시
      if (line.includes(MARKER_EXPR)) {
        displayLineNum++;
        result.push({
          text: line.replace(/\s*\/\/\s*@@SRCXRAY-EXPR-BODY-\w+/g, ''),
          highlighted: false,
          lineNum: displayLineNum,
        });
        continue;
      }

      displayLineNum++;
      result.push({
        text: line,
        highlighted: insideBlock,
        lineNum: displayLineNum,
      });
      if (insideBlock) insideBlock = false;
    }
    return result;
  }, [source]);

  // 첫 하이라이트 줄로 자동 스크롤
  useEffect(() => {
    const timer = setTimeout(() => {
      if (firstHighlightRef.current && scrollRef.current) {
        const container = scrollRef.current;
        const el = firstHighlightRef.current;
        const offset = el.offsetTop - container.offsetTop - 60;
        container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const lineNumWidth = String(lines.length).length;
  let firstHighlightAssigned = false;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-900">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-400 font-mono">주입된 코드 미리보기</span>
        <button
          onClick={onCopy}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            copied
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-500'
          }`}
        >
          {copied ? '✅ 복사됨' : '📋 전체 복사'}
        </button>
      </div>
      {/* 코드 영역 */}
      <div ref={scrollRef} className="overflow-auto max-h-[400px] text-xs leading-5">
        <div className="min-w-max">
          {lines.map((line, i) => {
            let ref: React.Ref<HTMLDivElement> | undefined;
            if (line.highlighted && !firstHighlightAssigned) {
              ref = firstHighlightRef;
              firstHighlightAssigned = true;
            }
            return (
              <div
                key={i}
                ref={ref}
                className={`flex ${
                  line.highlighted
                    ? 'bg-green-900/40 border-l-2 border-green-400'
                    : 'border-l-2 border-transparent'
                }`}
              >
                <span className="select-none text-gray-500 text-right px-3 py-0 shrink-0 font-mono"
                  style={{ minWidth: `${lineNumWidth + 2}ch` }}>
                  {line.lineNum}
                </span>
                <pre className="text-gray-200 font-mono whitespace-pre pr-4 py-0">
                  {line.text}
                </pre>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
      const [{ injectLogs, predictExecutionOrder }, { extractUiMap }] = await Promise.all([
        import('@/lib/debug-injector'),
        import('@/lib/ui-map-extractor'),
      ]);
      const injResult = injectLogs(code, result, fileName);
      const execSteps = predictExecutionOrder(result);
      const { elements: uiElements, childComponents } = extractUiMap(code, result);
      if (!cancelled) {
        setState((s) => ({
          ...s,
          ready: true,
          injectedSource: injResult.injectedSource,
          breakdown: injResult.breakdown,
          totalCount: injResult.totalCount,
          execSteps,
          uiElements,
          childComponents,
        }));
      }
    })();
    return () => { cancelled = true; };
  }, [code, result, fileName]);

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
    setState((s) => ({ ...s, mode: 'wizard', step: 2, injecting: true, animatedCount: 0 }));
  }, []);

  const goExpress = useCallback(() => {
    setState((s) => ({ ...s, mode: 'express' }));
  }, []);

  const goWizard = useCallback(() => {
    setState((s) => ({ ...s, mode: 'wizard', step: 1 }));
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
    const { generateFullMapCsv, downloadCsv } = await import('@/lib/ui-map-extractor');
    const csv = generateFullMapCsv(state.uiElements, result, state.childComponents);
    const base = fileName.replace(/\.tsx?$/, '') || 'component';
    downloadCsv(csv, `${base}.interaction-map.csv`);
    setState((s) => ({ ...s, csvDownloaded: true }));
  }, [state.uiElements, state.childComponents, result, fileName]);

  const handleReset = useCallback(() => {
    setState((s) => ({
      ...s,
      mode: 'express',
      step: 1,
      injecting: false,
      animatedCount: 0,
      copied: false,
      csvDownloaded: false,
    }));
  }, []);

  if (result.components.length === 0 || !state.ready) return null;

  const { mode, step, breakdown, totalCount, animatedCount, injecting, execSteps, uiElements, copied } = state;
  const mountSteps  = execSteps.filter((s) => s.phase === 'mount');
  const updateSteps = execSteps.filter((s) => s.phase === 'update');

  // ── Express 모드 ───────────────────────────────────────────
  if (mode === 'express' && breakdown) {
    return (
      <div className="border-2 border-blue-400 rounded-2xl bg-blue-50 p-5">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            <span>⚡</span> 로그 주입 완료!
            <span className="text-blue-600">{totalCount}개</span> 위치
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {BREAKDOWN_ITEMS.map(({ key, emoji, label, bg }) =>
              breakdown[key] > 0 ? (
                <span key={key} className={`text-xs px-2 py-0.5 rounded-full border ${bg}`}>
                  {emoji} {label} {breakdown[key]}
                </span>
              ) : null,
            )}
          </div>
        </div>

        {/* 코드 미리보기 */}
        <div className="mb-4">
          <CodePreview
            source={state.injectedSource}
            onCopy={handleCopy}
            copied={copied}
          />
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={handleCopy}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              copied
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {copied ? '✅ 복사됨!' : '📋 전체 복사'}
          </button>
          <button
            onClick={handleDownloadOriginal}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700
              border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            💾 원본 백업
          </button>
          <button
            onClick={handleDownloadCsv}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              state.csvDownloaded
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {state.csvDownloaded ? '✅ CSV 완료' : '📊 인터랙션 맵 CSV'}
          </button>
        </div>

        {/* 사용 가이드 */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3">
          <div className="text-xs font-semibold text-gray-500 mb-2">이렇게 사용하세요</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {USE_GUIDE.map((guide, i) => (
              <span key={i} className="text-xs text-gray-500">
                <span className="font-bold text-gray-400">{i + 1}.</span> {guide}
              </span>
            ))}
          </div>
        </div>

        {/* 접이식: 실행순서 */}
        <div className="space-y-2 mb-4">
          <Collapsible title="실행순서 예측" badge={`${execSteps.length}단계`}>
            {mountSteps.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-gray-400 mb-2">── Mount 단계</div>
                <div className="space-y-1">
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
              <div>
                <div className="text-xs font-semibold text-gray-400 mb-2">── 상태 변경 후</div>
                <div className="space-y-1">
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
          </Collapsible>

          {/* 접이식: 인터랙션 맵 */}
          <Collapsible title="화면 인터랙션 맵" badge={`UI ${uiElements.length} · 컴포넌트 ${state.childComponents.length}`}>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-600">
                📊 상태 {result.hooks.filter(h => h.name === 'useState').length}개
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600">
                🔁 이펙트 {result.hooks.filter(h => h.name === 'useEffect').length}개
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600">
                🎯 UI {uiElements.length}개
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-600">
                🧩 컴포넌트 {state.childComponents.length}개
              </span>
            </div>
            <button
              onClick={handleDownloadCsv}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                state.csvDownloaded
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {state.csvDownloaded ? '✅ 다운로드 완료' : '⬇ CSV 다운로드'}
            </button>
          </Collapsible>
        </div>

        {/* 하단 */}
        <div className="flex justify-between items-center">
          <button
            onClick={handleReset}
            className="px-3 py-2 rounded-lg border border-blue-300 text-blue-600 text-sm
              hover:bg-blue-100 transition-colors"
          >
            ↩ 처음으로
          </button>
          <button
            onClick={goWizard}
            className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700
              hover:bg-white transition-colors"
          >
            🔍 단계별로 자세히 보기
          </button>
        </div>
      </div>
    );
  }

  // ── Wizard 모드 (기존) ───────────────────────────────────────
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

          <div className="flex justify-end gap-2">
            <button
              onClick={startInject}
              className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-600 text-sm
                hover:bg-gray-50 transition-colors"
            >
              단계별 보기 →
            </button>
            <button
              onClick={goExpress}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm
                hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
            >
              ⚡ 바로 결과 보기
            </button>
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

          {/* 전체 인터랙션 맵 CSV */}
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 mb-4">
            <h4 className="font-bold text-gray-700 text-sm mb-1 flex items-center gap-2">
              <span>📊</span> 화면 인터랙션 맵
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              상태 모델 + UI 인터랙션 + 자식 컴포넌트 데이터 흐름을 엑셀 CSV로 내보내기
            </p>

            {/* 맵 요약 뱃지 */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-600">
                📊 상태 {result.hooks.filter(h => h.name === 'useState').length}개
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600">
                🔁 이펙트 {result.hooks.filter(h => h.name === 'useEffect').length}개
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600">
                🎯 UI {uiElements.length}개
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-600">
                🧩 컴포넌트 {state.childComponents.length}개
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadCsv}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  state.csvDownloaded
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {state.csvDownloaded ? '✅ 다운로드 완료' : `⬇ 인터랙션 맵 CSV`}
              </button>
              <button
                onClick={handleDownloadOriginal}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-gray-700
                  border border-gray-300 hover:bg-gray-100 transition-colors"
              >
                💾 원본 백업
              </button>
            </div>
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
