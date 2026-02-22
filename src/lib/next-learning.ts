export interface NextTopic {
  emoji: string;
  title: string;
  reason: string;
  url: string;
}

const NEXT_MAP: Record<string, NextTopic[]> = {
  'useState': [
    { emoji: '🔄', title: 'useReducer', reason: '복잡한 상태를 더 깔끔하게', url: 'https://react.dev/reference/react/useReducer' },
    { emoji: '🌐', title: 'Context API', reason: '여러 컴포넌트에 상태 공유', url: 'https://react.dev/reference/react/useContext' },
  ],
  'useEffect': [
    { emoji: '⚡', title: 'React Query', reason: '서버 데이터 패칭을 10배 쉽게', url: 'https://tanstack.com/query' },
    { emoji: '🧹', title: '클린업 함수', reason: '메모리 누수 방지 필수', url: 'https://react.dev/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development' },
  ],
  'props': [
    { emoji: '📘', title: 'TypeScript Props', reason: '타입 안전한 props 정의', url: 'https://react.dev/learn/typescript' },
    { emoji: '🌐', title: 'Context API', reason: 'prop drilling 해결', url: 'https://react.dev/reference/react/useContext' },
  ],
  'async-await': [
    { emoji: '🛡️', title: '에러 바운더리', reason: '비동기 에러를 우아하게 처리', url: 'https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary' },
    { emoji: '⚡', title: 'React Query', reason: '로딩·에러 상태 자동 관리', url: 'https://tanstack.com/query' },
  ],
  'form': [
    { emoji: '📋', title: 'React Hook Form', reason: '폼 검증을 훨씬 쉽게', url: 'https://react-hook-form.com' },
    { emoji: '✅', title: 'Zod', reason: '타입 안전한 폼 검증', url: 'https://zod.dev' },
  ],
  'conditional-rendering': [
    { emoji: '🎨', title: 'Suspense', reason: '로딩 상태를 선언적으로', url: 'https://react.dev/reference/react/Suspense' },
  ],
  'list-rendering': [
    { emoji: '🔑', title: 'key prop 완전 이해', reason: '목록 버그의 90% 해결', url: 'https://react.dev/learn/rendering-lists' },
    { emoji: '🔄', title: 'useMemo', reason: '큰 목록 성능 최적화', url: 'https://react.dev/reference/react/useMemo' },
  ],
  'useCallback': [
    { emoji: '🧠', title: 'useMemo', reason: '값 메모이제이션으로 확장', url: 'https://react.dev/reference/react/useMemo' },
    { emoji: '🔬', title: 'React DevTools Profiler', reason: '리렌더링 원인 시각화', url: 'https://react.dev/learn/react-developer-tools' },
  ],
  'useRef': [
    { emoji: '🎯', title: 'forwardRef', reason: '자식 컴포넌트에 ref 전달', url: 'https://react.dev/reference/react/forwardRef' },
  ],
};

export function getNextTopics(conceptIds: string[]): NextTopic[] {
  const seen = new Set<string>();
  const result: NextTopic[] = [];
  for (const id of conceptIds) {
    for (const topic of (NEXT_MAP[id] ?? [])) {
      if (!seen.has(topic.title)) {
        seen.add(topic.title);
        result.push(topic);
      }
    }
  }
  return result.slice(0, 4);
}
