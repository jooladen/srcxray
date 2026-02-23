import type { AnalysisResult } from './parser';

export interface InjectionPoint {
  line: number;
  code: string;
  category: 'props' | 'state' | 'effect' | 'handler' | 'render';
}

export interface InjectionBreakdown {
  props: number;
  state: number;
  effect: number;
  handler: number;
  render: number;
}

export interface InjectionResult {
  injectedSource: string;
  points: InjectionPoint[];
  breakdown: InjectionBreakdown;
  totalCount: number;
}

export interface ExecutionStep {
  order: number;
  line: number;
  category: InjectionPoint['category'];
  label: string;
  note?: string;
  phase: 'mount' | 'update' | 'event';
}

// 변수명 패턴 → 한국어 설명
const SMART_LABELS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^is[A-Z]|^has[A-Z]|loading|visible|open|active|enabled|checked|selected/i, label: '켜짐/꺼짐 상태' },
  { pattern: /count|index|num|total|size|length|page/i, label: '숫자 카운터' },
  { pattern: /email|password|token|auth|login|credential/i, label: '인증 입력값' },
  { pattern: /^data$|list|items|posts|users|products|results/i, label: '데이터 목록' },
  { pattern: /error|err|fail|exception/i, label: '에러 상태' },
  { pattern: /^user$|profile|^me$|account|member/i, label: '사용자 정보' },
  { pattern: /search|filter|query|keyword/i, label: '검색/필터' },
  { pattern: /modal|dialog|popup|drawer/i, label: '팝업 상태' },
  { pattern: /theme|dark|light|mode/i, label: '테마 설정' },
  { pattern: /input|value|field|text/i, label: '입력값' },
];

export function getSmartLabel(varName: string): string {
  for (const { pattern, label } of SMART_LABELS) {
    if (pattern.test(varName)) return label;
  }
  return '';
}

