---
name: srcxray-components
description: src/components/ UI 컴포넌트 관련 작업 시 적용. Use when creating, modifying, or reviewing analysis result display components.
---

# SrcXray Components Skill

## 컴포넌트 목록

| 파일 | 역할 | 주요 Props |
|------|------|-----------|
| `CodeInput.tsx` | 파일 업로드 / 코드 직접 입력 | `onAnalyze: (code: string) => void` |
| `ComponentTree.tsx` | 컴포넌트 구조 트리 표시 | `components: ComponentInfo[]` |
| `ImportMap.tsx` | Import 분류 지도 | `imports: ImportInfo[]` |
| `FunctionList.tsx` | 함수 및 훅 목록 | `functions: FunctionInfo[]` |
| `LearningGuide.tsx` | 10분 학습 가이드 | `guide: GuideSection[]` |

## 공통 규칙

### 1. `'use client'` 지시어 필수

```tsx
'use client';

import React from 'react';
// ...
```

### 2. TypeScript 엄격 모드

```tsx
// ❌ any 사용 금지
const data: any = ...

// ✅ 구체적인 타입 정의
interface ComponentInfo {
  name: string;
  props: string[];
  hooks: string[];
  jsxTags: string[];
}
```

### 3. Tailwind CSS 4 클래스 패턴

```tsx
// 카드 컨테이너
<div className="rounded-lg border bg-white p-4 shadow-sm">

// 섹션 헤더
<h2 className="text-lg font-semibold text-gray-900">

// 코드/배지
<span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-sm">

// 빈 상태
<div className="flex flex-col items-center justify-center py-12 text-gray-400">
```

### 4. 빈 상태 처리 (필수)

```tsx
if (!data || data.length === 0) {
  return (
    <div className="py-8 text-center text-sm text-gray-400">
      분석할 코드를 입력하세요
    </div>
  );
}
```

## 컴포넌트 신규 생성 체크리스트

- [ ] `'use client'` 선언
- [ ] Props 타입 인터페이스 정의
- [ ] 빈 상태(empty state) 처리
- [ ] 로딩 상태 표시 (필요 시)
- [ ] `page.tsx`에서 import 및 렌더링 연결

## CodeInput 패턴

파일 드래그앤드롭과 직접 붙여넣기 두 가지 방식을 모두 지원:

```tsx
// 파일 읽기
const handleFileUpload = (file: File) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const code = e.target?.result as string;
    onAnalyze(code);
  };
  reader.readAsText(file);
};
```
