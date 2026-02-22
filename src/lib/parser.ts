import { parse } from '@babel/parser';
import type { File, Node } from '@babel/types';

export interface ImportItem {
  source: string;
  specifiers: string[];
  isExternal: boolean;
  category: 'react' | 'ui' | 'util' | 'local' | 'other';
}

export interface HookCall {
  name: string;
  stateVar?: string;
  setterVar?: string;
  deps?: string;
  line: number;
}

export interface ComponentInfo {
  name: string;
  kind: 'function' | 'arrow' | 'class';
  props: string[];
  hooks: HookCall[];
  jsxTags: string[];
  startLine: number;
  endLine: number;
}

export interface FunctionItem {
  name: string;
  kind: 'function' | 'arrow' | 'method';
  params: string[];
  isAsync: boolean;
  isComponent: boolean;
  startLine: number;
  endLine: number;
}

export interface AnalysisResult {
  imports: ImportItem[];
  exports: string[];
  components: ComponentInfo[];
  functions: FunctionItem[];
  hooks: HookCall[];
  totalLines: number;
  fileComplexity: 'simple' | 'moderate' | 'complex';
  learningGuide: LearningSection[];
  parseError?: string;
}

export interface LearningSection {
  order: number;
  title: string;
  emoji: string;
  description: string;
  items: string[];
  minutes: number;
  lineHint?: string;
}

function getImportCategory(source: string): ImportItem['category'] {
  if (source === 'react' || source.startsWith('react-')) return 'react';
  if (['next', '@next', 'framer-motion', '@radix-ui', 'lucide-react', '@heroicons'].some(s => source.startsWith(s))) return 'ui';
  if (source.startsWith('.') || source.startsWith('@/')) return 'local';
  if (['lodash', 'axios', 'date-fns', 'clsx', 'classnames', 'zod', 'yup'].some(s => source.startsWith(s))) return 'util';
  return 'other';
}

function extractText(node: Node): string {
  if (!node) return '';
  if ('name' in node && typeof (node as { name: string }).name === 'string') return (node as { name: string }).name;
  return '';
}

function getJsxTagsFromBody(body: Node[]): string[] {
  const tags = new Set<string>();
  function walk(n: Node) {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'JSXOpeningElement') {
      const el = n as { name: Node };
      const name = extractText(el.name);
      if (name) tags.add(name);
    }
    for (const key of Object.keys(n)) {
      const child = (n as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) child.forEach(c => c && typeof c === 'object' && walk(c as Node));
      else if (child && typeof child === 'object') walk(child as Node);
    }
  }
  body.forEach(walk);
  return Array.from(tags);
}

function extractHooksFromBody(body: Node[]): HookCall[] {
  const hooks: HookCall[] = [];
  function walk(n: Node) {
    if (!n || typeof n !== 'object') return;
    if (
      n.type === 'VariableDeclaration' &&
      (n as { declarations: Node[] }).declarations?.length > 0
    ) {
      const decl = (n as { declarations: { id: Node; init?: Node; loc?: { start: { line: number } } }[] }).declarations[0];
      const init = decl?.init;
      if (init && (init as { type: string }).type === 'CallExpression') {
        const callee = (init as { callee: Node }).callee;
        const hookName = extractText(callee);
        if (hookName.startsWith('use')) {
          const loc = (n as { loc?: { start: { line: number } } }).loc;
          const hook: HookCall = { name: hookName, line: loc?.start.line ?? 0 };
          // useState: [state, setState] = useState(...)
          if (hookName === 'useState' && decl.id.type === 'ArrayPattern') {
            const arr = decl.id as { elements: (Node | null)[] };
            hook.stateVar = arr.elements[0] ? extractText(arr.elements[0]) : undefined;
            hook.setterVar = arr.elements[1] ? extractText(arr.elements[1]) : undefined;
          }
          // useEffect/useCallback/useMemo: deps array
          if (['useEffect', 'useCallback', 'useMemo'].includes(hookName)) {
            const args = (init as { arguments: Node[] }).arguments;
            if (args?.length > 1) {
              const dep = args[1];
              if (dep.type === 'ArrayExpression') {
                const elems = (dep as { elements: (Node | null)[] }).elements;
                hook.deps = '[' + elems.map(e => e ? extractText(e) : '').join(', ') + ']';
              }
            }
          }
          hooks.push(hook);
        }
      }
    }
    for (const key of Object.keys(n)) {
      if (['loc', 'start', 'end', 'tokens', 'errors'].includes(key)) continue;
      const child = (n as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) child.forEach(c => c && typeof c === 'object' && walk(c as Node));
      else if (child && typeof child === 'object') walk(child as Node);
    }
  }
  body.forEach(walk);
  return hooks;
}

