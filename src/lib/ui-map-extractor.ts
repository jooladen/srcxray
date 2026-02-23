import { parse } from '@babel/parser';
import type { AnalysisResult } from './parser';

// ── 타입 정의 ────────────────────────────────────────────────

export interface UiElement {
  component: string;
  tagName: string;
  textContent: string;
  line: number;
  eventName: string;
  handlerExpr: string;
  handlerLine: number;
  handlerActions: string;
}

export interface ChildComponentInfo {
  parent: string;
  name: string;
  line: number;
  stateProps: string[];
  callbackProps: string[];
  otherProps: string[];
}

export interface UiMapData {
  elements: UiElement[];
  childComponents: ChildComponentInfo[];
}

// ── 이벤트 프롭 (태그 제한 없음) ────────────────────────────

const EVENT_PROPS = new Set([
  'onClick', 'onDoubleClick', 'onChange', 'onInput', 'onSubmit',
  'onKeyDown', 'onKeyUp', 'onKeyPress',
  'onBlur', 'onFocus',
  'onMouseDown', 'onMouseUp', 'onMouseEnter', 'onMouseLeave',
  'onDragStart', 'onDragEnd', 'onDrop', 'onDragOver',
  'onScroll', 'onWheel', 'onSelect', 'onCopy', 'onPaste',
  'onTouchStart', 'onTouchEnd', 'onTouchMove',
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AstNode = Record<string, any>;

// ── AST 유틸리티 ─────────────────────────────────────────────

function traverseAst(node: unknown, visit: (n: AstNode) => void): void {
  if (!node || typeof node !== 'object') return;
  const n = node as AstNode;
  visit(n);
  for (const key of Object.keys(n)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'tokens') continue;
    const child = n[key];
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c && typeof c === 'object' && c.type) traverseAst(c, visit);
      }
    } else if (child && typeof child === 'object' && child.type) {
      traverseAst(child, visit);
    }
  }
}

function getJsxTagName(nameNode: AstNode | null): string {
  if (!nameNode) return '';
  if (nameNode.type === 'JSXIdentifier') return nameNode.name as string;
  if (nameNode.type === 'JSXMemberExpression') {
    return `${nameNode.object?.name}.${nameNode.property?.name}`;
  }
  return '';
}

function getJsxText(children: unknown[]): string {
  return children
    .filter((c): c is AstNode => !!c && typeof c === 'object' && (c as AstNode).type === 'JSXText')
    .map((c) => (c.value as string).trim())
    .filter((t) => t.length > 0)
    .join(' ')
    .slice(0, 60);
}

function getAttrStringValue(attrs: AstNode[], attrName: string): string {
  const attr = attrs.find(
    (a) => a.type === 'JSXAttribute' && a.name?.name === attrName,
  );
  if (!attr) return '';
  const val = attr.value;
  if (!val) return '';
  if (val.type === 'StringLiteral') return val.value as string;
  if (val.type === 'JSXExpressionContainer') {
    const expr = val.expression;
    if (expr?.type === 'StringLiteral') return expr.value as string;
    if (expr?.type === 'TemplateLiteral') {
      return expr.quasis?.map((q: AstNode) => q.value?.raw).join('${…}') || '';
    }
  }
  return '';
}

function findContainingComponent(line: number, result: AnalysisResult): string {
  for (const comp of result.components) {
    if (comp.startLine <= line && line <= comp.endLine) return comp.name;
  }
  return 'Global';
}

function findHandlerLine(handlerExpr: string, result: AnalysisResult): number {
  if (!handlerExpr || handlerExpr === '(인라인)') return 0;
  const fn = result.functions.find((f) => f.name === handlerExpr);
  if (fn) return fn.startLine;
  const setterMatch = handlerExpr.match(/^set([A-Z]\w*)/);
  if (setterMatch) {
    const stateVar = setterMatch[1][0].toLowerCase() + setterMatch[1].slice(1);
    for (const comp of result.components) {
      const hook = comp.hooks.find((h) => h.name === 'useState' && h.stateVar === stateVar);
      if (hook) return hook.line;
    }
  }
  return 0;
}

// ── 함수 맵 빌드 ────────────────────────────────────────────

