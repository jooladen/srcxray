# Changelog

All notable changes to this project will be documented in this file.

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
