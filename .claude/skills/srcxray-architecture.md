---
name: srcxray-architecture
description: SrcXray 전체 아키텍처 이해가 필요할 때 적용. Use when working on overall structure, folder layout, data flow, or adding new major features.
---

# SrcXray Architecture Skill

## 프로젝트 개요

**목적**: 왕초보 개발자가 500줄 이상의 React TSX 코드를 10분 안에 파악하도록 돕는 정적 분석 도구.

**핵심 원칙**: 브라우저에서 완전 오프라인 동작 — 코드가 외부로 절대 전송되지 않음.

## 폴더 구조

```
src/
├── app/
│   ├── page.tsx          # 메인 분석 페이지 (진입점)
│   ├── layout.tsx        # 루트 레이아웃
│   └── globals.css       # 전역 스타일
├── components/
│   ├── CodeInput.tsx     # 파일 업로드 / 코드 입력 UI
│   ├── ComponentTree.tsx # 컴포넌트 구조 시각화
│   ├── ImportMap.tsx     # import 분류 맵
│   ├── FunctionList.tsx  # 함수/훅 목록
│   └── LearningGuide.tsx # 10분 학습 가이드
└── lib/
    └── parser.ts         # 핵심 AST 파싱 엔진
```

## 데이터 흐름

```
사용자 입력 (파일 업로드 or 코드 직접 입력)
    ↓
CodeInput.tsx
    ↓
parser.ts (@babel/parser로 AST 파싱)
    ↓
분석 결과 객체 (imports, components, functions, guide)
    ↓
┌─────────────────────────────────────────┐
│ ComponentTree | ImportMap | FunctionList │
│              LearningGuide              │
└─────────────────────────────────────────┘
```

## 기술 스택

| 역할 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript + TSX |
| 스타일 | Tailwind CSS 4 |
| AST 파싱 | @babel/parser + @babel/traverse |
| 패키지 매니저 | pnpm |

## 핵심 설계 결정

1. **`'use client'` 전체 적용**: AST 파싱이 브라우저에서 이뤄지므로 모든 컴포넌트가 클라이언트 컴포넌트
2. **`as unknown as T` 패턴**: Babel AST 노드 타입과 TypeScript 타입 불일치를 안전하게 처리
3. **정적 분석만**: 런타임 실행 없이 소스코드 구조만 파악

## 새 기능 추가 시 체크리스트

- [ ] `parser.ts`에 분석 함수 추가
- [ ] 해당 결과를 표시할 컴포넌트 생성/수정
- [ ] `page.tsx`에서 상태 관리 및 컴포넌트 연결
- [ ] `'use client'` 지시어 확인
- [ ] 타입 정의 및 `as unknown as T` 패턴 적용