function buildFunctionMap(root: AstNode): Map<string, AstNode> {
  const map = new Map<string, AstNode>();
  traverseAst(root, (node) => {
    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      map.set(node.id.name as string, node);
    }
    if (node.type !== 'VariableDeclarator') return;
    const name = node.id?.name;
    const init = node.init;
    if (!name || !init) return;
    if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') {
      map.set(name as string, init);
    }
    if (init.type === 'CallExpression') {
      const callee = init.callee;
      if (callee?.type === 'Identifier' && (callee.name === 'useCallback' || callee.name === 'useMemo')) {
        const firstArg = init.arguments?.[0];
        if (firstArg && (firstArg.type === 'ArrowFunctionExpression' || firstArg.type === 'FunctionExpression')) {
          map.set(name as string, firstArg);
        }
      }
    }
  });
  return map;
}

// ── 핸들러 동작 추출 ────────────────────────────────────────

const SKIP_METHODS = new Set([
  'map', 'filter', 'reduce', 'forEach', 'find', 'findIndex', 'some', 'every',
  'slice', 'splice', 'join', 'split', 'replace', 'trim', 'toString', 'valueOf',
  'includes', 'startsWith', 'endsWith', 'match', 'test', 'concat', 'flat', 'flatMap',
]);

function extractActions(funcNode: AstNode, funcMap: Map<string, AstNode>): string[] {
  const actions: string[] = [];

  function addCallAction(callExpr: AstNode) {
    const callee = callExpr.callee;
    if (callee?.type === 'Identifier') {
      const name = callee.name as string;
      if (name.startsWith('set') && name.length > 3) {
        const stateVar = name.charAt(3).toLowerCase() + name.slice(4);
        actions.push(`${stateVar} 변경`);
      } else if (!name.startsWith('use') && name !== 'require') {
        actions.push(`${name}()`);
      }
    } else if (callee?.type === 'MemberExpression') {
      const obj: string = callee.object?.name || '';
      const prop: string = callee.property?.name || '';
      if (prop === 'preventDefault' || prop === 'stopPropagation') {
        actions.push('이벤트 제어');
      } else if (prop === 'push' || prop === 'navigate' || prop === 'replace') {
        actions.push('페이지 이동');
      } else if (obj === 'console' || SKIP_METHODS.has(prop)) {
        // skip
      } else if (obj && prop) {
        actions.push(`${obj}.${prop}()`);
      }
    }
  }

  function walkStatement(n: AstNode) {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'ExpressionStatement') {
      const expr = n.expression;
      if (expr?.type === 'CallExpression') addCallAction(expr);
      else if (expr?.type === 'AwaitExpression' && expr.argument?.type === 'CallExpression') {
        actions.push('[비동기]');
        addCallAction(expr.argument);
      }
      return;
    }
    if (n.type === 'VariableDeclaration') {
      for (const decl of n.declarations || []) {
        if (decl.init?.type === 'AwaitExpression') {
          actions.push('[비동기]');
          if (decl.init.argument?.type === 'CallExpression') addCallAction(decl.init.argument);
        } else if (decl.init?.type === 'CallExpression') {
          addCallAction(decl.init);
        }
      }
      return;
    }
    if (n.type === 'IfStatement') {
      if (n.consequent?.body) (n.consequent.body as AstNode[]).forEach(walkStatement);
      if (n.alternate?.body) (n.alternate.body as AstNode[]).forEach(walkStatement);
      else if (n.alternate) walkStatement(n.alternate);
      return;
    }
    if (n.type === 'TryStatement') {
      if (n.block?.body) (n.block.body as AstNode[]).forEach(walkStatement);
      return;
    }
  }

  const body = funcNode.body;
  if (body?.type === 'BlockStatement' && body.body) {
    (body.body as AstNode[]).forEach(walkStatement);
  } else if (body) {
    walkStatement({ type: 'ExpressionStatement', expression: body });
  }

  const unique = [...new Set(actions)];

  // 1단계 더: 호출 함수 내부 동작 펼치기
  const expanded: string[] = [];
  for (const a of unique) {
    expanded.push(a);
    const match = a.match(/^(\w+)\(\)$/);
    if (match) {
      const inner = funcMap.get(match[1]);
      if (inner) {
        const innerActions = extractActions(inner, new Map());
        for (const ia of innerActions) {
          if (!unique.includes(ia) && !expanded.includes(ia)) {
            expanded.push(`  → ${ia}`);
          }
        }
      }
    }
  }
  return expanded;
}

