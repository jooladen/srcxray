'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { AnalysisResult } from '@/lib/parser';
import type { FileTldr } from '@/lib/tldr';
import type { DangerItem } from '@/lib/danger-detector';
import type { ConceptItem } from '@/lib/concept-finder';
import type { CodeInputHandle } from '@/components/CodeInput';
import { SAMPLES } from '@/lib/samples';
import { saveHistory, loadHistory, deleteHistory } from '@/lib/history';
import type { HistoryItem } from '@/lib/history';

import CodeInput from '@/components/CodeInput';
const TldrCard      = dynamic(() => import('@/components/TldrCard'),      { ssr: false });
const ImportMap     = dynamic(() => import('@/components/ImportMap'),     { ssr: false });
const ComponentTree = dynamic(() => import('@/components/ComponentTree'), { ssr: false });
const FunctionList  = dynamic(() => import('@/components/FunctionList'),  { ssr: false });
const LearningGuide = dynamic(() => import('@/components/LearningGuide'), { ssr: false });
const FlowDiagram   = dynamic(() => import('@/components/FlowDiagram'),   { ssr: false });
const CodeHeatmap   = dynamic(() => import('@/components/CodeHeatmap'),   { ssr: false });
const HookCards     = dynamic(() => import('@/components/HookCards'),     { ssr: false });
const DangerCard    = dynamic(() => import('@/components/DangerCard'),    { ssr: false });
const ConceptCards  = dynamic(() => import('@/components/ConceptCards'),  { ssr: false });
const HistoryPanel       = dynamic(() => import('@/components/HistoryPanel'),       { ssr: false });
const DebugInjectorPanel = dynamic(() => import('@/components/DebugInjectorPanel'), { ssr: false });

const COMPLEXITY_META = {
  simple:   { label: '단순',  color: 'bg-green-100 text-green-700',  desc: '금방 파악 가능' },
  moderate: { label: '중간',  color: 'bg-yellow-100 text-yellow-700', desc: '체계적으로 분석 필요' },
  complex:  { label: '복잡',  color: 'bg-red-100 text-red-700',      desc: '섹션별로 나눠서 분석' },
};

type TabKey = 'guide' | 'components' | 'flow' | 'imports' | 'functions' | 'heatmap' | 'hooks' | 'danger' | 'concepts';

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'guide',      label: '10분 가이드', emoji: '📚' },
  { key: 'danger',     label: '위험 신호',   emoji: '⚠️' },
  { key: 'concepts',   label: '필수 개념',   emoji: '📖' },
  { key: 'components', label: '컴포넌트',    emoji: '🧩' },
  { key: 'flow',       label: '데이터 흐름', emoji: '🌊' },
  { key: 'heatmap',    label: '복잡도 맵',   emoji: '🔥' },
  { key: 'hooks',      label: '훅 번역',     emoji: '⚡' },
  { key: 'imports',    label: 'Import 맵',   emoji: '📦' },
  { key: 'functions',  label: '함수 목록',   emoji: '🔧' },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

function getAchievement(seconds: number, lines: number): string {
  if (seconds < 180) return `🚀 ${formatTime(seconds)} 만에 ${lines}줄 분석! 천재인가요?`;
  if (seconds < 600) return `👏 ${formatTime(seconds)} — 목표 달성! 10분 안에 성공!`;
  return `💪 ${formatTime(seconds)} — 끝까지 완주! 다음엔 더 빠를 거예요!`;
}

function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (target === 0) {
      const id = requestAnimationFrame(() => { if (!cancelled) setValue(0); });
      return () => { cancelled = true; cancelAnimationFrame(id); };
    }
    const start = performance.now();
    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(Math.round(eased * target));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { cancelled = true; };
  }, [target, duration]);
  return value;
}

function AnimatedStat({ value, label, emoji, color }: { value: number; label: string; emoji: string; color: string }) {
  const animated = useCountUp(value);
  return (
    <div className={`border rounded-xl p-4 text-center ${color}`}>
      <div className="text-2xl">{emoji}</div>
      <div className="text-2xl font-black tabular-nums">{animated}</div>
      <div className="text-xs font-medium opacity-70">{label}</div>
    </div>
  );
}

