# Changelog

All notable changes to this project will be documented in this file.

---

## [2026-02-23] - debug-injector: Console.log 자동 주입기 완성 (95% Match)

### Added
- **F-01: 토글 버튼 UI** — 원본/주입/애니메이션 3단계 모드 전환
- **F-02: Log 주입 엔진** — AST 기반 마커 블록 삽입 (props, state, effect, handler, render)
- **F-03: 상태 관리** — Mode, injectedSource, breakdown 저장 (원본 절대 변경 안 함)
- **F-04: 원클릭 원복** — [원본으로 복귀] 버튼으로 즉시 원복 (재계산 없음)
- **F-05: 원본 백업 다운로드** — `.original.tsx` 파일 다운로드 기능
- **WOW-01: 실행 순서 예측** — Mount/Update 단계 시각화 (1️⃣~🔟 이모지)
- **WOW-02: 스마트 한국어 라벨** — 변수명 패턴 자동 분석 (10개 카테고리)
- **WOW-03: 카운트업 애니메이션** — 주입 진행 상황 시각화 (requestAnimationFrame easing)
- **WOW-04: 사용 가이드** — Step 1~5 단계별 안내
- **신규 파일 2개**:
  - `src/lib/debug-injector.ts` (230 LOC) — 주입 엔진, 스마트 라벨, 실행순서 예측
  - `src/components/DebugInjectorPanel.tsx` (273 LOC) — UI 패널, 상태 관리, 애니메이션

### Changed
- `src/app/page.tsx`: DebugInjectorPanel dynamic import + Stats 아래 렌더링 (+3 LOC)

### Quality Metrics
- **Design Match Rate**: 95% (32/35 완전 일치, 3개 v2 보류)
- **Architecture Compliance**: 100%
- **Type Coverage**: 100% (3 interfaces + 1 type alias)
- **New Lines of Code**: 503 LOC (신규 2파일)
- **Iterations Required**: 0 (>=90% 기준 초과 충족)
- **Browser Compatibility**: Modern browsers (Chrome, Firefox, Safari, Edge)

### Implementation Details
- **마커 블록**: `// @@SRCXRAY-START/END` 기반 안전한 원복
- **역순 삽입**: 뒤에서부터 삽입으로 줄번호 밀림 방지 (O(n log n))
- **스마트 라벨**: 10개 변수명 패턴 (켜짐/꺼짐, 카운터, 인증, 데이터, 에러 등)
- **실행 순서**: Mount (props → state → render → effect) → Update (state change)
- **Easing 애니메이션**: 3차 함수로 자연스러운 진행 상황 표시
- **Lazy Loading**: Dynamic import로 번들 크기 영향 없음

### Deferred to v2
- WOW-05: 로그 결과 붙여넣기 → 타임라인 시각화 (Plan에서 v2 명시)
- log-parser.ts (WOW-05 의존)

### References
- **Plan**: [docs/01-plan/features/debug-injector.plan.md](../01-plan/features/debug-injector.plan.md)
- **Design**: [docs/02-design/features/debug-injector.design.md](../02-design/features/debug-injector.design.md)
- **Analysis**: [docs/03-analysis/debug-injector.analysis.md](../03-analysis/debug-injector.analysis.md)
- **Report**: [docs/04-report/features/debug-injector.report.md](./features/debug-injector.report.md)

---

## [2026-02-23] - zero-script-qa: Parser QA & Bug Fixes Complete (100% Pass Rate)

### Added
- **3-Cycle QA Testing Framework**:
  - Cycle 1: 9 unit tests for AST pattern handling
  - Cycle 2: 30 integration tests for hook detection
  - Cycle 3: 25 real-world validation tests on page.tsx
- **New Parser Functions**:
  - `extractParamName()` — Individual parameter name extraction
  - `extractParamNames()` — Multi-pattern support (ObjectPattern, AssignmentPattern, RestElement, ArrayPattern)
- **Enhanced Hook Detection**:
  - ExpressionStatement case handling in `extractHooksFromBody()`
  - Support for standalone hook calls: `useEffect(...)`, `useLayoutEffect(...)`, etc.
- **Improved Risk Detection**:
  - Line number aggregation for async-effect patterns
  - Multiple occurrence tracking in single DangerItem

### Fixed
- **BUG-001 (HIGH)**: Destructured props not extracted from components
  - Root cause: ObjectPattern AST nodes not handled
  - Files: src/lib/parser.ts
  - Solution: Comprehensive `extractParamNames()` supporting all destructuring variants
  - Impact: Component tree now shows complete prop information

- **BUG-002 (MEDIUM)**: Async-effect deduplication losing line information
  - Root cause: All async effects received identical issue ID
  - Files: src/lib/danger-detector.ts
  - Solution: Aggregated line numbers in single DangerItem
  - Impact: Complete async-effect tracking across file

- **BUG-003 (LOW)**: Clipboard copy error handling missing
  - Root cause: No try-catch for clipboard API
  - Files: src/components/TldrCard.tsx
  - Solution: Error handling with graceful degradation
  - Impact: Improved UX in restricted environments

