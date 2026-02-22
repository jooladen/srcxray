import type { AnalysisResult } from './parser';

export interface ConceptItem {
  id: string;
  name: string;          // "조건부 렌더링"
  emoji: string;
  level: 1 | 2 | 3;    // 3 = 자다깨도 OK ⭐⭐⭐
  description: string;  // 한줄 핵심
  analogy: string;      // 비유
  lines: number[];      // 발견된 줄 번호 (최대 5개)
  patternDesc: string;  // "? : 패턴으로 발견"
}

const CONCEPT_DEFS = [
  {
    id: 'conditional-rendering',
    name: '조건부 렌더링',
    emoji: '🔀',
    level: 3 as const,
    description: '조건에 따라 다른 화면을 보여주는 핵심 패턴',
    analogy: '신호등 — 빨간불이면 멈추고, 초록불이면 가요',
    regex: /[^<]\?[^?.]|\s&&\s|\|\|/,
    patternDesc: '삼항연산자(? :) 또는 && 연산자로 발견',
  },
  {
    id: 'list-rendering',
    name: '목록 렌더링',
    emoji: '📋',
    level: 3 as const,
    description: '배열을 화면 목록으로 변환하는 필수 패턴',
    analogy: '복사기 — 같은 틀로 여러 장을 찍어내요',
    regex: /\.map\s*\(/,
    patternDesc: '.map()으로 발견',
  },
  {
    id: 'event-handler',
    name: '이벤트 핸들러',
    emoji: '👆',
    level: 3 as const,
    description: '사용자 행동(클릭, 입력 등)에 반응하는 함수',
    analogy: '초인종 — 누를 때만 반응해요',
    regex: /on(Click|Change|Submit|KeyDown|KeyPress|KeyUp|Focus|Blur|Mouse)\s*=/,
    patternDesc: 'onClick/onChange 등으로 발견',
  },
  {
    id: 'form-handling',
    name: '폼 처리',
    emoji: '📝',
    level: 2 as const,
    description: '사용자 입력을 받고 처리하는 HTML form 패턴',
    analogy: '설문지 — 작성하고 제출하는 흐름',
    regex: /e\.preventDefault\(\)|FormEvent|<form/,
    patternDesc: 'e.preventDefault() 또는 <form> 태그로 발견',
  },
  {
    id: 'async-await',
    name: '비동기 처리',
    emoji: '⏳',
    level: 2 as const,
    description: '서버 응답을 기다리는 동안 앱이 멈추지 않게 하는 패턴',
    analogy: '카페 주문 — 커피 만드는 동안 다른 일 할 수 있어요',
    regex: /\basync\b|\bawait\b/,
    patternDesc: 'async/await 키워드로 발견',
  },
  {
    id: 'spread-operator',
    name: '스프레드 연산자',
    emoji: '📤',
    level: 2 as const,
    description: '배열/객체를 펼쳐서 복사하거나 합치는 패턴',
    analogy: '도장 찍기 — 원본은 그대로, 복사본에 추가해요',
    regex: /\.\.\.(prev|state|item|data|obj|\w+)/,
    patternDesc: '...spread 패턴으로 발견',
  },
  {
    id: 'optional-chaining',
    name: '옵셔널 체이닝',
    emoji: '🔒',
    level: 1 as const,
    description: 'undefined/null일 때 안전하게 속성에 접근하는 패턴',
    analogy: '없으면 그냥 undefined — 오류 대신 조용히 넘어가요',
    regex: /\?\./,
    patternDesc: '?. 연산자로 발견',
  },
  {
    id: 'destructuring',
    name: '구조분해 할당',
    emoji: '📦',
    level: 2 as const,
    description: '객체/배열에서 원하는 값만 꺼내는 패턴',
    analogy: '택배 뜯기 — 박스에서 원하는 것만 꺼내요',
    regex: /const\s*\{[^}]+\}\s*=|const\s*\[[^\]]+\]\s*=/,
    patternDesc: '구조분해 패턴으로 발견',
  },
];

export function findConcepts(code: string, _result: AnalysisResult): ConceptItem[] {
  const codeLines = code.split('\n');
  const found: ConceptItem[] = [];

  for (const def of CONCEPT_DEFS) {
    const matchedLines: number[] = [];
    codeLines.forEach((line, i) => {
      if (def.regex.test(line)) matchedLines.push(i + 1);
    });
    if (matchedLines.length > 0) {
      found.push({
        id: def.id,
        name: def.name,
        emoji: def.emoji,
        level: def.level,
        description: def.description,
        analogy: def.analogy,
        lines: matchedLines.slice(0, 5),
        patternDesc: def.patternDesc,
      });
    }
  }

  return found.sort((a, b) => b.level - a.level);  // 중요도 높은 것 먼저
}