// ── 핸들러 정보 ─────────────────────────────────────────────

function getHandlerInfo(
  attr: AstNode,
  funcMap: Map<string, AstNode>,
): { expr: string; actions: string[] } {
  const val = attr.value;
  if (!val || val.type !== 'JSXExpressionContainer') return { expr: '', actions: [] };
  const expr = val.expression;
  if (!expr) return { expr: '', actions: [] };

  if (expr.type === 'Identifier') {
    const name = expr.name as string;
    const funcNode = funcMap.get(name);
    const actions = funcNode ? extractActions(funcNode, funcMap) : [];
    if (actions.length === 0 && name.startsWith('set') && name.length > 3) {
      const stateVar = name.charAt(3).toLowerCase() + name.slice(4);
      actions.push(`${stateVar} 변경`);
    }
    return { expr: name, actions };
  }

  if (expr.type === 'MemberExpression') {
    const obj = expr.object?.name || '';
    const prop = expr.property?.name || '';
    return { expr: `${obj}.${prop}`, actions: [] };
  }

  if (expr.type === 'ArrowFunctionExpression' || expr.type === 'FunctionExpression') {
    const actions = extractActions(expr, funcMap);
    const body = expr.body;
    if (body?.type === 'CallExpression' && body.callee?.type === 'Identifier') {
      const name = body.callee.name as string;
      const innerFunc = funcMap.get(name);
      if (innerFunc) {
        const innerActions = extractActions(innerFunc, funcMap);
        return { expr: name, actions: innerActions.length > 0 ? innerActions : actions };
      }
      return { expr: name, actions };
    }
    return { expr: '(인라인)', actions };
  }

  if (expr.type === 'CallExpression' && expr.callee?.type === 'Identifier') {
    return { expr: expr.callee.name as string, actions: [] };
  }

  return { expr: '', actions: [] };
}

// ── 메인 추출: UI 요소 + 자식 컴포넌트 + 상태 연결 ──────────

