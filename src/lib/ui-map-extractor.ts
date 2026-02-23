import { parse } from '@babel/parser';
import type { AnalysisResult } from './parser';

export interface UiElement {
  component: string;
  tagName: string;
  textContent: string;
  line: number;
  eventName: string;
  handlerExpr: string;
  handlerLine: number;
}

const TARGET_TAGS = new Set(['button', 'input', 'a', 'select', 'textarea', 'form', 'Link']);
const EVENT_PROPS = new Set([
  'onClick', 'onChange', 'onSubmit', 'onKeyDown', 'onKeyUp', 'onBlur', 'onFocus',
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AstNode = Record<string, any>;

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
  }
  return '';
}

function getHandlerExpr(attr: AstNode): string {
  const val = attr.value;
  if (!val || val.type !== 'JSXExpressionContainer') return '';
  const expr = val.expression;
  if (!expr) return '';
  if (expr.type === 'Identifier') return expr.name as string;
  if (expr.type === 'MemberExpression') {
    return `${expr.object?.name}.${expr.property?.name}`;
  }
  if (expr.type === 'ArrowFunctionExpression' || expr.type === 'FunctionExpression') {
    const body = expr.body;
    if (body?.type === 'CallExpression' && body.callee?.type === 'Identifier') {
      return body.callee.name as string;
    }
    return '익명함수';
  }
  if (expr.type === 'CallExpression' && expr.callee?.type === 'Identifier') {
    return expr.callee.name as string;
  }
  return '';
}

function findContainingComponent(line: number, result: AnalysisResult): string {
  for (const comp of result.components) {
    if (comp.startLine <= line && line <= comp.endLine) return comp.name;
  }
  return 'Unknown';
}

function findHandlerLine(handlerExpr: string, result: AnalysisResult): number {
  if (!handlerExpr || handlerExpr === '익명함수') return 0;
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

export function extractUiElements(source: string, result: AnalysisResult): UiElement[] {
  let ast: unknown;
  try {
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    });
  } catch {
    return [];
  }

  const elements: UiElement[] = [];

  traverseAst(ast, (node) => {
    if (node.type !== 'JSXElement') return;
    const opening: AstNode = node.openingElement;
    if (!opening) return;

    const tagName = getJsxTagName(opening.name as AstNode);
    if (!TARGET_TAGS.has(tagName)) return;

    const line: number = opening.loc?.start.line ?? 0;
    const component = findContainingComponent(line, result);
    const attrs: AstNode[] = (opening.attributes as AstNode[]) ?? [];

    const jsxText = getJsxText((node.children as unknown[]) ?? []);
    const nameAttr = getAttrStringValue(attrs, 'name');
    const placeholder = getAttrStringValue(attrs, 'placeholder');
    const typeAttr = getAttrStringValue(attrs, 'type');
    const textContent = jsxText || nameAttr || placeholder || typeAttr;

    for (const attr of attrs) {
      if (attr.type !== 'JSXAttribute') continue;
      const eventName: string = attr.name?.name ?? '';
      if (!EVENT_PROPS.has(eventName)) continue;

      const handlerExpr = getHandlerExpr(attr);
      const handlerLine = findHandlerLine(handlerExpr, result);
      elements.push({ component, tagName, textContent, line, eventName, handlerExpr, handlerLine });
    }
  });

  return elements;
}

const CSV_HEADERS = ['컴포넌트', '요소타입', '텍스트/name', '줄번호', '이벤트', '핸들러', '핸들러줄'];

export function generateCsv(elements: UiElement[]): string {
  const BOM = '\uFEFF';
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = elements.map((el) => [
    el.component,
    el.tagName,
    el.textContent,
    String(el.line),
    el.eventName,
    el.handlerExpr,
    el.handlerLine > 0 ? String(el.handlerLine) : '-',
  ]);
  const content = [CSV_HEADERS, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  return BOM + content;
}

export function downloadCsv(csv: string, fileName: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
