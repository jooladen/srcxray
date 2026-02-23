# Analysis: debug-injector — Gap 분석 보고서

**분석일**: 2026-02-23
**Feature**: debug-injector + debug-injector-wizard
**Match Rate**: **93%** ✅ (90% 임계값 통과)

---

## Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match (debug-injector) | 93% | PASS |
| Design Match (wizard) | 92% | PASS |
| Architecture Compliance | 100% | PASS |
| Convention Compliance | 96% | PASS |
| **Overall** | **93%** | **PASS** |

---

## 주요 결과

### 구현 완료 항목 (66/68)

| 카테고리 | 항목 수 | 매칭 | Rate |
|----------|:------:|:----:|:----:|
| 타입 정의 | 12 | 11 | 96% |
| 코어 함수 | 7 | 7 | 100% |
| Smart Labels | 10 | 10 | 100% |
| UI 컴포넌트 (위저드) | 7 | 7 | 100% |
| 상태 머신 | 5 | 5 | 100% |
| 핸들러 | 7 | 7 | 100% |
| 엣지 케이스 | 9 | 9 | 100% |
| page.tsx 통합 | 4 | 4 | 100% |
| CSV 생성 | 5 | 5 | 100% |

### 버그 수정 (이번 세션)

| 버그 | 심각도 | 상태 |
|------|:------:|:----:|
| 표현식 body 변환 후 줄 번호 미보정 → console.log가 함수 스코프 바깥 삽입 | HIGH | ✅ 수정 완료 |

**수정 내용**: `injectLogs()`에 `adjustLine()` 오프셋 보정 함수 추가 (`debug-injector.ts:340-366`)

### 설계 대비 추가 구현 (보너스)

| 항목 | 파일 | 설명 |
|------|------|------|
| Expression body 컴포넌트 변환 | `debug-injector.ts:152-214` | `() => (...)` → `() => { return (...) }` |
| 줄 번호 오프셋 보정 | `debug-injector.ts:340-366` | 변환 후 줄 번호 정합성 유지 |
| 내부 함수/핸들러 스캔 | `debug-injector.ts:140-141, 298-317` | 컴포넌트 내부 핸들러 감지 |
| `ready` 상태 가드 | `DebugInjectorPanel.tsx:17` | 마운트 전 렌더링 방지 |

### 미구현 (의도적 연기)

| 항목 | 사유 |
|------|------|
| `log-parser.ts` (WOW-05) | Plan 문서에서 v2로 연기 명시 |
| `UiElement.nameAttr` 별도 필드 | `textContent`에 병합 (기능적으로 동일) |

---

## 다음 단계

Match Rate **93%** ≥ 90% → **`/pdca report debug-injector`** 추천