export function extractUiMap(source: string, result: AnalysisResult): UiMapData {
  let ast: unknown;
  try {
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    });
  } catch {
    return { elements: [], childComponents: [] };
  }

  const funcMap = buildFunctionMap(ast as AstNode);

  // 상태/setter 이름 수집 (자식 컴포넌트 prop 분류용)
  const stateNames = new Set<string>();
  const setterNames = new Set<string>();
  for (const comp of result.components) {
    for (const hook of comp.hooks) {
      if (hook.name === 'useState') {
        if (hook.stateVar) stateNames.add(hook.stateVar);
        if (hook.setterVar) setterNames.add(hook.setterVar);
      }
    }
  }

  const elements: UiElement[] = [];
  const childComponents: ChildComponentInfo[] = [];
  const seenChildren = new Map<string, ChildComponentInfo>();

  traverseAst(ast, (node) => {
    if (node.type !== 'JSXElement') return;
    const opening: AstNode = node.openingElement;
    if (!opening) return;

    const tagName = getJsxTagName(opening.name as AstNode);
    if (!tagName) return;

    const line: number = opening.loc?.start.line ?? 0;
    const attrs: AstNode[] = (opening.attributes as AstNode[]) ?? [];

    // ① 이벤트 핸들러가 있는 요소 → UI 인터랙션
    const eventAttrs = attrs.filter(
      (a) => a.type === 'JSXAttribute' && EVENT_PROPS.has(a.name?.name ?? ''),
    );
    if (eventAttrs.length > 0) {
      const component = findContainingComponent(line, result);
      const jsxText = getJsxText((node.children as unknown[]) ?? []);
      const nameAttr = getAttrStringValue(attrs, 'name');
      const placeholder = getAttrStringValue(attrs, 'placeholder');
      const typeAttr = getAttrStringValue(attrs, 'type');
      const ariaLabel = getAttrStringValue(attrs, 'aria-label');
      const title = getAttrStringValue(attrs, 'title');
      const textContent = jsxText || ariaLabel || title || nameAttr || placeholder || typeAttr;

      for (const eventAttr of eventAttrs) {
        const eventName: string = eventAttr.name?.name ?? '';
        const { expr: handlerExpr, actions } = getHandlerInfo(eventAttr, funcMap);
        const handlerLine = findHandlerLine(handlerExpr, result);
        elements.push({
          component, tagName, textContent, line,
          eventName, handlerExpr, handlerLine,
          handlerActions: actions.join(', '),
        });
      }
    }

    // ② PascalCase 태그 → 자식 컴포넌트 (props 플로우 분석)
    const isPascal = tagName[0] === tagName[0].toUpperCase() && tagName[0] !== tagName[0].toLowerCase();
    if (isPascal && tagName !== 'Fragment') {
      const parent = findContainingComponent(line, result);
      const propAttrs = attrs.filter((a: AstNode) => a.type === 'JSXAttribute' && a.name?.name);

      const stateProps: string[] = [];
      const callbackProps: string[] = [];
      const otherProps: string[] = [];

      for (const attr of propAttrs) {
        const propName = attr.name.name as string;
        if (EVENT_PROPS.has(propName)) continue; // 이벤트는 위에서 이미 처리
        const val = attr.value;

        if (val?.type === 'JSXExpressionContainer') {
          const expr = val.expression;
          if (expr?.type === 'Identifier') {
            const valName = expr.name as string;
            if (stateNames.has(valName)) {
              stateProps.push(propName);
            } else if (setterNames.has(valName) || funcMap.has(valName)) {
              callbackProps.push(propName);
            } else {
              otherProps.push(propName);
            }
          } else {
            otherProps.push(propName);
          }
        } else {
          otherProps.push(propName);
        }
      }

      // 같은 컴포넌트 중복 → props 병합
      const existing = seenChildren.get(tagName);
      if (existing) {
        for (const p of stateProps) if (!existing.stateProps.includes(p)) existing.stateProps.push(p);
        for (const p of callbackProps) if (!existing.callbackProps.includes(p)) existing.callbackProps.push(p);
        for (const p of otherProps) if (!existing.otherProps.includes(p)) existing.otherProps.push(p);
      } else {
        const info: ChildComponentInfo = { parent, name: tagName, line, stateProps, callbackProps, otherProps };
        seenChildren.set(tagName, info);
        childComponents.push(info);
      }
    }
  });

  return { elements, childComponents };
}

// 하위호환
export function extractUiElements(source: string, result: AnalysisResult): UiElement[] {
  return extractUiMap(source, result).elements;
}

// ── 이야기 생성 헬퍼 ─────────────────────────────────────────

function describeState(varName: string): string {
  if (/^is[A-Z]/.test(varName)) {
    const rest = varName.slice(2);
    return `${rest} 상태 (켜짐/꺼짐 스위치)`;
  }
  if (/^has[A-Z]/.test(varName)) return `${varName.slice(3)} 있는지 여부`;
  if (/^selected/i.test(varName)) return `사용자가 고른 ${varName.replace(/^selected/i, '')} 값`;
  if (/Loading$/i.test(varName)) return '지금 로딩 중인지 (스피너 표시용)';
  if (/Error$/i.test(varName)) return '에러가 있으면 여기에 저장';
  if (/Key$/i.test(varName) || /Trigger$/i.test(varName)) return '바뀌면 화면을 새로고침하는 신호';
  if (/Count$/i.test(varName) || /Total$/i.test(varName)) return '숫자/개수 저장';
  if (/Id$/i.test(varName)) return 'ID값 저장 (어떤 항목인지 식별)';
  return `${varName} 데이터 저장소`;
}

function describeEffect(deps: string | undefined): string {
  if (!deps || deps === '[]' || deps === '없음') return '화면이 처음 열릴 때 1번만 실행';
  const clean = deps.replace(/[\[\]]/g, '').split(',').map(d => d.trim()).filter(Boolean);
  if (clean.length === 1) return `${clean[0]} 값이 바뀔 때마다 자동 재실행`;
  return `${clean.join(' 또는 ')} 중 하나라도 바뀌면 자동 재실행`;
}