function cap(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function makeMarker(line: number, logArgs: string, category: string): string {
  return [
    `  // @@SRCXRAY-START L:${line} category:${category}`,
    `  console.log(${logArgs});`,
    `  // @@SRCXRAY-END`,
  ].join('\n');
}

function calcBreakdown(points: InjectionPoint[]): InjectionBreakdown {
  return {
    props:   points.filter(p => p.category === 'props').length,
    state:   points.filter(p => p.category === 'state').length,
    effect:  points.filter(p => p.category === 'effect').length,
    handler: points.filter(p => p.category === 'handler').length,
    render:  points.filter(p => p.category === 'render').length,
  };
}

/**
 * 함수 body 시작 위치(= 여는 { 다음 줄)의 splice index를 반환.
 * startLine(1-indexed)부터 최대 30줄 앞으로 스캔해 줄 끝이 '{'인 줄을 찾는다.
 * 못 찾으면 null 반환 → 호출부에서 삽입 건너뜀.
 *
 * 처리 가능한 패턴:
 *   function foo() {                         ← 한 줄 시그니처
 *   function foo(                            ← 다중 줄 파라미터
 *     a: A,
 *   ): ReturnType {
 *   const foo = ({ a, b }: Props) => {       ← 화살표 함수
 *   useEffect(() => {                        ← 콜백 포함
 */
function findBodyStartSplice(lines: string[], startLine: number): number | null {
  const from = Math.max(0, startLine - 1); // 0-indexed
  const to   = Math.min(from + 30, lines.length);
  for (let i = from; i < to; i++) {
    if (lines[i].trimEnd().endsWith('{')) {
      return i + 1; // splice AFTER this line (= body 첫 줄 앞)
    }
  }
  return null;
}

/**
 * 변수 선언문 끝(= ';'로 닫히는 줄)의 splice index를 반환.
 * 괄호 depth를 추적해 다중 줄 선언(useState with object initializer 등)도 처리.
 *
 * e.g. const [items, setItems] = useState<Item[]>(   ← depth 1
 *        defaultItems,
 *      );                                            ← depth 0, ';' 발견
 */
function findStatementEndSplice(lines: string[], startLine: number): number {
  let depth = 0;
  const from = startLine - 1; // 0-indexed
  for (let i = from; i < Math.min(from + 15, lines.length); i++) {
    for (const ch of lines[i]) {
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      if (ch === ')' || ch === ']' || ch === '}') depth--;
    }
    if (depth <= 0 && lines[i].trimEnd().endsWith(';')) {
      return i + 1; // splice AFTER this line
    }
  }
  return startLine; // fallback: 단일 줄로 가정
}

/**
 * 컴포넌트 내부에 선언된 함수/핸들러를 소스 스캔으로 감지.
 * parser.ts는 ast.program.body(최상위)만 순회하므로 컴포넌트 내부 함수는
 * result.functions에 포함되지 않는다. 이 함수로 보완한다.
 *
 * 매칭 대상:
 *   const handleXxx = () => {
 *   const handleXxx = async (a, b) => {
 *   const handleXxx = useCallback(() => {
 *   async function fetchData() {
 *   function innerHelper() {
 *
 * 매칭 제외:
 *   const [state, setState] = useState(...)   ← 구조분해
 *   const searchFields = [...]                ← 배열 리터럴
 *   const data = someFunc(...)                ← 일반 함수 호출
 */
const INNER_ARROW_RE = /^\s*const\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:(?:useCallback|useMemo|useRef)\s*\()?(?:async\s+)?(?:\(|[a-zA-Z_$][\w$]*\s*=>)/;
const INNER_FUNC_RE  = /^\s*(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\(/;

/**
 * 표현식 body 화살표 컴포넌트 (`const Foo = () => (`) 를 감지하고
 * 블록 body 로 변환하는 데 필요한 위치 정보를 반환.
 *
 * 반환값:
 *   arrowIdx   — `=> (` 줄 (0-indexed)
 *   closeIdx   — 닫는 `)` 또는 `);` 줄 (0-indexed)
 *   hasSemi    — 닫는 줄에 `;` 포함 여부
 */
function findExprBodyConvertible(
  lines: string[], startLine: number, endLine: number
): { arrowIdx: number; closeIdx: number; hasSemi: boolean } | null {
  const from = Math.max(0, startLine - 1);
  const to   = Math.min(endLine, lines.length);

  // Step 1: `=> (` 로 끝나는 줄 찾기
  let arrowIdx = -1;
  for (let i = from; i < to; i++) {
    if (/=>\s*\(\s*$/.test(lines[i].trimEnd())) { arrowIdx = i; break; }
  }
  if (arrowIdx === -1) return null;

  // Step 2: 괄호 depth 추적으로 닫는 `)` 줄 찾기
  let depth = 0;
  // 화살표 줄의 `(` 부터 시작
  for (const ch of lines[arrowIdx]) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
  }
  for (let i = arrowIdx + 1; i < to; i++) {
    for (const ch of lines[i]) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
    if (depth <= 0) {
      const closeRaw = lines[i].trimEnd();
      return { arrowIdx, closeIdx: i, hasSemi: closeRaw.endsWith(');') };
    }
  }
  return null;
}

/**
 * `=> (` → `=> { return (` 블록 body 변환을 lines 에 직접 적용.
 * 삽입한 줄 수(2줄)를 반환.
 *
 * 변환 전:
 *   const Foo = () => (
 *     <div/>
 *   );
 *
 * 변환 후:
 *   const Foo = () => { // @@SRCXRAY-EXPR-BODY-OPEN
 *     return ( // @@SRCXRAY-EXPR-BODY-RETURN
 *       <div/>
 *     ); // @@SRCXRAY-EXPR-BODY-CLOSE
 *   }; // @@SRCXRAY-EXPR-BODY-END
 */
function applyExprBodyConversion(
  lines: string[],
  arrowIdx: number, closeIdx: number, hasSemi: boolean
): void {
  // 1. 닫는 줄: `);` → `); // @@SRCXRAY-EXPR-BODY-CLOSE` + 다음 줄에 `};`
  const closeIndent = lines[closeIdx].match(/^(\s*)/)?.[1] ?? '';
  lines[closeIdx] = `${closeIndent}); // @@SRCXRAY-EXPR-BODY-CLOSE`;
  lines.splice(closeIdx + 1, 0, `${closeIndent}}${hasSemi ? ';' : ''} // @@SRCXRAY-EXPR-BODY-END`);

  // 2. 화살표 줄: `=> (` → `=> {` + 다음 줄에 `return (`
  const bodyIndent = lines[arrowIdx + 1]?.match(/^(\s*)/)?.[1] ?? '  ';
  lines[arrowIdx] = lines[arrowIdx].replace(/=>\s*\(\s*$/, '=> { // @@SRCXRAY-EXPR-BODY-OPEN');
  lines.splice(arrowIdx + 1, 0, `${bodyIndent}return ( // @@SRCXRAY-EXPR-BODY-RETURN`);
}

/**
 * 컴포넌트 함수 내부에서 'return'으로 시작하는 줄을 역방향으로 탐색.
 * 해당 줄의 splice index(= return 문 바로 앞)를 반환.
 * 못 찾으면 null.
 */
function findReturnSplice(lines: string[], startLine: number, endLine: number): number | null {
  // endLine-2 (0-indexed endLine-2) 부터 역방향 탐색
  for (let i = endLine - 2; i >= startLine - 1; i--) {
    if (lines[i] && lines[i].trimStart().startsWith('return')) {
      return i; // splice BEFORE this line
    }
  }
  return null;
}

function buildInjectionPoints(source: string, result: AnalysisResult): InjectionPoint[] {
  const lines = source.split('\n');
  const points: InjectionPoint[] = [];
  const used = new Set<number>();

  const addPoint = (spliceAt: number, code: string, category: InjectionPoint['category']) => {
    const at = Math.max(0, Math.min(spliceAt, lines.length));
    if (!used.has(at)) {
      used.add(at);
      points.push({ line: at, code, category });
    }
  };

  for (const comp of result.components) {
    // ── Props: 함수 body { 다음 줄에 삽입 ──
    if (comp.props.length > 0) {
      const bodyStart = findBodyStartSplice(lines, comp.startLine);
      if (bodyStart !== null) {
        const propsStr = comp.props.slice(0, 5).join(', ');
        const logArgs = `'[L:${bodyStart + 1}][${comp.name}][props]', { ${propsStr} }`;
        addPoint(bodyStart, makeMarker(bodyStart + 1, logArgs, 'props'), 'props');
      }
    }

    // ── Hooks ──
    for (const h of comp.hooks) {
      if (h.name === 'useState' && h.stateVar) {
        // 선언 끝(;) 다음 줄에 삽입
        const afterDecl = findStatementEndSplice(lines, h.line);
        const smartLabel = getSmartLabel(h.stateVar);
        const labelStr = smartLabel ? `${h.stateVar}(${smartLabel})` : h.stateVar;
        const logArgs = `'[L:${afterDecl + 1}][state] ${labelStr} =', ${h.stateVar}`;
        addPoint(afterDecl, makeMarker(afterDecl + 1, logArgs, 'state'), 'state');
      } else if (h.name === 'useEffect') {
        // 콜백 body { 다음 줄에 삽입
        const bodyStart = findBodyStartSplice(lines, h.line);
        if (bodyStart !== null) {
          const depsStr = h.deps ? ` deps:${h.deps}` : '';
          const logArgs = `'[L:${bodyStart + 1}][useEffect]${depsStr} 시작'`;
          addPoint(bodyStart, makeMarker(bodyStart + 1, logArgs, 'effect'), 'effect');
        }
      }
    }

    // ── Render: return 문 바로 앞에 삽입 ──
    if (comp.endLine > 1) {
      const returnSplice = findReturnSplice(lines, comp.startLine, comp.endLine);
      if (returnSplice !== null) {
        const renderArgs = `'[L:${returnSplice + 1}][${comp.name}] render'`;
        addPoint(returnSplice, makeMarker(returnSplice + 1, renderArgs, 'render'), 'render');
      }
      // 표현식 body 컴포넌트는 injectLogs 전처리에서 블록 body로 변환됨
      // → 변환 후 다시 buildInjectionPoints 가 호출되므로 여기선 폴백 불필요
    }
  }

  // ── 최상위 핸들러(non-component 함수): body { 다음 줄에 삽입 ──
  for (const fn of result.functions) {
    if (!fn.isComponent && fn.name && fn.startLine > 0) {
      const bodyStart = findBodyStartSplice(lines, fn.startLine);
      if (bodyStart !== null) {
        const logArgs = `'[L:${bodyStart + 1}][${fn.name}] 진입'`;
        addPoint(bodyStart, makeMarker(bodyStart + 1, logArgs, 'handler'), 'handler');
      }
    }
  }

  // ── 컴포넌트 내부 함수/핸들러 스캔 ──
  // parser.ts가 최상위만 추출하므로, 컴포넌트 body를 직접 스캔해 보완한다.
  for (const comp of result.components) {
    const compBodyStart = findBodyStartSplice(lines, comp.startLine);
    if (compBodyStart === null) continue;

    for (let i = compBodyStart; i < comp.endLine - 1; i++) {
      const line = lines[i];
      const m = INNER_ARROW_RE.exec(line) ?? INNER_FUNC_RE.exec(line);
      if (!m) continue;

      const fnName = m[1];
      // i는 0-indexed → findBodyStartSplice에 1-indexed(i+1) 전달
      const fnBodyStart = findBodyStartSplice(lines, i + 1);
      if (fnBodyStart === null) continue;

      const logArgs = `'[L:${fnBodyStart + 1}][${fnName}] 진입'`;
      addPoint(fnBodyStart, makeMarker(fnBodyStart + 1, logArgs, 'handler'), 'handler');
    }
  }

  return points;
}

export function injectLogs(source: string, result: AnalysisResult): InjectionResult {
  const lines = source.split('\n');

  // ── 1패스: 표현식 body 컴포넌트를 블록 body 로 변환 ──
  // 역순(arrowIdx 큰 것부터) 처리 → 앞 줄번호 밀림 방지
  const exprConvs = result.components
    .map(comp => {
      const returnSplice = findReturnSplice(lines, comp.startLine, comp.endLine);
      if (returnSplice !== null) return null; // 이미 블록 body
      return findExprBodyConvertible(lines, comp.startLine, comp.endLine);
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.arrowIdx - a.arrowIdx);

  for (const conv of exprConvs) {
    applyExprBodyConversion(lines, conv.arrowIdx, conv.closeIdx, conv.hasSemi);
  }

  // ── 줄 번호 오프셋 보정 ──
  // 표현식 body 변환은 각각 2줄을 삽입하므로,
  // 원본 result의 줄 번호를 변환된 소스에 맞게 보정해야 한다.
  const adjustLine = (line1: number): number => {
    const line0 = line1 - 1; // 0-indexed
    let offset = 0;
    for (const conv of exprConvs) {
      if (line0 > conv.closeIdx) offset += 2;
      else if (line0 > conv.arrowIdx) offset += 1;
    }
    return line1 + offset;
  };

  const adjustedResult: AnalysisResult = exprConvs.length === 0 ? result : {
    ...result,
    components: result.components.map(c => ({
      ...c,
      startLine: adjustLine(c.startLine),
      endLine: adjustLine(c.endLine),
      hooks: c.hooks.map(h => ({ ...h, line: adjustLine(h.line) })),
    })),
    functions: result.functions.map(f => ({
      ...f,
      startLine: adjustLine(f.startLine),
      endLine: adjustLine(f.endLine),
    })),
  };

  // ── 2패스: 변환된 소스에 로그 포인트 삽입 ──
  const transformedSource = lines.join('\n');
  const points = buildInjectionPoints(transformedSource, adjustedResult);

  const sorted = [...points].sort((a, b) => b.line - a.line);
  const finalLines = transformedSource.split('\n');
  for (const point of sorted) {
    const at = Math.max(0, Math.min(point.line, finalLines.length));
    finalLines.splice(at, 0, point.code);
  }

  return {
    injectedSource: finalLines.join('\n'),
    points,
    breakdown: calcBreakdown(points),
    totalCount: points.length,
  };
}

export function removeInjectedLogs(injectedSource: string): string {
  return injectedSource
    // 1. console.log 마커 블록 제거
    .replace(/[ \t]*\/\/ @@SRCXRAY-START[\s\S]*?\/\/ @@SRCXRAY-END\n?/g, '')
    // 2. 표현식 body 블록 변환 되돌리기
    //    `=> { // @@SRCXRAY-EXPR-BODY-OPEN`  →  `=> (`
    .replace(/=> \{ \/\/ @@SRCXRAY-EXPR-BODY-OPEN/g, '=> (')
    //    `return ( // @@SRCXRAY-EXPR-BODY-RETURN\n` 줄 제거
    .replace(/[ \t]*return \( \/\/ @@SRCXRAY-EXPR-BODY-RETURN\n/g, '')
    //    `); // @@SRCXRAY-EXPR-BODY-CLOSE\n};? // @@SRCXRAY-EXPR-BODY-END\n?`  →  `);`
    .replace(/\); \/\/ @@SRCXRAY-EXPR-BODY-CLOSE\n[ \t]*\};? \/\/ @@SRCXRAY-EXPR-BODY-END\n?/g, ');\n');
}

// WOW-01: React 실행 순서 예측
// React는 부모 → 자식 순서로 실행. 파일 순서가 아니라 호출 순서를 따른다.
export function predictExecutionOrder(result: AnalysisResult): ExecutionStep[] {
  const steps: ExecutionStep[] = [];
  let order = 1;

  // 부모/자식 컴포넌트 구분
  // 다른 컴포넌트의 jsxTags에 이름이 있으면 자식 컴포넌트
  const compNames = new Set(result.components.map(c => c.name));
  const referencedAsChild = new Set<string>();
  for (const comp of result.components) {
    for (const tag of comp.jsxTags) {
      if (compNames.has(tag)) referencedAsChild.add(tag);
    }
  }

  const rootComps = result.components.filter(c => !referencedAsChild.has(c.name));
  const childComps = result.components.filter(c => referencedAsChild.has(c.name));

  // 루트 컴포넌트가 없으면 (모두 서로 참조) 파일 순서 폴백
  const orderedComps = rootComps.length > 0
    ? [...rootComps, ...childComps]
    : result.components;

  for (const comp of orderedComps) {
    const isChild = referencedAsChild.has(comp.name);

    if (comp.props.length > 0) {
      steps.push({
        order: order++,
        line: comp.startLine,
        category: 'props',
        phase: 'mount',
        label: `${comp.name} 시작 → props: ${comp.props.slice(0, 3).join(', ')}`,
        note: isChild ? '(부모 render 안에서 호출)' : undefined,
      });
    }

    for (const h of comp.hooks.filter(h => h.name === 'useState')) {
      const sl = h.stateVar ? getSmartLabel(h.stateVar) : '';
      steps.push({
        order: order++,
        line: h.line,
        category: 'state',
        phase: 'mount',
        label: `${h.stateVar || '상태'} = 초기값${sl ? ` (${sl})` : ''}`,
      });
    }

    steps.push({
      order: order++,
      line: comp.endLine,
      category: 'render',
      phase: 'mount',
      label: `${comp.name} 첫 번째 render`,
      note: isChild ? '(부모가 <' + comp.name + ' /> 호출 시)' : undefined,
    });

    for (const h of comp.hooks.filter(h => h.name === 'useEffect')) {
      const note =
        h.deps === '[]' ? '(처음 한 번만 — mount)' :
        h.deps           ? `(${h.deps} 바뀔 때마다)` :
                           '(매 render 후)';
      steps.push({
        order: order++,
        line: h.line,
        category: 'effect',
        phase: 'mount',
        label: `useEffect 실행 ${note}`,
        note,
      });
    }
  }

  const allHooks = orderedComps.flatMap(c => c.hooks);
  const firstState = allHooks.find(h => h.name === 'useState' && h.stateVar);
  if (firstState) {
    const sl = getSmartLabel(firstState.stateVar!);
    steps.push({
      order: order++,
      line: firstState.line,
      category: 'state',
      phase: 'update',
      label: `set${cap(firstState.stateVar!)}() → 상태 변경${sl ? ` (${sl})` : ''}`,
      note: '→ 재render 발생',
    });
  }

  return steps;
}
