---
name: srcxray-parser
description: src/lib/parser.ts AST 파싱 엔진 관련 작업 시 적용. Use when working with Babel AST parsing, adding new extraction functions, or debugging parser issues.
---

# SrcXray Parser Skill

## 핵심 파일

- `src/lib/parser.ts` — 모든 AST 파싱 로직의 진원지

## 의존성

```typescript
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
```

## @babel/parser 설정 패턴

```typescript
const ast = parser.parse(code, {
  sourceType: 'module',
  plugins: [
    'typescript',
    'jsx',
    'decorators-legacy',
    'classProperties',
  ],
});
```

## Babel AST 타입 처리 패턴

### 안전한 타입 캐스팅

```typescript
// ❌ 직접 캐스팅 (오류 발생 가능)
const node = path.node as t.FunctionDeclaration;

// ✅ as unknown as T 패턴 (권장)
const node = path.node as unknown as t.FunctionDeclaration;
```

### 노드 타입 가드

```typescript
if (t.isIdentifier(node)) {
  // node.name 접근 가능
}

if (t.isStringLiteral(node)) {
  // node.value 접근 가능
}
```

## 주요 분석 함수 패턴

### Import 추출

```typescript
traverse(ast, {
  ImportDeclaration(path) {
    const source = path.node.source.value;
    const isExternal = !source.startsWith('.');
    // 분류 로직
  }
});
```

### 컴포넌트 감지

```typescript
// React 컴포넌트 = 대문자로 시작하는 함수 + JSX 반환
traverse(ast, {
  FunctionDeclaration(path) {
    const name = path.node.id?.name;
    const startsWithUpper = name && /^[A-Z]/.test(name);
    // JSX 반환 여부 확인
  }
});
```

### Hooks 추출

```typescript
// use로 시작하는 함수 호출 = Hook
traverse(ast, {
  CallExpression(path) {
    const callee = path.node.callee;
    if (t.isIdentifier(callee) && callee.name.startsWith('use')) {
      // Hook 발견
    }
  }
});
```

## 디버깅 팁

- AST 구조 확인: [AST Explorer](https://astexplorer.net/) 활용
- 파싱 오류 시: `plugins` 배열에 필요한 플러그인 추가
- 타입 오류 시: `@babel/types` 의 타입 가드 함수 활용

## 성능 고려사항

- 500줄+ 파일: traverse 순회 횟수 최소화
- 여러 분석을 한 번의 traverse로 처리 (단일 visitor 패턴)