function describeElement(tagName: string, textContent: string): string {
  const text = textContent ? ` "${textContent}"` : '';
  const t = tagName.toLowerCase();
  if (t === 'button') return `🔘 버튼${text}`;
  if (t === 'select') return `📋 드롭다운 선택창${text}`;
  if (t === 'input') return `✏️ 입력칸${text}`;
  if (t === 'textarea') return `📝 텍스트 입력영역${text}`;
  if (t === 'form') return `📄 입력 폼${text}`;
  if (t === 'a' || t === 'link') return `🔗 링크${text}`;
  return `${tagName}${text}`;
}

function describeTrigger(eventName: string, tagName: string): string {
  const t = tagName.toLowerCase();
  if (eventName === 'onClick') {
    if (t === 'button') return '이 버튼을 누르면';
    if (t === 'a' || t === 'link') return '이 링크를 누르면';
    return '여기를 클릭하면';
  }
  if (eventName === 'onChange') {
    if (t === 'select') return '다른 항목을 고르면';
    if (t === 'input' || t === 'textarea') return '내용을 입력하면';
    return '값을 바꾸면';
  }
  if (eventName === 'onSubmit') return '제출(Enter) 하면';
  if (eventName === 'onKeyDown') return '키보드를 누르면';
  if (eventName === 'onBlur') return '다른 곳을 클릭하면';
  if (eventName === 'onFocus') return '여기를 클릭하면';
  if (eventName === 'onMouseEnter') return '마우스를 올리면';
  if (eventName === 'onMouseLeave') return '마우스를 빼면';
  return eventName;
}

function describeActions(actions: string): string {
  if (!actions) return '';
  const parts = actions.split(', ').filter(p => !p.startsWith('  →'));

  const results: string[] = [];
  const stateChanges = parts.filter(p => p.endsWith('변경')).map(p => p.replace(' 변경', ''));
  const hasAsync = parts.some(p => p === '[비동기]');
  const funcCalls = parts.filter(p => p.endsWith('()')).map(p => p.replace('()', ''));
  const hasToast = parts.some(p => p.startsWith('toast'));
  const hasNav = parts.some(p => p === '페이지 이동');

  if (hasAsync) results.push('⏳ 서버에 데이터 보냄 (기다림)');
  if (hasNav) results.push('📍 다른 페이지로 이동');
  if (hasToast) results.push('💬 알림 메시지 표시');
  for (const fn of funcCalls.filter(f => !f.startsWith('toast') && !f.startsWith('setTimeout'))) {
    results.push(`⚙️ ${fn} 함수 실행`);
  }
  if (stateChanges.length > 0) {
    if (stateChanges.length <= 3) {
      results.push(`🔄 ${stateChanges.join(', ')} 값이 바뀜`);
    } else {
      results.push(`🔄 ${stateChanges.length}개 값이 한꺼번에 바뀜 (${stateChanges.slice(0, 2).join(', ')} 등)`);
    }
  }
  return results.join(' → ');
}

function describeChild(c: ChildComponentInfo): string {
  const parts: string[] = [];
  if (c.stateProps.length > 0) parts.push(`데이터 ${c.stateProps.length}개를 받아서 보여줌`);
  if (c.callbackProps.length > 0) parts.push(`이벤트 ${c.callbackProps.length}개를 부모에게 알려줌`);
  if (parts.length === 0) return '화면의 한 부분을 담당';
  return parts.join(', ');
}

// ── CSV 생성 (기본) ──────────────────────────────────────────

