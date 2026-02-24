---
name: srcxray-testing
description: SrcXray 테스트 전략 및 검증 방법. Use when adding tests, verifying parser accuracy, or doing quality assurance.
---

# SrcXray Testing Skill

## 현재 테스트 상태

현재 공식 테스트 프레임워크 미설치. 다음 두 가지 방법으로 검증합니다.

## 방법 1: 수동 브라우저 테스트

개발 서버에서 실제 TSX 파일을 입력하여 분석 결과 확인.

```bash
pnpm dev  # http://localhost:3000
```

### 테스트 케이스 체크리스트

**기본 파싱**
- [ ] 빈 컴포넌트 파일
- [ ] Props가 있는 컴포넌트
- [ ] useState, useEffect 사용 컴포넌트
- [ ] 커스텀 훅 포함 컴포넌트

**Import 분류**
- [ ] `react`, `next/` → 외부 패키지
- [ ] `./`, `../`, `@/` → 내부 파일
- [ ] 카테고리 분류 정확도 (UI/상태관리/HTTP 등)

**컴포넌트 트리**
- [ ] 중첩 컴포넌트 트리 표시
- [ ] Props 목록 정확도
- [ ] Hooks 목록 정확도

**엣지 케이스**
- [ ] 500줄 이상 파일 — 파싱 완료 여부
- [ ] TypeScript 제네릭 포함 파일
- [ ] 동적 import 포함 파일

## 방법 2: 콘솔 디버그 테스트

`src/lib/parser.ts`에 간단한 테스트 코드 임시 추가:

```typescript
// 개발 중 임시 테스트 (커밋 전 제거)
if (process.env.NODE_ENV === 'development') {
  const testCode = `
    'use client';
    import React, { useState } from 'react';
    import styles from './styles.module.css';

    interface Props { title: string; }

    export default function TestComponent({ title }: Props) {
      const [count, setCount] = useState(0);
      return <div>{title}: {count}</div>;
    }
  `;
  console.log('테스트 파싱 결과:', parseCode(testCode));
}
```

## 테스트 프레임워크 추가 (권장)

향후 Vitest 추가를 권장합니다:

```bash
pnpm add -D vitest @vitejs/plugin-react
```

```typescript
// src/lib/parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseCode } from './parser';

describe('parseCode', () => {
  it('기본 컴포넌트를 파싱한다', () => {
    const code = `export default function App() { return <div />; }`;
    const result = parseCode(code);
    expect(result.components).toHaveLength(1);
    expect(result.components[0].name).toBe('App');
  });
});
```

## 빌드 검증 (필수)

테스트 외에 빌드 성공 여부로 품질 확인:

```bash
npx tsc --noEmit  # 타입 오류 0개
pnpm lint          # ESLint 오류 0개
pnpm build         # 빌드 성공
```