- **BUG-004 (HIGH)**: useEffect standalone calls not detected
  - Root cause: Only processed VariableDeclaration, not ExpressionStatement
  - Files: src/lib/parser.ts
  - Solution: Added ExpressionStatement case handler
  - Impact: All hook patterns now correctly parsed in FlowDiagram, HookCards, LearningGuide

### Changed
- `src/lib/parser.ts`:
  - Added `extractParamName()` and `extractParamNames()` functions
  - Updated 6 extraction points to use new functions
  - Enhanced `extractHooksFromBody()` with ExpressionStatement support
  - Estimated +50 LOC

- `src/lib/danger-detector.ts`:
  - Modified async-effect aggregation logic
  - Estimated +20 LOC

- `src/components/TldrCard.tsx`:
  - Added try-catch wrapper for clipboard operations
  - Estimated +10 LOC

### Quality Metrics
- **Test Pass Rate**: 100% (64/64 tests passed)
  - Cycle 1: 9/9 ✅
  - Cycle 2: 30/30 ✅
  - Cycle 3: 25/25 ✅
- **Bug Resolution Rate**: 100% (4/4 bugs fixed)
- **Build Status**: Success ✅
- **Lint Status**: Clean ✅
- **Regression Testing**: 0 issues detected

### Bugs Fixed
1. BUG-001 (HIGH): Destructured Props Not Extracted — src/lib/parser.ts
2. BUG-002 (MEDIUM): Async-Effect Deduplication Bug — src/lib/danger-detector.ts
3. BUG-003 (LOW): Clipboard Copy Error Handling — src/components/TldrCard.tsx
4. BUG-004 (HIGH): useEffect Standalone Calls Not Detected — src/lib/parser.ts

### Testing Summary
- **Total Test Cases**: 64 (3 cycles)
- **AST Pattern Tests**: 15 ✅
- **Hook Detection Tests**: 18 ✅
- **Dependency Parsing Tests**: 12 ✅
- **Component Tree Tests**: 10 ✅
- **Risk Detection Tests**: 9 ✅

### Key Validation Scenarios
- Destructuring patterns (simple, nested, defaults, rest) ✅
- Hook declaration patterns (variable, expression statement) ✅
- Dependency array parsing ([], [single], [multiple]) ✅
- Integration with visualizations (FlowDiagram, HookCards, LearningGuide) ✅

### Files Modified
- src/lib/parser.ts (HIGH impact — core engine)
- src/lib/danger-detector.ts (MEDIUM impact — risk detection)
- src/components/TldrCard.tsx (LOW impact — UX)

### References
- **Report**: [docs/04-report/zero-script-qa.report.md](./zero-script-qa.report.md)

---

## [2026-02-23] - react-essentials Feature Complete (98% Match)

### Added
- **F-13: Danger Detector** — 5개 초보자 위험 패턴 감지 (async effect, missing key, infinite loop, too many states, console.log)
- **F-14: Essential Concepts Card** — 8개 React 필수 개념 자동 감지 및 카드 표시
- **F-15: useEffect Timeline** — useEffect 3가지 실행 시점 시각화
- **F-16: Master Checklist** — 난이도별 학습 체크리스트 (✅ 마스터 배너)
- **TldrCard 위험신호 뱃지** — 파일 요약 카드에 안전성 표시 (✅ 안전 / ⚠️ N개)
- **분석 페이지 탭 2개** — "위험신호"(⚠️) 탭, "필수 개념"(📖) 탭 추가
- **신규 파일 4개**:
  - `src/lib/danger-detector.ts` (180 LOC)
  - `src/lib/concept-finder.ts` (200 LOC)
  - `src/components/DangerCard.tsx` (100 LOC)
  - `src/components/ConceptCards.tsx` (270 LOC)

### Changed
- `src/lib/tldr.ts`: FileTldr 인터페이스에 `dangerCount: number` 필드 추가
- `src/components/TldrCard.tsx`: 위험신호 뱃지 렌더링 로직 추가 (+15 LOC)
- `src/app/page.tsx`: 탭 추가, 분석 파이프라인 확장, 상태 관리 추가 (+50 LOC)

### Quality Metrics
- **Design Match Rate**: 98% (체크리스트 8/8 통과)
- **Architecture Compliance**: 100%
- **New Lines of Code**: 750 LOC (신규 4파일)
- **Modified LOC**: +70 (기존 3파일)
- **Iterations Required**: 0 (>=90% 기준 충족)

### References
- **Plan**: [docs/01-plan/features/react-essentials.plan.md](../01-plan/features/react-essentials.plan.md)
- **Design**: [docs/02-design/features/react-essentials.design.md](../02-design/features/react-essentials.design.md)
- **Analysis**: [docs/03-analysis/react-essentials.analysis.md](../03-analysis/react-essentials.analysis.md)
- **Report**: [docs/04-report/features/react-essentials.report.md](./features/react-essentials.report.md)

---
