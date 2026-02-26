import type { AnalysisResult } from './parser';
import antipatterns from '@/data/antipatterns.json';

export type DangerLevel = 'critical' | 'high' | 'medium' | 'low';

export interface DangerItem {
  id: string;
  level: DangerLevel;
  category: string;
  emoji: string;
  title: string;
  description: string;   // JSON의 "why" 매핑
  solution: string;      // JSON의 "fix" 매핑
  lines: number[];       // 해당 줄 번호 (빈 배열이면 파일 전체)
  codeExample?: { bad: string; good: string };
}

interface DetectRegex {
  type: 'regex';
  pattern: string;
  flags?: string;
}

interface DetectRegexContext {
  type: 'regex-context';
  pattern: string;
  flags?: string;
  context: {
    scope: 'hook-body' | 'component-body' | 'callback' | 'condition';
    hookName?: string;
  };
}

interface DetectCount {
  type: 'count';
  target: string;
  min: number;
}

interface DetectSpecial {
  type: 'special';
  handler: string;
}

type DetectConfig = DetectRegex | DetectRegexContext | DetectCount | DetectSpecial;

interface AntiPatternRule {
  id: string;
  level: DangerLevel;
  category: string;
  emoji: string;
  title: string;
  why: string;
  fix: string;
  detect: DetectConfig;
  codeExample?: { bad: string; good: string };
}

const LEVEL_ORDER: Record<DangerLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function detectDangers(code: string, result: AnalysisResult): DangerItem[] {
  const lines = code.split('\n');
  const dangers: DangerItem[] = [];
  const rules = antipatterns as unknown as AntiPatternRule[];

  for (const rule of rules) {
    const matched = matchRule(rule, lines, code, result);
    // sentinel: [-1] = 미감지, [] = 파일 전체 해당(count), [n,...] = 특정 줄
    if (matched.length === 1 && matched[0] === -1) continue;
    if (matched.length === 0 && rule.detect.type !== 'count') continue;
    const validLines = matched.filter(l => l > 0);
    dangers.push({
      id: rule.id,
      level: rule.level,
      category: rule.category,
      emoji: rule.emoji,
      title: rule.title,
      description: rule.why,
      solution: rule.fix,
      lines: validLines,
      ...(rule.codeExample ? { codeExample: rule.codeExample } : {}),
    });
  }

  // 중복 제거 + 레벨 순 정렬
  const unique = dangers.filter((d, i, arr) => arr.findIndex(x => x.id === d.id) === i);
  return unique.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

function matchRule(
  rule: AntiPatternRule,
  lines: string[],
  code: string,
  result: AnalysisResult,
): number[] {
  switch (rule.detect.type) {
    case 'regex':
      return matchRegex(rule.detect, lines);
    case 'regex-context':
      return matchRegexContext(rule.detect, lines, result);
    case 'count':
      return matchCount(rule.detect, result);
    case 'special':
      return matchSpecial(rule.detect.handler, lines, result);
    default:
      return [];
  }
}

// ─── 감지 전략: regex (줄 단위) ───

function matchRegex(detect: DetectRegex, lines: string[]): number[] {
  const re = new RegExp(detect.pattern, detect.flags || 'g');
  const matched: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) matched.push(i + 1);
    re.lastIndex = 0;
  }
  return matched;
}

// ─── 감지 전략: regex-context (특정 스코프 안에서만) ───

function matchRegexContext(
  detect: DetectRegexContext,
  lines: string[],
  result: AnalysisResult,
): number[] {
  const re = new RegExp(detect.pattern, detect.flags || 'g');
  const scopeRanges = getScopeRanges(detect.context, lines, result);
  const matched: number[] = [];

  for (const [start, end] of scopeRanges) {
    for (let i = start; i <= end && i < lines.length; i++) {
      if (re.test(lines[i])) matched.push(i + 1);
      re.lastIndex = 0;
    }
  }
  return matched;
}

function getScopeRanges(
  context: DetectRegexContext['context'],
  lines: string[],
  result: AnalysisResult,
): Array<[number, number]> {
  switch (context.scope) {
    case 'hook-body':
      return getHookBodyRanges(context.hookName || '', lines, result);
    case 'component-body':
      return getComponentBodyRanges(result, lines);
    case 'condition':
      return getConditionRanges(lines);
    case 'callback':
      return getCallbackRanges(lines);
    default:
      return [];
  }
}

