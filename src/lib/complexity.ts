export interface LineScore {
  score: number;
  borderColor: string;
  bgColor: string;
  label: string;
  reasons: string[];
}

export function computeLineComplexity(code: string): number[] {
  return code.split('\n').map(scoreLineComplexity);
}

function scoreLineComplexity(line: string): number {
  const trimmed = line.trimStart();
  // Empty / comment lines
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'))
    return 0;

  let score = 1;

  // Indentation depth (every 2 spaces = +1)
  const indent = line.length - trimmed.length;
  score += Math.floor(indent / 2);

  // async / await
  if (/\basync\b/.test(trimmed)) score += 2;
  if (/\bawait\b/.test(trimmed)) score += 2;

  // Hook calls (use[A-Z]...)
  const hookMatches = trimmed.match(/\buse[A-Z]\w+\s*\(/g);
  if (hookMatches) score += hookMatches.length * 2;

  // Ternary operator
  score += (trimmed.match(/\?(?!\.)/g) ?? []).length;

  // Logical operators
  score += (trimmed.match(/&&|\|\|/g) ?? []).length;

  // JSX opening tags
  score += (trimmed.match(/<[A-Za-z][A-Za-z0-9.]*[\s/>]/g) ?? []).length;

  // try / catch / throw
  if (/\btry\s*\{|\bcatch\s*\(|\bthrow\b/.test(trimmed)) score += 3;

  // Arrow functions
  score += (trimmed.match(/=>/g) ?? []).length;

  // Type/interface definition (less complex visually)
  if (/^(interface|type\s+\w+\s*=|export\s+type|export\s+interface)/.test(trimmed))
    score = Math.max(0, score - 2);

  // Import lines are simple
  if (/^import\s/.test(trimmed)) score = Math.min(score, 2);

  return score;
}

export function getLineScore(score: number): LineScore {
  if (score <= 0) return { score, borderColor: 'transparent', bgColor: 'transparent', label: '빈 줄', reasons: [] };
  if (score <= 2) return { score, borderColor: '#22c55e', bgColor: '#f0fdf4', label: '단순', reasons: [] };
  if (score <= 5) return { score, borderColor: '#eab308', bgColor: '#fefce8', label: '보통', reasons: [] };
  if (score <= 9) return { score, borderColor: '#f97316', bgColor: '#fff7ed', label: '복잡', reasons: [] };
  return { score, borderColor: '#ef4444', bgColor: '#fef2f2', label: '매우 복잡', reasons: [] };
}

export function getComplexityReasons(line: string): string[] {
  const trimmed = line.trimStart();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'))
    return [];

  const reasons: string[] = [];

  const indent = line.length - trimmed.length;
  if (indent >= 6) reasons.push(`들여쓰기 ${indent / 2}단계 — 중첩이 깊어요`);

  if (/\basync\b/.test(trimmed)) reasons.push('async — 비동기 처리');
  if (/\bawait\b/.test(trimmed)) reasons.push('await — 결과를 기다려요');

  const ternaries = (trimmed.match(/\?(?!\.)/g) ?? []).length;
  if (ternaries >= 2) reasons.push(`삼항연산자 ${ternaries}개 — 조건이 겹겹이`);
  else if (ternaries === 1) reasons.push('삼항연산자 — A면 B, 아니면 C');

  const logicals = (trimmed.match(/&&|\|\|/g) ?? []).length;
  if (logicals > 0) reasons.push(`논리연산자 ${logicals}개 — 조건이 복잡해요`);

  const arrows = (trimmed.match(/=>/g) ?? []).length;
  if (arrows > 1) reasons.push(`화살표함수 ${arrows}개 — 함수 안에 함수`);

  const hooks = (trimmed.match(/\buse[A-Z]\w+\s*\(/g) ?? []).length;
  if (hooks > 0) reasons.push(`훅 호출 ${hooks}개`);

  if (/\btry\s*\{|\bcatch\s*\(/.test(trimmed)) reasons.push('try-catch — 에러 처리');

  return reasons;
}

export function getLineScoreWithReasons(score: number, line: string): LineScore {
  const base = getLineScore(score);
  const reasons = score > 2 ? getComplexityReasons(line) : [];
  return { ...base, reasons };
}
