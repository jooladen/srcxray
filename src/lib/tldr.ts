import type { AnalysisResult, HookCall } from './parser';

export interface TldrBadge {
  label: string;
  color: 'blue' | 'purple' | 'orange' | 'green' | 'gray';
}

export interface FileTldr {
  summary: string;
  role: string[];
  badges: TldrBadge[];
}

export function generateTldr(result: Pick<AnalysisResult, 'imports' | 'components' | 'hooks' | 'totalLines' | 'functions'>): FileTldr {
  const { imports, components, hooks, totalLines } = result;

  const allJsxTags = components.flatMap(c => c.jsxTags.map(t => t.toLowerCase()));

  // Role detection
  const hasForm    = allJsxTags.some(t => ['form', 'input', 'textarea', 'select'].includes(t));
  const hasList    = allJsxTags.some(t => ['ul', 'li', 'table', 'tr', 'tbody'].includes(t));
  const hasFetch   = imports.some(i => i.specifiers.some(s => ['fetch', 'axios', 'api'].some(k => s.toLowerCase().includes(k))))
                  || hooks.some(h => h.name === 'useEffect' && h.deps === '[]');
  const hasAuth    = imports.some(i => ['auth', 'session', 'user', 'login', 'jwt'].some(k => i.source.toLowerCase().includes(k)));
  const hasRouter  = imports.some(i => ['router', 'navigation', 'link', 'next/link'].some(k => i.source.toLowerCase().includes(k)));
  const hasModal   = allJsxTags.some(t => ['dialog', 'modal', 'drawer', 'overlay', 'popup'].includes(t));
  const hasSearch  = hooks.some(h => h.stateVar?.match(/search|filter|query|keyword/i));

  // Roles list
  const roles: string[] = [];
  if (hasForm)   roles.push('폼 입력 처리');
  if (hasList)   roles.push('목록 표시');
  if (hasFetch)  roles.push('외부 API 연동');
  if (hasAuth)   roles.push('인증 처리');
  if (hasRouter) roles.push('페이지 이동');
  if (hasModal)  roles.push('팝업/모달 표시');
  if (hasSearch) roles.push('검색/필터링');

  // Summary sentence
  let summary: string;
  if (hasList && hasFetch && hasSearch) {
    summary = '외부에서 데이터를 가져와 목록으로 표시하고 검색/필터링을 지원';
  } else if (hasList && hasFetch) {
    summary = '외부에서 데이터를 가져와 목록으로 표시';
  } else if (hasForm && hasAuth) {
    summary = '사용자 인증을 위한 입력 폼';
  } else if (hasForm) {
    summary = '사용자 입력을 받아 처리하는 폼';
  } else if (hasList) {
    summary = '항목 목록을 보여주는 컴포넌트';
  } else if (hasModal) {
    summary = '팝업/모달 UI를 표시하는 컴포넌트';
  } else if (hasAuth) {
    summary = '로그인/인증 상태를 처리하는 컴포넌트';
  } else if (hasFetch) {
    summary = '외부 데이터를 가져와 표시하는 컴포넌트';
  } else {
    summary = 'UI를 렌더링하는 컴포넌트';
  }

  // Prefix with component name if single
  if (components.length === 1) {
    summary = `${components[0].name}: ${summary}`;
  }

  // Badges
  const stateCount  = hooks.filter(h => h.name === 'useState').length;
  const effectCount = hooks.filter(h => h.name === 'useEffect').length;

  const badges: TldrBadge[] = [
    { label: `🧩 컴포넌트 ${components.length}개`, color: 'blue' },
  ];
  if (stateCount  > 0) badges.push({ label: `⚡ useState ${stateCount}개`,   color: 'purple' });
  if (effectCount > 0) badges.push({ label: `🔄 useEffect ${effectCount}개`, color: 'orange' });
  badges.push({ label: `📏 ${totalLines}줄`, color: 'gray' });

  return { summary, role: roles, badges };
}
