# Analysis: debug-injector — Gap 분석 보고서 (v2)

**분석일**: 2026-02-24 (재분석)
**Feature**: debug-injector (DI-01 ~ DI-06)
**Match Rate**: **93%** ✅ (90% 임계값 통과)
**분석 대상 파일**: 4개 (총 2,085줄)

---

## Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| DI-01: injectLogs 핵심 엔진 | 98% | PASS |
| DI-02: Smart Labels (WOW-02) | 100% | PASS |
| DI-03: 실행 순서 예측 (WOW-01) | 100% | PASS |
| DI-04: UI Map Extractor + CSV | 100% | PASS |
| DI-05: 5단계 위저드 패널 | 82% | 주의 |
| DI-06: Expression Body 처리 | 100% | PASS |
| page.tsx 통합 | 95% | PASS |
| 엣지 케이스 처리 | 100% | PASS |
| 아키텍처 준수 | 100% | PASS |
| 컨벤션 준수 | 100% | PASS |
| **전체 매치율** | **93%** | **PASS** |

---

## 분석 대상 파일

| 파일 | 줄 수 | 역할 |
|------|:-----:|------|
| `src/lib/debug-injector.ts` | 501 | 주입 엔진 + 스마트 라벨 + 실행순서 예측 |
| `src/components/DebugInjectorPanel.tsx` | 497 | 5단계 위저드 UI |
| `src/lib/ui-map-extractor.ts` | 651 | UI 맵 추출 + CSV 생성 |
| `src/app/page.tsx` | 436 | 메인 페이지 통합 |

---

## 항목별 상세

### DI-01: 핵심 엔진 (98%)

| 설계 항목 | 구현 위치 | 상태 |
|-----------|-----------|:----:|
| `InjectionPoint` 타입 | `debug-injector.ts:3-7` | ✅ |
| `InjectionBreakdown` 타입 | `debug-injector.ts:9-15` | ✅ |
| `InjectionResult` 타입 | `debug-injector.ts:17-22` | ✅ |
| `ExecutionStep` 타입 | `debug-injector.ts:24-31` | ✅ |
| `SMART_LABELS` (10개) | `debug-injector.ts:34-45` | ✅ |
| `getSmartLabel()` | `debug-injector.ts:47-52` | ✅ |
| `makeMarker()` @@SRCXRAY 형식 | `debug-injector.ts:58-64` | ✅ |
| `buildInjectionPoints()` | `debug-injector.ts:231-320` | ✅ |
| `injectLogs()` 역순 정렬+splice | `debug-injector.ts:322-397` | ✅ |
| `removeInjectedLogs()` regex | `debug-injector.ts:399-410` | ✅ |
| `calcBreakdown()` | `debug-injector.ts:66-74` | ✅ |
| Set\<number\> dedup | `debug-injector.ts:234` | ✅ |
| `'use client'` 지시문 | 의도적 생략 (순수 로직) | ⚠️ |

### DI-02: Smart Labels (100%)

10개 패턴 모두 정규식·라벨 완전 일치.

### DI-03: 실행 순서 예측 (100%)

Mount: props → useState → render → useEffect 순서 완전 구현.
추가로 부모/자식 컴포넌트 분리 로직 구현 (설계 대비 개선).

### DI-04: UI Map + CSV (100%)

5개 Chapter (상태모델/이펙트/UI인터랙션/자식컴포넌트/데이터흐름) 완전 구현.
추가 이야기 생성 헬퍼(`describe*` 시리즈) 구현.

### DI-05: 위저드 패널 (82%) ← 가장 큰 차이

| 항목 | 설계 | 구현 | 영향 |
|------|------|------|------|
| 상태 관리 | 개별 useState 7개 | WizardState 단일 객체 | Low (개선) |
| 주입 시점 | 버튼 클릭 시 계산 | 마운트 시 사전 계산 | Medium (변경) |
| 카운트업 duration | 500ms | 700ms | Low |
| 컨테이너 색상 (주입 후) | 노란색 `border-yellow-400` | 파란색 `border-blue-400` | Medium |
| mode state | `'original' \| 'injected'` | 5단계 wizard step | High (변경) |
| 원본 복귀 | 상단 버튼, mode 전환 | Step 5 "처음으로", Step 1 리셋 | Low |

### DI-06: Expression Body (100%)