function getHookBodyRanges(
  hookName: string,
  lines: string[],
  result: AnalysisResult,
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const hooks = result.hooks.filter(h => h.name === hookName);

  for (const hook of hooks) {
    const startLine = hook.line - 1; // 0-indexed
    // 콜백 본문 범위 추정: Hook 호출 줄부터 닫는 괄호까지
    const endLine = findClosingBrace(lines, startLine);
    ranges.push([startLine, endLine]);
  }
  return ranges;
}

function getComponentBodyRanges(
  result: AnalysisResult,
  lines?: string[],
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const comp of result.components) {
    // 컴포넌트 본문에서 중첩 함수/핸들러/Hook 콜백을 제외한 "최상위" 줄만 포함
    const start = comp.startLine - 1; // 0-indexed
    const end = comp.endLine - 1;
    if (!lines) {
      ranges.push([start, end]);
      continue;
    }
    // 중첩 함수 스코프 찾기 (이벤트 핸들러, Hook 콜백, 일반 함수 선언)
    const excludeRanges: Array<[number, number]> = [];
    for (let i = start; i <= end && i < lines.length; i++) {
      const line = lines[i];
      // const handler = (...) => { / function name() { / useEffect(() => { / useMemo(() => {
      if (
        /\b(const|let|var)\s+\w+\s*=\s*(\([^)]*\)|[^=])\s*=>\s*\{/.test(line) ||
        /\bfunction\s+\w+\s*\(/.test(line) ||
        /\b(useEffect|useMemo|useCallback)\s*\(/.test(line)
      ) {
        // arrow function/function 선언은 {} 만 추적 (()가 먼저 닫히는 조기 리턴 방지)
        const fnEnd = findClosingCurlyBrace(lines, i);
        if (fnEnd > i) {
          excludeRanges.push([i, fnEnd]);
          i = fnEnd; // skip past this nested scope
        }
      }
    }
    // 컴포넌트 범위에서 중첩 스코프를 뺀 줄만 추가
    for (let i = start; i <= end; i++) {
      const isExcluded = excludeRanges.some(([s, e]) => i >= s && i <= e);
      if (!isExcluded) {
        ranges.push([i, i]);
      }
    }
  }
  return ranges;
}

function getConditionRanges(lines: string[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(if|else if|for|while|switch)\s*\(/.test(lines[i])) {
      // if(cond) { ... } — ()가 먼저 닫히는 문제 방지를 위해 {} 만 추적
      const end = findClosingCurlyBrace(lines, i);
      ranges.push([i, end]);
    }
  }
  return ranges;
}

function getCallbackRanges(lines: string[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < lines.length; i++) {
    if (/\b(onClick|onChange|onSubmit|onBlur|onFocus|onKeyDown|onKeyUp|onMouseEnter|onMouseLeave)\s*=\s*\{/.test(lines[i])) {
      const end = findClosingBrace(lines, i);
      ranges.push([i, end]);
    }
  }
  return ranges;
}

function findClosingBrace(lines: string[], startLine: number): number {
  let depth = 0;
  let foundOpen = false;
  for (let i = startLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '(' || ch === '{') { depth++; foundOpen = true; }
      if (ch === ')' || ch === '}') depth--;
      if (foundOpen && depth === 0) return i;
    }
  }
  return Math.min(startLine + 20, lines.length - 1);
}

// {} 중괄호만 추적하는 버전 — arrow function handler 제외 시 사용
// findClosingBrace는 ()와 {}를 함께 추적하므로,
// `const handler = (params) => {` 에서 ()가 먼저 닫혀 조기 리턴하는 버그 방지
function findClosingCurlyBrace(lines: string[], startLine: number): number {
  let depth = 0;
  let foundOpen = false;
  for (let i = startLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; foundOpen = true; }
      if (ch === '}') depth--;
      if (foundOpen && depth === 0) return i;
    }
  }
  return Math.min(startLine + 20, lines.length - 1);
}

// ─── 감지 전략: count ───

function matchCount(detect: DetectCount, result: AnalysisResult): number[] {
  const count = result.hooks.filter(h => h.name === detect.target).length;
  if (count >= detect.min) {
    return []; // 빈 배열 = 파일 전체에 해당
  }
  return [-1]; // -1 = 매칭 안 됨 (트리거하지 않음)
}

// ─── 감지 전략: special (복잡한 로직) ───

