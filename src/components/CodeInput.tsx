'use client';

import { forwardRef, useImperativeHandle, useRef, useState, useCallback, useMemo } from 'react';

export interface CodeInputHandle {
  scrollToLine: (line: number) => void;
}

interface Props {
  onAnalyze: (code: string, fileName: string) => void;
  isLoading: boolean;
  code: string;
  fileName: string;
  onCodeChange: (code: string) => void;
  onFileNameChange: (name: string) => void;
  onReset: () => void;
}

// ─── 괄호 매칭 유틸 ────────────────────────────────────────────
const OPEN_BRACKETS  = '([{';
const CLOSE_BRACKETS = ')]}';

interface BracketPair {
  openPos: number;   // 코드 내 문자 인덱스
  closePos: number;
  openLine: number;  // 1-based
  closeLine: number;
  char: string;      // '(' | '[' | '{'
}

function findAllBracketPairs(code: string): BracketPair[] {
  const pairs: BracketPair[] = [];
  const stack: { ch: string; pos: number; line: number }[] = [];
  let line = 1;
  let inString: string | null = null;
  let inTemplate = false;
  let escaped = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];

    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }

    // 문자열 안에서는 괄호 무시
    if (inString) {
      if (ch === inString && !inTemplate) inString = null;
      else if (inTemplate && ch === '`') { inString = null; inTemplate = false; }
      if (ch === '\n') line++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      if (ch === '`') inTemplate = true;
      continue;
    }

    if (ch === '\n') { line++; continue; }

    const openIdx = OPEN_BRACKETS.indexOf(ch);
    if (openIdx >= 0) {
      stack.push({ ch, pos: i, line });
      continue;
    }
    const closeIdx = CLOSE_BRACKETS.indexOf(ch);
    if (closeIdx >= 0) {
      // 스택에서 매칭되는 여는 괄호 찾기
      for (let s = stack.length - 1; s >= 0; s--) {
        if (OPEN_BRACKETS.indexOf(stack[s].ch) === closeIdx) {
          const open = stack.splice(s, 1)[0];
          pairs.push({ openPos: open.pos, closePos: i, openLine: open.line, closeLine: line, char: open.ch });
          break;
        }
      }
    }
  }
  return pairs;
}

/** 커서 위치에서 가장 가까운 괄호의 짝을 찾는다 */
function findMatchAtCursor(pairs: BracketPair[], cursorPos: number): { pos: number; matchPos: number; line: number; matchLine: number; char: string; matchChar: string } | null {
  // 커서 위치 또는 바로 앞 문자가 괄호인지 확인
  for (const p of pairs) {
    if (cursorPos === p.openPos || cursorPos === p.openPos + 1) {
      const openCh = p.char;
      const closeCh = CLOSE_BRACKETS[OPEN_BRACKETS.indexOf(openCh)];
      return { pos: p.openPos, matchPos: p.closePos, line: p.openLine, matchLine: p.closeLine, char: openCh, matchChar: closeCh };
    }
    if (cursorPos === p.closePos || cursorPos === p.closePos + 1) {
      const openCh = p.char;
      const closeCh = CLOSE_BRACKETS[OPEN_BRACKETS.indexOf(openCh)];
      return { pos: p.closePos, matchPos: p.openPos, line: p.closeLine, matchLine: p.openLine, char: closeCh, matchChar: openCh };
    }
  }
  return null;
}

const SAMPLE_CODE = `import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { fetchUsers } from '@/lib/api';

interface User {
  id: number;
  name: string;
  email: string;
}

interface UserListProps {
  title?: string;
  maxItems?: number;
}

export default function UserList({ title = '사용자 목록', maxItems = 10 }: UserListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchUsers().then(data => {
      setUsers(data.slice(0, maxItems));
      setLoading(false);
    });
  }, [maxItems]);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="검색..."
        className="border p-2 mt-2 w-full"
      />
      {loading ? (
        <p>로딩 중...</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {filtered.map(user => (
            <li key={user.id} className="border rounded p-3">
              <strong>{user.name}</strong>
              <span className="text-gray-500 ml-2">{user.email}</span>
            </li>
          ))}
        </ul>
      )}
      <Button onClick={() => setSearch('')}>초기화</Button>
    </div>
  );
}`;