`findExprBodyConvertible()`, `applyExprBodyConversion()`, 줄 오프셋 보정, `removeInjectedLogs()` 복원 모두 완전 구현.

### page.tsx 통합 (95%)

dynamic import + `{ ssr: false }`, Stats 아래/탭 위 배치, 3개 props 전달 모두 일치.
`key={fileName + code.length}` 추가 (재분석 시 초기화 보장).

---

## 차이점 종합

### 누락 항목 (0개)

설계의 모든 핵심 요구사항이 빠짐없이 구현됨.

### 변경 항목 (6개)

| 항목 | 설계 | 구현 | 영향 |
|------|------|------|------|
| 상태 모델 | 개별 useState | WizardState 객체 | Low |
| 카운트업 시간 | 500ms | 700ms | Low |
| 컨테이너 색상 | 노란색 | 파란색 | Medium |
| 주입 시점 | 클릭 시 계산 | 사전 계산 | Medium |
| handleInject 구조 | dynamic import 내 계산 | useEffect 사전 계산 | Medium |
| 원본 복귀 | mode 전환 | Step 1 리셋 | Low |

### 추가 구현 (13개, 설계 대비 개선)

| 항목 | 파일 | 설명 |
|------|------|------|
| 마운트 시 사전 계산 | `DebugInjectorPanel.tsx:130-154` | UX 개선 |
| WizardState 단일 객체 | `DebugInjectorPanel.tsx:16-29` | 상태 관리 단순화 |
| `findBodyStartSplice()` | `debug-injector.ts:89-98` | `{` 스캔 정밀 탐색 |
| `findStatementEndSplice()` | `debug-injector.ts:108-121` | 다중 줄 선언 처리 |
| `findReturnSplice()` | `debug-injector.ts:221-229` | return 문 역방향 탐색 |
| 컴포넌트 내부 함수 스캔 | `debug-injector.ts:298-317` | INNER_ARROW_RE, INNER_FUNC_RE |
| 부모/자식 순서 분리 | `debug-injector.ts:418-434` | rootComps → childComps |
| [L:xxx] 줄번호 재보정 | `debug-injector.ts:379-389` | 주입 후 실제 줄번호 업데이트 |
| `key` prop | `page.tsx:347` | 재분석 시 초기화 보장 |
| `!state.ready` 가드 | `DebugInjectorPanel.tsx:223` | 사전 계산 전 null 반환 |
| ui-map-extractor 전체 | `ui-map-extractor.ts` (651줄) | CSV 5챕터 + 이야기 헬퍼 |
| `extractUiElements()` | `ui-map-extractor.ts:421-423` | 하위호환 API |
| 이야기 생성 헬퍼 | `ui-map-extractor.ts:427-515` | describe* 시리즈 |

### 미구현 (의도적 연기)

| 항목 | 사유 |
|------|------|
| `log-parser.ts` (WOW-05) | Plan 문서에서 v2로 연기 명시 |

---

## 성공 검증 기준 체크

| # | 기준 | 상태 |
|:-:|------|:----:|
| 1 | 파일 로드 → 패널 표시 (주입 없음) | ✅ |
| 2 | [Log 주입] → 카운트업 → 완료 | ✅ |
| 3 | 주입 완료 → 노란 테두리 + "주입됨" | ⚠️ 파란 테두리로 변경 |
| 4 | 실행 순서 예측 올바른 순서 | ✅ |
| 5 | 스마트 한국어 라벨 동작 | ✅ |
| 6 | [코드 복사] → 클립보드 복사 | ✅ |
| 7 | [원본 백업] → .original.tsx 다운로드 | ✅ |
| 8 | [원본으로 복귀] → 즉시 전환 | ⚠️ "처음으로" Step 1 리셋으로 변경 |
| 9 | 재분석 시 패널 상태 초기화 | ✅ |

---

## 결론

**매치율 93% ≥ 90% → PASS**

설계의 모든 핵심 기능(DI-01~DI-06)이 누락 없이 구현되었습니다. 차이점은 대부분 UX 개선(사전 계산, 위저드 구조화)과 코드 견고성 향상(정밀 위치 탐색, 내부 함수 스캔)에 해당합니다.

## 다음 단계

Match Rate **93%** ≥ 90% → **`/pdca report debug-injector`** 추천
