'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { AnalysisResult } from '@/lib/parser';
import type { FileTldr } from '@/lib/tldr';

const CodeInput     = dynamic(() => import('@/components/CodeInput'),     { ssr: false });
const TldrCard      = dynamic(() => import('@/components/TldrCard'),      { ssr: false });
const ImportMap     = dynamic(() => import('@/components/ImportMap'),     { ssr: false });
const ComponentTree = dynamic(() => import('@/components/ComponentTree'), { ssr: false });
const FunctionList  = dynamic(() => import('@/components/FunctionList'),  { ssr: false });
const LearningGuide = dynamic(() => import('@/components/LearningGuide'), { ssr: false });
const FlowDiagram   = dynamic(() => import('@/components/FlowDiagram'),   { ssr: false });
const CodeHeatmap   = dynamic(() => import('@/components/CodeHeatmap'),   { ssr: false });

const COMPLEXITY_META = {
  simple:   { label: '단순',  color: 'bg-green-100 text-green-700',  desc: '금방 파악 가능' },
  moderate: { label: '중간',  color: 'bg-yellow-100 text-yellow-700', desc: '체계적으로 분석 필요' },
  complex:  { label: '복잡',  color: 'bg-red-100 text-red-700',      desc: '섹션별로 나눠서 분석' },
};

type TabKey = 'guide' | 'components' | 'flow' | 'imports' | 'functions' | 'heatmap';

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'guide',      label: '10분 가이드', emoji: '📚' },
  { key: 'components', label: '컴포넌트',    emoji: '🧩' },
  { key: 'flow',       label: '데이터 흐름', emoji: '🌊' },
  { key: 'heatmap',   label: '복잡도 맵',  emoji: '🔥' },
  { key: 'imports',    label: 'Import 맵',  emoji: '📦' },
  { key: 'functions',  label: '함수 목록',  emoji: '🔧' },
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

export default function Home() {
  const [result,   setResult]   = useState<AnalysisResult | null>(null);
  const [tldr,     setTldr]     = useState<FileTldr | null>(null);
  const [code,     setCode]     = useState('');
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('guide');

  // F-06: Timer
  const [elapsed,      setElapsed]    = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [achievement,  setAchievement] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    const [{ analyzeCode }, { generateTldr }] = await Promise.all([
      import('@/lib/parser'),
      import('@/lib/tldr'),
    ]);

    const analysis = analyzeCode(inputCode);
    const fileTldr = generateTldr(analysis);

    setResult(analysis);
    setTldr(fileTldr);
    setActiveTab('guide');
    setTimerRunning(true);
    setIsLoading(false);
  }, []);

  const handleDone = () => {
    setTimerRunning(false);
    if (result) setAchievement(getAchievement(elapsed, result.totalLines));
  };

  const complexity = result ? COMPLEXITY_META[result.fileComplexity] : null;

  return (
    <div className="min-h-screen bg-gray-50">
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

        {/* Achievement banner */}
        {achievement && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-center py-2 text-sm font-bold animate-pulse">
            {achievement}
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Input */}
        <section className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
            <span className="text-xl">📋</span> 코드 입력
          </h2>
          <CodeInput onAnalyze={handleAnalyze} isLoading={isLoading} />
        </section>

        {isLoading && (
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

        {result && !isLoading && (
          <>
            {/* TL;DR Card (F-01 + F-05) */}
            {tldr && (
              <TldrCard tldr={tldr} result={result} fileName={fileName} />
            )}

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: '전체 줄',  value: result.totalLines,        emoji: '📏', color: 'bg-blue-50 border-blue-200 text-blue-700' },
                { label: '컴포넌트', value: result.components.length, emoji: '🧩', color: 'bg-purple-50 border-purple-200 text-purple-700' },
                { label: '훅',       value: result.hooks.length,      emoji: '⚡', color: 'bg-orange-50 border-orange-200 text-orange-700' },
                { label: 'Import',   value: result.imports.length,    emoji: '📦', color: 'bg-green-50 border-green-200 text-green-700' },
              ].map(stat => (
                <div key={stat.label} className={`border rounded-xl p-4 text-center ${stat.color}`}>
                  <div className="text-2xl">{stat.emoji}</div>
                  <div className="text-2xl font-black">{stat.value}</div>
                  <div className="text-xs font-medium opacity-70">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <section className="bg-white rounded-2xl shadow-sm border overflow-hidden">
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
                  </button>
                ))}
              </div>

              <div className="p-6">
                {activeTab === 'guide'      && <LearningGuide sections={result.learningGuide} />}
                {activeTab === 'components' && <ComponentTree components={result.components} />}
                {activeTab === 'flow'       && <FlowDiagram result={result} />}
                {activeTab === 'heatmap'   && <CodeHeatmap code={code} />}
                {activeTab === 'imports'    && <ImportMap imports={result.imports} />}
                {activeTab === 'functions'  && <FunctionList functions={result.functions} />}
              </div>
            </section>
          </>
        )}

        {!result && !isLoading && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-6xl mb-4">🔬</div>
            <p className="text-xl font-medium text-gray-500">TSX 파일을 업로드하거나 코드를 붙여넣기 하세요</p>
            <p className="text-sm mt-2">샘플 코드로 먼저 테스트해볼 수 있습니다</p>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6 mt-4 border-t">
        SrcXray · 브라우저에서 실행 — 코드가 외부로 전송되지 않습니다 🔒
      </footer>
    </div>
  );
}
