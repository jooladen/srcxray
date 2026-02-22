export interface LineScore {
  score: number;
  borderColor: string;
  bgColor: string;
  label: string;
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
  if (score <= 0) return { score, borderColor: 'transparent', bgColor: 'transparent', label: '빈 줄' };
  if (score <= 2) return { score, borderColor: '#22c55e', bgColor: '#f0fdf4', label: '단순' };
  if (score <= 5) return { score, borderColor: '#eab308', bgColor: '#fefce8', label: '보통' };
  if (score <= 9) return { score, borderColor: '#f97316', bgColor: '#fff7ed', label: '복잡' };
  return { score, borderColor: '#ef4444', bgColor: '#fef2f2', label: '매우 복잡' };
}
