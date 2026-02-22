import type { AnalysisResult } from './parser';

export type DangerLevel = 'high' | 'medium' | 'low';

export interface DangerItem {
  id: string;
  level: DangerLevel;
  emoji: string;
  title: string;
  description: string;   // "왜 위험한가요?" 한 줄
  solution: string;      // "어떻게 고치나요?" 한 줄
  lines: number[];       // 해당 줄 번호 (빈 배열이면 파일 전체)
}

export function detectDangers(code: string, result: AnalysisResult): DangerItem[] {
  const dangers: DangerItem[] = [];
  const lines = code.split('\n');

  // D-01: useEffect(async () => ...) — async 직접 사용
  lines.forEach((line, i) => {
    if (/useEffect\s*\(\s*async/.test(line)) {
      dangers.push({
        id: 'async-effect',
        level: 'medium',
        emoji: '🔄',
        title: 'useEffect에 async 직접 사용',
        description: '비동기 함수를 직접 전달하면 클린업이 불가능하고 메모리 누수가 생길 수 있어요',
        solution: 'useEffect 내부에 async 함수를 별도로 선언하고 호출하세요',
        lines: [i + 1],
      });
    }
  });

  // D-02: .map() 안에 key 없음
  lines.forEach((line, i) => {
    if (/\.map\s*\(/.test(line) && !/<.*key=/.test(line)) {
      // JSX를 반환하는 map인지 추가 확인 (return <, => <)
      const nearLines = lines.slice(i, i + 5).join('\n');
      if (/<[A-Za-z]/.test(nearLines) && !/key=/.test(nearLines)) {
        dangers.push({
          id: `map-no-key-${i}`,
          level: 'medium',
          emoji: '🔑',
          title: '.map()에 key prop 누락',
          description: 'React가 목록 항목을 구별 못해서 잘못된 곳이 업데이트되거나 버그가 생겨요',
          solution: '목록 최상위 요소에 고유한 key={item.id} 를 추가하세요',
          lines: [i + 1],
        });
      }
    }
  });

  // D-03: useEffect deps 없음 (무한루프 가능)
  const effectsWithNoDeps = result.hooks.filter(
    h => h.name === 'useEffect' && h.deps === undefined
  );
  const setterNames = result.hooks
    .filter(h => h.name === 'useState' && h.setterVar)
    .map(h => h.setterVar as string);

  effectsWithNoDeps.forEach(effect => {
    // 해당 useEffect 블록에서 setter 호출 여부 확인
    const effectArea = lines.slice(
      Math.max(0, effect.line - 1),
      effect.line + 15
    ).join('\n');
    const callsSetter = setterNames.some(s => effectArea.includes(s + '('));
    if (callsSetter) {
      dangers.push({
        id: `infinite-loop-${effect.line}`,
        level: 'high',
        emoji: '♾️',
        title: 'useEffect 무한 루프 위험',
        description: 'deps 없는 useEffect에서 setState를 호출하면 → 렌더링 → useEffect 실행 → setState ... 무한 반복!',
        solution: 'useEffect 두 번째 인수에 의존하는 값 배열 [] 을 추가하세요',
        lines: [effect.line],
      });
    }
  });

  // D-04: useState 5개 이상 — 커스텀 훅 분리 권장
  const stateCount = result.hooks.filter(h => h.name === 'useState').length;
  if (stateCount >= 5) {
    dangers.push({
      id: 'too-many-states',
      level: 'low',
      emoji: '🗂️',
      title: `useState ${stateCount}개 — 커스텀 훅 고려`,
      description: '상태가 너무 많으면 컴포넌트가 복잡해지고 관리하기 어려워요',
      solution: '관련 상태들을 custom hook으로 묶으면 코드가 깔끔해져요',
      lines: [],
    });
  }

  // D-05: console.log 잔존
  const consoleLines: number[] = [];
  lines.forEach((line, i) => {
    if (/console\.(log|warn|error)\s*\(/.test(line)) {
      consoleLines.push(i + 1);
    }
  });
  if (consoleLines.length > 0) {
    dangers.push({
      id: 'console-log',
      level: 'low',
      emoji: '📝',
      title: `console.log ${consoleLines.length}개 잔존`,
      description: '개발 중 디버깅 코드가 배포에 포함되면 성능에 영향을 줄 수 있어요',
      solution: '배포 전 console.log를 제거하거나 환경변수로 조건부 처리하세요',
      lines: consoleLines,
    });
  }

  // 중복 제거 (같은 id)
  return dangers.filter((d, i, arr) => arr.findIndex(x => x.id === d.id) === i);
}
