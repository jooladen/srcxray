import type { AnalysisResult } from './parser';
import type { FileTldr } from './tldr';
import { getHookExplanation } from './hook-explainer';

export function generateMarkdownReport(
  result: AnalysisResult,
  tldr: FileTldr,
  fileName: string,
): string {
  const now = new Date().toLocaleString('ko-KR');
  const lines: string[] = [];

  lines.push(`# ${fileName} 분석 결과`);
  lines.push(`> 생성: ${now}  ·  SrcXray 분석 도구`);
  lines.push('');

  // Overview
  lines.push('## 📋 파일 개요');
  lines.push(`- **역할**: ${tldr.summary}`);
  if (tldr.role.length > 0) lines.push(`- **기능**: ${tldr.role.join(', ')}`);
  lines.push(`- **전체 줄**: ${result.totalLines}줄`);
  lines.push(`- **복잡도**: ${{ simple: '단순 ✅', moderate: '중간 ⚠️', complex: '복잡 🔴' }[result.fileComplexity]}`);
  lines.push('');

  // Components
  if (result.components.length > 0) {
    lines.push('## 🧩 컴포넌트');
    result.components.forEach(c => {
      lines.push(`### \`${c.name}\` (${c.startLine}–${c.endLine}줄)`);
      if (c.props.length > 0) lines.push(`- **Props**: \`${c.props.join('`, `')}\``);
      if (c.hooks.length > 0) {
        lines.push('- **상태/훅**:');
        c.hooks.forEach(h => {
          const exp = getHookExplanation(h);
          if (h.name === 'useState') {
            lines.push(`  - \`${h.stateVar}\` ${exp.emoji} — ${exp.plain}`);
          } else {
            lines.push(`  - \`${h.name}\` ${exp.emoji} — ${exp.plain}`);
          }
        });
      }
      if (c.jsxTags.length > 0)
        lines.push(`- **JSX 태그**: ${c.jsxTags.slice(0, 8).map(t => `\`<${t}>\``).join(', ')}`);
    });
    lines.push('');
  }

  // Imports
  if (result.imports.length > 0) {
    lines.push('## 📦 의존성');
    const ext   = result.imports.filter(i => i.isExternal);
    const local = result.imports.filter(i => !i.isExternal);
    if (ext.length   > 0) lines.push(`- **외부 패키지**: ${ext.map(i => `\`${i.source}\``).join(', ')}`);
    if (local.length > 0) lines.push(`- **내부 파일**: ${local.map(i => `\`${i.source}\``).join(', ')}`);
    lines.push('');
  }

  // Learning guide highlights
  lines.push('## 📚 학습 포인트');
  result.learningGuide.forEach(s => {
    lines.push(`${s.order}. **${s.emoji} ${s.title}** — ${s.description}`);
  });
  lines.push('');

  lines.push('---');
  lines.push('*SrcXray로 자동 생성 · 브라우저 로컬 처리 (코드 외부 전송 없음)*');

  return lines.join('\n');
}