function isLikelyComponent(name: string, body: Node[]): boolean {
  if (!name || name[0] !== name[0].toUpperCase()) return false;
  const tags = getJsxTagsFromBody(body);
  return tags.length > 0;
}

export function analyzeCode(code: string): AnalysisResult {
  const totalLines = code.split('\n').length;

  let ast: File;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties'],
      errorRecovery: true,
    });
  } catch (e) {
    return {
      imports: [], exports: [], components: [], functions: [], hooks: [],
      totalLines, fileComplexity: 'simple', learningGuide: [],
      parseError: (e as Error).message,
    };
  }

  const imports: ImportItem[] = [];
  const exports: string[] = [];
  const components: ComponentInfo[] = [];
  const functions: FunctionItem[] = [];

  for (const node of ast.program.body) {
    // Imports
    if (node.type === 'ImportDeclaration') {
      const source = node.source.value;
      const specifiers = node.specifiers.map(s => {
        if (s.type === 'ImportDefaultSpecifier') return s.local.name;
        if (s.type === 'ImportNamespaceSpecifier') return `* as ${s.local.name}`;
        if (s.type === 'ImportSpecifier') {
          const imported = (s as { imported: { name?: string; value?: string } }).imported;
          return imported.name || imported.value || s.local.name;
        }
        return '';
      }).filter(Boolean);
      imports.push({
        source,
        specifiers,
        isExternal: !source.startsWith('.') && !source.startsWith('@/'),
        category: getImportCategory(source),
      });
    }

    // Exports
    if (node.type === 'ExportDefaultDeclaration') {
      const decl = node.declaration as Node & { id?: { name: string }; name?: string };
      exports.push('default: ' + (decl.id?.name ?? decl.name ?? 'anonymous'));
      // Also extract exported function/component
      if ((decl as unknown as { type: string }).type === 'FunctionDeclaration') {
        const fd = decl as unknown as {
          id?: { name: string }; body?: { body: Node[] };
          async?: boolean; params?: Node[];
          loc?: { start: { line: number }; end: { line: number } };
        };
        const name = fd.id?.name ?? 'DefaultExport';
        const body = fd.body?.body ?? [];
        const jsxTags = getJsxTagsFromBody(body);
        const hooks = extractHooksFromBody(body);
        const params = (fd.params ?? []).map(p => extractText(p)).filter(Boolean);
        const fn: FunctionItem = {
          name, kind: 'function',
          params, isAsync: fd.async ?? false,
          isComponent: isLikelyComponent(name, body),
          startLine: fd.loc?.start.line ?? 0,
          endLine: fd.loc?.end.line ?? 0,
        };
        functions.push(fn);
        if (fn.isComponent) {
          components.push({ name, kind: 'function', props: params, hooks, jsxTags, startLine: fn.startLine, endLine: fn.endLine });
        }
      }
    }
    if (node.type === 'ExportNamedDeclaration') {
      if (node.specifiers.length > 0) {
        node.specifiers.forEach(s => {
          const exported = (s as { exported: { name?: string } }).exported;
          exports.push(exported.name ?? '');
        });
      } else if (node.declaration) {
        const d = node.declaration as Node & { id?: { name: string }; declarations?: { id: { name: string } }[] };
        if (d.id) exports.push(d.id.name);
        if (d.declarations) d.declarations.forEach(dec => exports.push(dec.id.name));
      }
      // Also extract exported function/component
      if (node.declaration) {
        const nd = node.declaration as Node & { type: string };
        if (nd.type === 'FunctionDeclaration') {
          const fd = node.declaration as unknown as {
            id?: { name: string }; body?: { body: Node[] };
            async?: boolean; params?: Node[];
            loc?: { start: { line: number }; end: { line: number } };
          };
          const name = fd.id?.name;
          if (name) {
            const body = fd.body?.body ?? [];
            const jsxTags = getJsxTagsFromBody(body);
            const hooks = extractHooksFromBody(body);
            const params = (fd.params ?? []).map(p => extractText(p)).filter(Boolean);
            const fn: FunctionItem = {
              name, kind: 'function',
              params, isAsync: fd.async ?? false,
              isComponent: isLikelyComponent(name, body),
              startLine: fd.loc?.start.line ?? 0,
              endLine: fd.loc?.end.line ?? 0,
            };
            functions.push(fn);
            if (fn.isComponent) {
              components.push({ name, kind: 'function', props: params, hooks, jsxTags, startLine: fn.startLine, endLine: fn.endLine });
            }
          }
        } else if (nd.type === 'VariableDeclaration') {
          const vd = node.declaration as unknown as {
            declarations: { id: Node; init?: Node & { type: string; async?: boolean; params?: Node[]; body?: { body?: Node[] } } }[];
            loc?: { start: { line: number }; end: { line: number } };
          };
          for (const decl of vd.declarations) {
            const name = extractText(decl.id);
            if (!name || !decl.init) continue;
            const init = decl.init;
            if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') {
              const body = init.body?.body ?? [];
              const jsxTags = getJsxTagsFromBody(body.length ? body : [init.body as unknown as Node]);
              const hooks = extractHooksFromBody(body.length ? body : [init.body as unknown as Node]);
              const params = (init.params ?? []).map(p => extractText(p)).filter(Boolean);
              const fn: FunctionItem = {
                name, kind: 'arrow',
                params, isAsync: init.async ?? false,
                isComponent: isLikelyComponent(name, body.length ? body : [init.body as unknown as Node]),
                startLine: vd.loc?.start.line ?? 0,
                endLine: vd.loc?.end.line ?? 0,
              };
              functions.push(fn);
              if (fn.isComponent) {
                components.push({ name, kind: 'arrow', props: params, hooks, jsxTags, startLine: fn.startLine, endLine: fn.endLine });
              }
            }
          }
        }
      }
    }

    // Functions
    if (node.type === 'FunctionDeclaration' && node.id) {
      const name = node.id.name;
      const body = node.body?.body ?? [];
      const jsxTags = getJsxTagsFromBody(body);
      const hooks = extractHooksFromBody(body);
      const params = node.params.map(p => extractText(p)).filter(Boolean);
      const loc = node.loc;
      const fn: FunctionItem = {
        name, kind: 'function',
        params, isAsync: node.async,
        isComponent: isLikelyComponent(name, body),
        startLine: loc?.start.line ?? 0,
        endLine: loc?.end.line ?? 0,
      };
      functions.push(fn);
      if (fn.isComponent) {
        components.push({ name, kind: 'function', props: params, hooks, jsxTags, startLine: fn.startLine, endLine: fn.endLine });
      }
    }

    // Variable declarations (arrow functions, const components)
    if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        const name = extractText(decl.id as Node);
        if (!name || !decl.init) continue;
        const init = decl.init as Node & { type: string; async?: boolean; params?: Node[]; body?: { body?: Node[] } };
        if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') {
          const body = init.body?.body ?? [];
          const jsxTags = getJsxTagsFromBody(body.length ? body : [init.body as unknown as Node]);
          const hooks = extractHooksFromBody(body.length ? body : [init.body as unknown as Node]);
          const params = (init.params ?? []).map(p => extractText(p)).filter(Boolean);
          const loc = node.loc;
          const fn: FunctionItem = {
            name, kind: 'arrow',
            params, isAsync: init.async ?? false,
            isComponent: isLikelyComponent(name, body.length ? body : [init.body as unknown as Node]),
            startLine: loc?.start.line ?? 0,
            endLine: loc?.end.line ?? 0,
          };
          functions.push(fn);
          if (fn.isComponent) {
            components.push({ name, kind: 'arrow', props: params, hooks, jsxTags, startLine: fn.startLine, endLine: fn.endLine });
          }
        }
      }
    }
  }

  // Global hooks (top-level in components)
  const allHooks = components.flatMap(c => c.hooks);

  // Complexity
  let fileComplexity: AnalysisResult['fileComplexity'] = 'simple';
  if (totalLines > 500 || components.length > 3 || allHooks.length > 8) fileComplexity = 'complex';
  else if (totalLines > 200 || components.length > 1 || allHooks.length > 3) fileComplexity = 'moderate';

  // Learning guide
  const learningGuide = buildLearningGuide({ imports, components, functions, allHooks, totalLines });

  return { imports, exports, components, functions, hooks: allHooks, totalLines, fileComplexity, learningGuide };
}