function matchSpecial(handler: string, lines: string[], result: AnalysisResult): number[] {
  switch (handler) {
    case 'fetchInUseMemo':
      return detectFetchInUseMemo(lines);
    case 'infiniteLoop':
      return detectInfiniteLoop(lines, result);
    case 'mapNoKey':
      return detectMapNoKey(lines);
    case 'effectAsDerived':
      return detectEffectAsDerived(lines, result);
    case 'mutateStateDirect':
      return detectMutateStateDirect(lines, result);
    case 'tooManyProps':
      return detectTooManyProps(result);
    case 'unusedState':
      return detectUnusedState(lines, result);
    case 'largeComponent':
      return detectLargeComponent(result);
    case 'missingEffectDeps':
      return detectMissingEffectDeps(lines, result);
    case 'setStateInEffectNoCondition':
      return detectSetStateInEffectNoCondition(lines, result);
    default:
      return [];
  }
}

function detectFetchInUseMemo(lines: string[]): number[] {
  const matched: number[] = [];
  const fetchPattern = /\b(fetch\w*|load\w*|get[A-Z]\w+|axios|api\.|http\.|\.get\(|\.post\()\b/;

  for (let i = 0; i < lines.length; i++) {
    const memoMatch = lines[i].match(/useMemo\s*\(/);
    if (!memoMatch) continue;

    // useMemo( 이후부터 { 를 찾아야 구조분해 { } 오탐 방지
    const memoPos = memoMatch.index! + memoMatch[0].length;
    const end = findClosingCurlyBraceFrom(lines, i, memoPos);
    for (let j = i; j <= end; j++) {
      if (fetchPattern.test(lines[j])) {
        matched.push(j + 1);
      }
    }
  }
  return matched.length > 0 ? matched : [-1];
}

/** startLine의 charOffset 위치부터 { } 를 추적하여 닫는 줄 번호 반환 */
function findClosingCurlyBraceFrom(lines: string[], startLine: number, charOffset: number): number {
  let depth = 0;
  let foundOpen = false;
  for (let i = startLine; i < lines.length; i++) {
    const start = i === startLine ? charOffset : 0;
    for (let c = start; c < lines[i].length; c++) {
      const ch = lines[i][c];
      if (ch === '{') { depth++; foundOpen = true; }
      if (ch === '}') depth--;
      if (foundOpen && depth === 0) return i;
    }
  }
  return Math.min(startLine + 20, lines.length - 1);
}

function detectInfiniteLoop(lines: string[], result: AnalysisResult): number[] {
  const effectsWithNoDeps = result.hooks.filter(
    h => h.name === 'useEffect' && h.deps === undefined
  );
  const setterNames = result.hooks
    .filter(h => h.name === 'useState' && h.setterVar)
    .map(h => h.setterVar as string);

  const matched: number[] = [];
  for (const effect of effectsWithNoDeps) {
    const effectArea = lines.slice(
      Math.max(0, effect.line - 1),
      effect.line + 15
    ).join('\n');
    const callsSetter = setterNames.some(s => effectArea.includes(s + '('));
    if (callsSetter) {
      matched.push(effect.line);
    }
  }
  return matched;
}

function detectMapNoKey(lines: string[]): number[] {
  const matched: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/\.map\s*\(/.test(lines[i]) && !/<.*key=/.test(lines[i])) {
      const nearLines = lines.slice(i, i + 5).join('\n');
      if (/<[A-Za-z]/.test(nearLines) && !/key=/.test(nearLines)) {
        matched.push(i + 1);
      }
    }
  }
  return matched;
}

function detectEffectAsDerived(lines: string[], result: AnalysisResult): number[] {
  // useEffect 내부에서 setState만 호출하고 deps가 있는 경우 → useMemo로 대체 가능
  const matched: number[] = [];
  const effects = result.hooks.filter(
    h => h.name === 'useEffect' && h.deps !== undefined && h.deps !== '[]'
  );
  const setterNames = result.hooks
    .filter(h => h.name === 'useState' && h.setterVar)
    .map(h => h.setterVar as string);

  for (const effect of effects) {
    const effectArea = lines.slice(
      Math.max(0, effect.line - 1),
      Math.min(lines.length, effect.line + 10)
    ).join('\n');
    // setter를 호출하면서 fetch/subscribe 등 사이드이펙트가 없는 경우
    const callsSetter = setterNames.some(s => effectArea.includes(s + '('));
    const hasSideEffect = /\b(fetch|axios|subscribe|addEventListener|setInterval|setTimeout)\s*\(/.test(effectArea);
    if (callsSetter && !hasSideEffect) {
      matched.push(effect.line);
    }
  }
  return matched;
}

function detectMutateStateDirect(lines: string[], result: AnalysisResult): number[] {
  // useState의 state 변수명만 추적하여 해당 변수에 .push/.splice/.sort 호출 감지
  const stateVarNames = result.hooks
    .filter(h => h.name === 'useState' && h.stateVar)
    .map(h => h.stateVar as string);

  if (stateVarNames.length === 0) return [];

  const matched: number[] = [];
  const mutatePattern = new RegExp(
    `\\b(${stateVarNames.join('|')})\\.(?:push|splice|sort|pop|shift|unshift|reverse|fill)\\s*\\(` +
    `|\\b(${stateVarNames.join('|')})\\[\\w+\\]\\s*=`,
  );

  for (let i = 0; i < lines.length; i++) {
    if (mutatePattern.test(lines[i])) {
      matched.push(i + 1);
    }
  }
  return matched;
}

// ─── special: tooManyProps (props 6개 이상인 컴포넌트) ───

function detectTooManyProps(result: AnalysisResult): number[] {
  const matched: number[] = [];
  for (const comp of result.components) {
    if (comp.props.length > 5) {
      matched.push(comp.startLine);
    }
  }
  return matched;
}

// ─── special: unusedState (선언 후 미참조 state) ───

function detectUnusedState(lines: string[], result: AnalysisResult): number[] {
  const matched: number[] = [];
  const code = lines.join('\n');

  for (const hook of result.hooks) {
    if (hook.name !== 'useState' || !hook.stateVar) continue;
    const stateVar = hook.stateVar;
    // stateVar가 선언 줄 이외에 코드에서 사용되는지 확인
    const usagePattern = new RegExp(`\\b${stateVar}\\b`, 'g');
    const allMatches = code.match(usagePattern);
    // 선언 줄에서 1번, setter에서 0-1번 → 실제 사용이 2번 이하면 미사용
    if (allMatches && allMatches.length <= 1) {
      matched.push(hook.line);
    }
  }
  return matched;
}

// ─── special: largeComponent (100줄 이상) ───

function detectLargeComponent(result: AnalysisResult): number[] {
  const matched: number[] = [];
  for (const fn of result.functions) {
    if (fn.isComponent && (fn.endLine - fn.startLine) > 100) {
      matched.push(fn.startLine);
    }
  }
  return matched;
}

// ─── special: missingEffectDeps (빈 deps에서 state/memo 참조) ───

function detectMissingEffectDeps(lines: string[], result: AnalysisResult): number[] {
  const matched: number[] = [];
  const emptyDepsEffects = result.hooks.filter(
    h => h.name === 'useEffect' && h.deps === '[]'
  );
  // state 변수명과 memo 변수명 수집
  const trackedVars = new Set<string>();
  for (const h of result.hooks) {
    if (h.name === 'useState' && h.stateVar) trackedVars.add(h.stateVar);
    if ((h.name === 'useMemo' || h.name === 'useCallback') && h.memoVar) trackedVars.add(h.memoVar);
  }
  if (trackedVars.size === 0) return matched;

  const varPattern = new RegExp(`\\b(${[...trackedVars].join('|')})\\b`);

  for (const effect of emptyDepsEffects) {
    const startIdx = Math.max(0, effect.line - 1);
    const endIdx = findClosingBrace(lines, startIdx);
    const body = lines.slice(startIdx + 1, endIdx).join('\n');
    if (varPattern.test(body)) {
      matched.push(effect.line);
    }
  }
  return matched;
}

// ─── special: setStateInEffectNoCondition (deps 있는 useEffect에서 조건 없이 setter) ───

function detectSetStateInEffectNoCondition(lines: string[], result: AnalysisResult): number[] {
  const matched: number[] = [];
  const effectsWithDeps = result.hooks.filter(
    h => h.name === 'useEffect' && h.deps !== undefined && h.deps !== '[]'
  );
  const setterNames = result.hooks
    .filter(h => h.name === 'useState' && h.setterVar)
    .map(h => h.setterVar as string);

  if (setterNames.length === 0) return matched;

  for (const effect of effectsWithDeps) {
    const startIdx = Math.max(0, effect.line - 1);
    const endIdx = findClosingBrace(lines, startIdx);
    const bodyLines = lines.slice(startIdx + 1, endIdx);
    const body = bodyLines.join('\n');

    // setter 호출이 있는지 확인
    const callsSetter = setterNames.some(s => body.includes(s + '('));
    if (!callsSetter) continue;

    // if/switch/? 같은 조건문이 있는지 확인
    const hasCondition = /\b(if|switch)\s*\(|[^=!<>]=.*\?/.test(body);
    if (!hasCondition) {
      matched.push(effect.line);
    }
  }
  return matched;
}