export function generateCsv(elements: UiElement[]): string {
  const BOM = '\uFEFF';
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const HEADERS = ['컴포넌트', '요소타입', '텍스트/라벨', '줄번호', '이벤트', '핸들러', '핸들러줄', '핸들러 동작'];
  const rows = elements.map((el) => [
    el.component, el.tagName, el.textContent, String(el.line),
    el.eventName, el.handlerExpr,
    el.handlerLine > 0 ? String(el.handlerLine) : '-',
    el.handlerActions,
  ]);
  return BOM + [HEADERS, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}

// ── CSV 생성 (화면 인터랙션 스토리) ──────────────────────────

export function generateFullMapCsv(
  elements: UiElement[],
  result: AnalysisResult,
  childComponents: ChildComponentInfo[],
): string {
  const BOM = '\uFEFF';
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows: string[][] = [];

  // ── 챕터 1: 이 화면이 기억하는 것들 ──
  const states = result.components.flatMap(comp =>
    comp.hooks.filter(h => h.name === 'useState' && h.stateVar).map(h => ({ comp: comp.name, hook: h })),
  );
  if (states.length > 0) {
    rows.push(['', '', '', '', '', '']);
    rows.push(['🧠 Chapter 1', `이 화면이 기억하는 것들 (총 ${states.length}개)`, '', '', '', '']);
    rows.push(['이름', '설명', '바꾸는 함수', '줄번호', '', '']);
    for (const { hook } of states) {
      rows.push([
        hook.stateVar!,
        describeState(hook.stateVar!),
        hook.setterVar || '',
        String(hook.line),
        '', '',
      ]);
    }
  }

  // ── 챕터 2: 자동으로 일어나는 일 ──
  const effects = result.components.flatMap(comp =>
    comp.hooks.filter(h => h.name === 'useEffect').map(h => ({ comp: comp.name, hook: h })),
  );
  if (effects.length > 0) {
    rows.push(['', '', '', '', '', '']);
    rows.push(['⚡ Chapter 2', `화면이 자동으로 하는 일 (총 ${effects.length}개)`, '', '', '', '']);
    rows.push(['언제 실행?', '감시 대상', '줄번호', '', '', '']);
    for (const { hook } of effects) {
      rows.push([
        describeEffect(hook.deps),
        hook.deps || '없음 (1회)',
        String(hook.line),
        '', '', '',
      ]);
    }
  }

  // ── 챕터 3: 사용자가 할 수 있는 것들 ──
  if (elements.length > 0) {
    rows.push(['', '', '', '', '', '']);
    rows.push(['👆 Chapter 3', `사용자가 할 수 있는 것들 (총 ${elements.length}개)`, '', '', '', '']);
    rows.push(['화면 요소', '언제?', '그러면 무슨 일이?', '핸들러 이름', '줄번호', '핸들러 줄']);
    for (const el of elements) {
      rows.push([
        describeElement(el.tagName, el.textContent),
        describeTrigger(el.eventName, el.tagName),
        describeActions(el.handlerActions),
        el.handlerExpr,
        String(el.line),
        el.handlerLine > 0 ? String(el.handlerLine) : '-',
      ]);
    }
  }

  // ── 챕터 4: 화면을 구성하는 부품들 ──
  if (childComponents.length > 0) {
    rows.push(['', '', '', '', '', '']);
    rows.push(['🧩 Chapter 4', `이 화면을 구성하는 부품들 (총 ${childComponents.length}개)`, '', '', '', '']);
    rows.push(['부품 이름', '역할', '받는 데이터', '알려주는 이벤트', '줄번호', '']);
    for (const c of childComponents) {
      rows.push([
        c.name,
        describeChild(c),
        c.stateProps.join(', ') || '-',
        c.callbackProps.join(', ') || '-',
        String(c.line),
        '',
      ]);
    }
  }

  // ── 챕터 5: 한눈에 보는 데이터 흐름 ──
  if (childComponents.length > 0 && states.length > 0) {
    rows.push(['', '', '', '', '', '']);
    rows.push(['🌊 Chapter 5', '데이터가 흘러가는 길', '', '', '', '']);
    rows.push(['출발', '→', '도착', '전달 데이터', '', '']);
    for (const c of childComponents) {
      if (c.stateProps.length > 0) {
        for (const prop of c.stateProps) {
          rows.push([
            `${c.parent} (상태: ${prop})`, '→', `${c.name} (props)`, `${prop} 값 전달`, '', '',
          ]);
        }
      }
      if (c.callbackProps.length > 0) {
        for (const cb of c.callbackProps) {
          rows.push([
            `${c.name} (이벤트)`, '→', `${c.parent} (핸들러)`, `${cb} 콜백 호출`, '', '',
          ]);
        }
      }
    }
  }

  return BOM + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

// ── 다운로드 ─────────────────────────────────────────────────

export function downloadCsv(csv: string, fileName: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