function buildLearningGuide({
  imports, components, functions, allHooks, totalLines
}: {
  imports: ImportItem[];
  components: ComponentInfo[];
  functions: FunctionItem[];
  allHooks: HookCall[];
  totalLines: number;
}): LearningSection[] {
  const guide: LearningSection[] = [];
  let order = 1;

  // Section 1: File overview
  guide.push({
    order: order++,
    emoji: '📋',
    title: '파일 개요 파악',
    description: `전체 ${totalLines}줄 코드의 큰 그림을 먼저 잡습니다.`,
    items: [
      `총 ${totalLines}줄 / 컴포넌트 ${components.length}개 / 함수 ${functions.length}개`,
      `복잡도: ${totalLines > 500 ? '복잡 (차근차근 분석 필요)' : totalLines > 200 ? '중간' : '단순'}`,
      '파일 상단(import)에서 하단(export)으로 읽는 순서',
    ],
    minutes: 1,
  });

  // Section 2: Imports
  const externalImports = imports.filter(i => i.isExternal);
  const localImports = imports.filter(i => !i.isExternal);
  guide.push({
    order: order++,
    emoji: '📦',
    title: '의존성 분석 (import 구문)',
    description: '어떤 라이브러리와 파일을 사용하는지 파악합니다.',
    items: [
      `외부 패키지 ${externalImports.length}개: ${externalImports.map(i => i.source).slice(0, 5).join(', ')}`,
      `내부 파일 ${localImports.length}개: ${localImports.map(i => i.source).slice(0, 5).join(', ')}`,
      '모르는 패키지는 npm.io에서 검색해보세요',
    ],
    minutes: 2,
    lineHint: '파일 최상단',
  });

  // Section 3: Components
  if (components.length > 0) {
    guide.push({
      order: order++,
      emoji: '🧩',
      title: '컴포넌트 구조 분석',
      description: '각 컴포넌트가 무슨 역할을 하는지 파악합니다.',
      items: components.map(c =>
        `${c.name} (${c.startLine}-${c.endLine}줄): props=${c.props.join(', ') || '없음'}, JSX태그=${c.jsxTags.slice(0, 4).join(', ')}`
      ),
      minutes: 2,
      lineHint: components.map(c => `${c.startLine}-${c.endLine}줄`).join(', '),
    });
  }

  // Section 4: Hooks / State
  if (allHooks.length > 0) {
    const stateHooks = allHooks.filter(h => h.name === 'useState');
    const effectHooks = allHooks.filter(h => h.name === 'useEffect');
    guide.push({
      order: order++,
      emoji: '⚡',
      title: '상태(State)와 훅 분석',
      description: '데이터가 어떻게 관리되는지 파악합니다.',
      items: [
        ...stateHooks.map(h => `useState → ${h.stateVar} / ${h.setterVar} (${h.line}줄)`),
        ...effectHooks.map(h => `useEffect (${h.line}줄) deps: ${h.deps ?? '없음'}`),
        ...allHooks.filter(h => !['useState', 'useEffect'].includes(h.name)).map(h => `${h.name} (${h.line}줄)`),
      ],
      minutes: 2,
    });
  }

  // Section 5: Non-component functions
  const utilFunctions = functions.filter(f => !f.isComponent);
  if (utilFunctions.length > 0) {
    guide.push({
      order: order++,
      emoji: '🔧',
      title: '유틸리티 함수 분석',
      description: '컴포넌트 외부의 헬퍼 함수들을 확인합니다.',
      items: utilFunctions.map(f =>
        `${f.name}(${f.params.join(', ')}) ${f.isAsync ? '[async]' : ''} — ${f.startLine}줄`
      ),
      minutes: 1,
      lineHint: utilFunctions.map(f => `${f.startLine}-${f.endLine}줄`).join(', '),
    });
  }

  // Final: Summary
  guide.push({
    order: order++,
    emoji: '✅',
    title: '전체 정리 & 이해 확인',
    description: '분석한 내용을 요약하며 이해를 확인합니다.',
    items: [
      '컴포넌트 간 데이터 흐름 (props 전달) 확인',
      '상태가 변경될 때 어디가 다시 렌더링되는지 추적',
      '궁금한 함수는 직접 console.log 찍어보기',
    ],
    minutes: 2,
  });

  return guide;
}