const CodeInput = forwardRef<CodeInputHandle, Props>(function CodeInput(
  { onAnalyze, isLoading, code, fileName, onCodeChange, onFileNameChange, onReset }: Props,
  ref
) {
  const [dragOver, setDragOver] = useState(false);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [cursorPos, setCursorPos] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 괄호 매칭
  const bracketPairs = useMemo(() => findAllBracketPairs(code), [code]);
  const bracketMatch = useMemo(
    () => cursorPos !== null ? findMatchAtCursor(bracketPairs, cursorPos) : null,
    [bracketPairs, cursorPos]
  );

  const handleCursorChange = useCallback(() => {
    if (textareaRef.current) {
      setCursorPos(textareaRef.current.selectionStart);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    scrollToLine: (line: number) => {
      // 먼저 소스 코드 영역이 보이도록 화면 스크롤
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 약간의 딜레이 후 내부 스크롤 (화면 이동 완료 후)
      setTimeout(() => {
        const lineHeight = 20; // leading-5
        const scrollTop = (line - 1) * lineHeight;
        if (textareaRef.current) textareaRef.current.scrollTop = scrollTop;
        if (lineNumRef.current)  lineNumRef.current.scrollTop  = scrollTop;
        setHighlightedLine(line);
        setTimeout(() => setHighlightedLine(null), 1500);
      }, 400);
    },
  }));

  const syncScroll = () => {
    if (lineNumRef.current && textareaRef.current) {
      lineNumRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(tsx?|jsx?)$/)) {
      alert('TSX, TypeScript, JSX 파일만 지원합니다.');
      return;
    }
    onReset();
    onFileNameChange(file.name);
    const reader = new FileReader();
    reader.onload = e => onCodeChange(e.target?.result as string ?? '');
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const loadSample = () => {
    onReset();
    onCodeChange(SAMPLE_CODE);
    onFileNameChange('UserList.tsx (샘플)');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
          ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <div className="text-4xl mb-2">📁</div>
        <p className="text-gray-600 font-medium">TSX 파일을 드래그하거나 클릭해서 업로드</p>
        <p className="text-gray-400 text-sm mt-1">.tsx .ts .jsx .js 지원</p>
        <input
          ref={fileRef}
          type="file"
          accept=".tsx,.ts,.jsx,.js"
          className="hidden"
          onChange={e => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
            e.target.value = '';  // 같은 파일 재선택 허용
          }}
        />
      </div>

      {/* File name indicator */}
      {fileName && (
        <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <span className="text-blue-600">📄</span>
          <span className="font-mono text-blue-700">{fileName}</span>
        </div>
      )}

      {/* Textarea with line numbers */}
      <div ref={containerRef} className="relative border rounded-xl overflow-hidden bg-gray-950 focus-within:ring-2 focus-within:ring-blue-400">
        <div className="flex h-56">
          {/* Line numbers + bracket match indicator */}
          <div
            ref={lineNumRef}
            className="select-none py-4 font-mono text-xs text-gray-500 bg-gray-900 border-r border-gray-700 overflow-hidden shrink-0 flex"
            style={{ minWidth: '5.5rem' }}
          >
            {/* 짝 괄호 위치 표시 (왼쪽) */}
            <div className="w-7 shrink-0">
              {(code || ' ').split('\n').map((_, i) => {
                const lineNum = i + 1;
                // 현재 괄호가 있는 줄이면 짝 줄 번호 표시
                const isMatchSource = bracketMatch && bracketMatch.line === lineNum;
                const isMatchTarget = bracketMatch && bracketMatch.matchLine === lineNum;
                let indicator = null;
                if (isMatchSource && Math.abs(bracketMatch!.matchLine - bracketMatch!.line) > 3) {
                  indicator = (
                    <span className="text-red-400 text-[10px] font-bold leading-5 block text-center cursor-pointer"
                      title={`짝: ${bracketMatch!.matchLine}줄`}
                      onClick={() => {
                        if (textareaRef.current && lineNumRef.current) {
                          const scrollTop = (bracketMatch!.matchLine - 1) * 20;
                          textareaRef.current.scrollTop = scrollTop;
                          lineNumRef.current.scrollTop = scrollTop;
                        }
                      }}
                    >
                      →{bracketMatch!.matchLine}
                    </span>
                  );
                } else if (isMatchTarget && Math.abs(bracketMatch!.matchLine - bracketMatch!.line) > 3) {
                  indicator = (
                    <span className="text-red-400 text-[10px] font-bold leading-5 block text-center cursor-pointer"
                      title={`짝: ${bracketMatch!.line}줄`}
                      onClick={() => {
                        if (textareaRef.current && lineNumRef.current) {
                          const scrollTop = (bracketMatch!.line - 1) * 20;
                          textareaRef.current.scrollTop = scrollTop;
                          lineNumRef.current.scrollTop = scrollTop;
                        }
                      }}
                    >
                      →{bracketMatch!.line}
                    </span>
                  );
                }
                return <div key={i} className="leading-5 h-5">{indicator}</div>;
              })}
            </div>
            {/* 줄 번호 (오른쪽) */}
            <div className="flex-1 text-right pr-2">
              {(code || ' ').split('\n').map((_, i) => {
                const lineNum = i + 1;
                const isBracketLine = bracketMatch && (bracketMatch.line === lineNum || bracketMatch.matchLine === lineNum);
                return (
                  <div
                    key={i}
                    className={`leading-5 transition-colors duration-300 rounded
                      ${highlightedLine === lineNum ? 'bg-yellow-400 text-gray-900' : ''}
                      ${isBracketLine && highlightedLine !== lineNum ? 'bg-red-900/40 text-red-400' : ''}`}
                  >
                    {lineNum}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Textarea + bracket highlight overlay */}
          <div className="flex-1 relative">
            {/* 괄호 하이라이트 오버레이 */}
            {bracketMatch && code && (
              <div
                className="absolute inset-0 py-4 px-3 font-mono text-sm leading-5 pointer-events-none whitespace-pre overflow-hidden"
                aria-hidden="true"
              >
                {(() => {
                  const lines = code.split('\n');
                  return lines.map((line, lineIdx) => {
                    const lineNum = lineIdx + 1;
                    const isSrc = lineNum === bracketMatch.line;
                    const isTgt = lineNum === bracketMatch.matchLine;
                    if (!isSrc && !isTgt) return <div key={lineIdx} className="h-5">{'\u00A0'}</div>;

                    // 이 줄에서 하이라이트할 괄호 위치 계산
                    const lineStart = lines.slice(0, lineIdx).reduce((s, l) => s + l.length + 1, 0);
                    const positions: number[] = [];
                    if (isSrc) positions.push(bracketMatch.pos - lineStart);
                    if (isTgt) positions.push(bracketMatch.matchPos - lineStart);

                    const chars = line.split('');
                    return (
                      <div key={lineIdx} className="h-5">
                        {chars.map((c, ci) => {
                          if (positions.includes(ci)) {
                            return <span key={ci} className="text-red-500 font-black bg-red-500/20 rounded-sm">{c}</span>;
                          }
                          return <span key={ci} className="invisible">{c}</span>;
                        })}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={code}
              onChange={e => { onCodeChange(e.target.value); handleCursorChange(); }}
              onScroll={syncScroll}
              onClick={handleCursorChange}
              onKeyUp={handleCursorChange}
              placeholder="또는 TSX 코드를 여기에 직접 붙여넣기 (Ctrl+V)..."
              className="w-full h-full py-4 px-3 font-mono text-sm resize-none focus:outline-none bg-transparent text-green-400 placeholder-gray-600 leading-5 relative z-10"
              style={{ caretColor: '#4ade80' }}
              spellCheck={false}
            />
          </div>
        </div>
        {code && (
          <span className="absolute bottom-2 right-3 text-xs text-gray-600 pointer-events-none">
            {code.split('\n').length}줄
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => code.trim() && onAnalyze(code, fileName || 'code.tsx')}
          disabled={!code.trim() || isLoading}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors text-lg"
        >
          {isLoading ? '분석 중...' : '🔍 분석 시작'}
        </button>
        <button
          onClick={loadSample}
          className="px-5 py-3 border-2 border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600 font-medium rounded-xl transition-colors"
        >
          샘플 코드
        </button>
        {code && (
          <button
            onClick={() => { onReset(); onCodeChange(''); onFileNameChange(''); }}
            className="px-5 py-3 border-2 border-red-200 hover:border-red-400 text-red-500 font-medium rounded-xl transition-colors"
          >
            지우기
          </button>
        )}
      </div>
    </div>
  );
});

export default CodeInput;