export default function Home() {
  const [result,   setResult]   = useState<AnalysisResult | null>(null);
  const [tldr,     setTldr]     = useState<FileTldr | null>(null);
  const [code,     setCode]     = useState('');
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('guide');
  const [dangers,  setDangers]  = useState<DangerItem[]>([]);
  const [concepts, setConcepts] = useState<ConceptItem[]>([]);

  // F-06: Timer
  const [elapsed,      setElapsed]    = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [achievement,  setAchievement] = useState('');
  const [showReport,   setShowReport]  = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // F-17: 코드 줄 하이라이트
  const codeInputRef = useRef<CodeInputHandle>(null);
  const handleScrollToLine = useCallback((line: number) => {
    codeInputRef.current?.scrollToLine(line);
  }, []);

  // F-19: 히스토리
  const [history, setHistory] = useState<HistoryItem[]>([]);
  useEffect(() => { setHistory(loadHistory()); }, []);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const handleAnalyze = useCallback(async (inputCode: string, name: string) => {
    setIsLoading(true);
    setFileName(name);
    setCode(inputCode);
    setAchievement('');
    setElapsed(0);
    await new Promise(r => setTimeout(r, 50));

    const [{ analyzeCode }, { generateTldr }, { detectDangers }, { findConcepts }] = await Promise.all([
      import('@/lib/parser'),
      import('@/lib/tldr'),
      import('@/lib/danger-detector'),
      import('@/lib/concept-finder'),
    ]);

    const analysis = analyzeCode(inputCode);
    const fileTldr = generateTldr(analysis);
    const dangerItems  = detectDangers(inputCode, analysis);
    const conceptItems = findConcepts(inputCode, analysis);

    setResult(analysis);
    setTldr({ ...fileTldr, dangerCount: dangerItems.length });
    setDangers(dangerItems);
    setConcepts(conceptItems);
    const saved = saveHistory(name, inputCode);
    setHistory(saved);
    setActiveTab('guide');
    setTimerRunning(true);
    setIsLoading(false);
  }, []);

  const handleReset = useCallback(() => {
    setResult(null);
    setTldr(null);
    setDangers([]);
    setConcepts([]);
    setTimerRunning(false);
    setAchievement('');
    setElapsed(0);
    setShowReport(false);
  }, []);

  const handleDone = () => {
    setTimerRunning(false);
    if (result) {
      setAchievement(getAchievement(elapsed, result.totalLines));
      setShowReport(true);
    }
  };

  const complexity = result ? COMPLEXITY_META[result.fileComplexity] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 완주 보고서 모달 */}
      {showReport && result && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-fadeInUp">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-gray-900">🎉 완주 보고서</h2>
              <button onClick={() => setShowReport(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-xl p-4 text-center font-bold text-sm">
              {achievement}
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>📁</span>
              <span className="truncate font-medium text-gray-700">{fileName}</span>
              <span className="ml-auto text-blue-600 font-mono font-bold">⏱️ {formatTime(elapsed)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                <div className="text-xl font-black text-blue-700">{result.totalLines}</div>
                <div className="text-xs text-blue-500">📏 전체 줄</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                <div className="text-xl font-black text-purple-700">{result.components.length}</div>
                <div className="text-xs text-purple-500">🧩 컴포넌트</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                <div className="text-xl font-black text-orange-700">{result.hooks.length}</div>
                <div className="text-xs text-orange-500">⚡ 훅</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <div className="text-xl font-black text-green-700">{result.imports.length}</div>
                <div className="text-xs text-green-500">📦 Import</div>
              </div>
            </div>

            {(dangers.length > 0 || concepts.length > 0) && (
              <div className="flex gap-2">
                {dangers.length > 0 && (
                  <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-red-700">{dangers.length}</div>
                    <div className="text-xs text-red-500">⚠️ 위험 신호</div>
                  </div>
                )}
                {concepts.length > 0 && (
                  <div className="flex-1 bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-indigo-700">{concepts.length}</div>
                    <div className="text-xs text-indigo-500">📖 필수 개념</div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowReport(false)}
              className="w-full bg-blue-600 text-white rounded-xl py-3 font-bold hover:bg-blue-700 transition-colors"
            >
              계속 학습하기 →
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-2xl">🔬</span>
          <div>
            <h1 className="font-black text-gray-900 text-xl leading-none">SrcXray</h1>
            <p className="text-gray-400 text-xs">TSX 소스 분석기 — 500줄도 10분 안에</p>
          </div>

          {result && (
            <div className="ml-auto flex items-center gap-3 flex-wrap text-sm">
              <span className="text-gray-400 text-xs">{fileName}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${complexity!.color}`}>
                {complexity!.label} — {complexity!.desc}
              </span>
              {/* Timer */}
              {timerRunning && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1">
                  <span className="text-blue-600 font-mono text-sm">⏱️ {formatTime(elapsed)}</span>
                  <button
                    onClick={handleDone}
                    className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full hover:bg-blue-700 transition-colors"
                  >
                    분석 완료!
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 완주 버튼 눌렀을 때 작은 확인 배너 */}
        {achievement && !showReport && (
          <button
            onClick={() => setShowReport(true)}
            className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-center py-2 text-sm font-bold hover:opacity-90 transition-opacity"
          >
            {achievement} — 완주 보고서 보기 📊
          </button>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Input */}
        <section className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
            <span className="text-xl">📋</span> 코드 입력
          </h2>
          <CodeInput
            ref={codeInputRef}
            onAnalyze={handleAnalyze}
            isLoading={isLoading}
            code={code}
            fileName={fileName}
            onCodeChange={setCode}
            onFileNameChange={setFileName}
            onReset={handleReset}
          />
        </section>

        {isLoading && !result && (
          <div className="text-center py-12">
            <div className="text-5xl animate-pulse mb-4">🔍</div>
            <p className="text-gray-500 font-medium">AST 파싱 중...</p>
          </div>
        )}

        {result?.parseError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
            <strong>⚠️ 파싱 오류:</strong> {result.parseError}
            <p className="text-sm mt-1 text-red-500">일부 결과는 그래도 표시됩니다.</p>
          </div>
        )}

        {result && (
          <>
            {isLoading && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-blue-600 text-sm font-medium animate-pulse">
                <span className="text-lg">🔍</span> AST 파싱 중...
              </div>
            )}

            {/* TL;DR Card (F-01 + F-05 + F-11) */}
            {tldr && (
              <TldrCard tldr={tldr} result={result} fileName={fileName} concepts={concepts} />
            )}

            {/* Stats (F-09: CountUp animation) */}
            <div className="grid grid-cols-4 gap-3 animate-fadeInUp animation-delay-100">
              <AnimatedStat value={result.totalLines}        label="전체 줄"  emoji="📏" color="bg-blue-50 border-blue-200 text-blue-700" />
              <AnimatedStat value={result.components.length} label="컴포넌트" emoji="🧩" color="bg-purple-50 border-purple-200 text-purple-700" />
              <AnimatedStat value={result.hooks.length}      label="훅"       emoji="⚡" color="bg-orange-50 border-orange-200 text-orange-700" />
              <AnimatedStat value={result.imports.length}    label="Import"   emoji="📦" color="bg-green-50 border-green-200 text-green-700" />
            </div>

            {/* Debug Injector Panel */}
            {result && code && (
              <DebugInjectorPanel
                key={fileName + code.length}
                code={code}
                result={result}
                fileName={fileName}
              />
            )}

            {/* Tabs */}
            <section className="bg-white rounded-2xl shadow-sm border overflow-hidden animate-fadeInUp animation-delay-200">
              <div className="flex border-b overflow-x-auto">
                {TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px
                      ${activeTab === tab.key
                        ? 'border-blue-600 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <span>{tab.emoji}</span>
                    {tab.label}
                    {tab.key === 'components' && <span className="bg-gray-200 text-gray-600 text-xs px-1.5 rounded-full">{result.components.length}</span>}
                    {tab.key === 'imports'    && <span className="bg-gray-200 text-gray-600 text-xs px-1.5 rounded-full">{result.imports.length}</span>}
                    {tab.key === 'functions'  && <span className="bg-gray-200 text-gray-600 text-xs px-1.5 rounded-full">{result.functions.length}</span>}
                    {tab.key === 'hooks'      && <span className="bg-gray-200 text-gray-600 text-xs px-1.5 rounded-full">{result.hooks.length}</span>}
                    {tab.key === 'danger'   && dangers.length > 0  && <span className="bg-red-200 text-red-700 text-xs px-1.5 rounded-full">{dangers.length}</span>}
                    {tab.key === 'danger'   && dangers.length === 0 && <span className="bg-green-200 text-green-700 text-xs px-1.5 rounded-full">✓</span>}
                    {tab.key === 'concepts' && <span className="bg-gray-200 text-gray-600 text-xs px-1.5 rounded-full">{concepts.length}</span>}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {activeTab === 'guide'      && <LearningGuide sections={result.learningGuide} onComplete={handleDone} />}
                {activeTab === 'danger'     && <DangerCard dangers={dangers} onScrollToLine={handleScrollToLine} />}
                {activeTab === 'concepts'   && <ConceptCards concepts={concepts} hooks={result.hooks} onScrollToLine={handleScrollToLine} />}
                {activeTab === 'components' && <ComponentTree components={result.components} />}
                {activeTab === 'flow'       && <FlowDiagram result={result} />}
                {activeTab === 'heatmap'    && <CodeHeatmap code={code} />}
                {activeTab === 'hooks'      && <HookCards hooks={result.hooks} />}
                {activeTab === 'imports'    && <ImportMap imports={result.imports} />}
                {activeTab === 'functions'  && <FunctionList functions={result.functions} />}
              </div>
            </section>
          </>
        )}

        {!result && !isLoading && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">🔬</div>
            <p className="text-xl font-medium text-gray-500">TSX 파일을 업로드하거나 코드를 붙여넣기 하세요</p>

            {/* F-07: 샘플 버튼 */}
            <div className="mt-6">
              <p className="text-sm text-gray-500 mb-3">또는 샘플로 바로 체험해보세요 👇</p>
              <div className="flex gap-3 justify-center flex-wrap">
                {SAMPLES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { handleReset(); setCode(s.code); setFileName(s.title + '.tsx'); }}
                    className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-400 hover:shadow-md hover:scale-105 transition-all text-left"
                  >
                    <span className="text-2xl">{s.emoji}</span>
                    <div>
                      <div className="font-bold text-gray-800 text-sm">{s.title}</div>
                      <div className="text-xs text-gray-500">{s.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* F-19: 히스토리 */}
            <HistoryPanel
              history={history}
              onSelect={item => { handleReset(); setCode(item.code); setFileName(item.fileName); }}
              onDelete={id => setHistory(deleteHistory(id))}
            />
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6 mt-4 border-t">
        SrcXray · 브라우저에서 실행 — 코드가 외부로 전송되지 않습니다 🔒
      </footer>
    </div>
  );
}
