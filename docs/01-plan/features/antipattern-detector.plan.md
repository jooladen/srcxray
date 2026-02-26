# Plan: Anti-Pattern Detector (데이터 드리븐)

> 기능명: `antipattern-detector`
> 작성일: 2026-02-26
> 상태: Draft

## 1. 목표

소스 코드가 로딩되면 **"절대 해서는 안 되는" React/JS 안티패턴**을 자동 감지하여 경고한다.
기존 `danger-detector.ts`의 하드코딩된 5개 규칙을 **JSON 데이터 기반**으로 전환하여,
새로운 안티패턴을 코드 수정 없이 JSON만 추가해서 확장할 수 있도록 한다.

## 2. 핵심 컨셉

### 현재 문제
- `danger-detector.ts`에 5개 규칙이 하드코딩 → 새 규칙 추가 시 코드 수정 필요
- 치명적(CRITICAL) 수준의 "절대 금지" 패턴이 없음 (현재 최고 레벨: high)

### 해결 방향
- `antipatterns.json` 파일에 안티패턴 규칙을 정의
- 각 규칙은 **패턴 매칭 조건** + **설명** + **심각도** 포함
- `critical` 레벨 신설 → 빨간색 강조 + "절대 하지 마세요" 톤

## 3. 요구사항

### AP-01: antipatterns.json 데이터 파일
- `src/data/antipatterns.json`에 모든 안티패턴 규칙 정의
- 각 규칙 구조:
  ```json
  {
    "id": "fetch-in-usememo",
    "level": "critical",
    "category": "hooks",
    "pattern": { "type": "regex", "value": "useMemo\\s*\\(.*\\bfetch\\b" },
    "context": { "type": "hook-body", "hookName": "useMemo" },
    "title": "useMemo 안에서 데이터 fetch 금지",
    "why": "useMemo는 렌더링 중 동기적으로 실행됩니다. fetch는 비동기 사이드이펙트이므로 useEffect에서 해야 합니다.",
    "fix": "useEffect + useState 조합으로 데이터를 fetch하세요",
    "emoji": "🚨"
  }
  ```

### AP-02: 초기 안티패턴 목록 (최소 15개)

**CRITICAL (절대 금지)**:
| ID | 패턴 | 설명 |
|----|-------|------|
| `fetch-in-usememo` | useMemo 안에서 fetch/axios/api 호출 | useMemo는 동기 계산 전용 |
| `fetch-in-render` | 컴포넌트 본문에서 직접 fetch | 매 렌더링마다 요청 발생 |
| `setstate-in-render` | 컴포넌트 본문에서 직접 setState | 무한 렌더링 루프 |
| `mutate-state-direct` | state 객체/배열 직접 변경 (push, splice, obj.key=) | React가 변경 감지 불가 |
| `hooks-in-condition` | if/for/while 안에서 Hook 호출 | Hook 호출 순서 보장 위반 |
| `hooks-in-callback` | 이벤트핸들러/콜백 안에서 Hook 호출 | Hook은 최상위에서만 호출 가능 |

**HIGH (매우 위험)**:
| ID | 패턴 | 설명 |
|----|-------|------|
| `async-effect` | useEffect(async () => ...) | 클린업 불가, 메모리 누수 |
| `infinite-loop` | useEffect + setState + deps 없음 | 무한 렌더링 루프 |
| `useeffect-missing-deps` | useEffect 안에서 외부 변수 사용 + deps에 미포함 | 스테일 클로저 |
| `dangerously-set-html` | dangerouslySetInnerHTML 사용 | XSS 공격 취약 |

**MEDIUM (위험)**:
| ID | 패턴 | 설명 |
|----|-------|------|
| `map-no-key` | .map() JSX에 key 없음 | 잘못된 업데이트 |
| `index-as-key` | key={index} 사용 | 리스트 변경 시 버그 |
| `object-literal-in-jsx` | style={{...}} 또는 prop={{...}} 인라인 | 매 렌더링 새 참조 → 불필요한 리렌더 |
| `useeffect-as-derived` | useEffect로 파생 상태 계산 | useMemo로 대체 가능 |
| `prop-drilling-deep` | 3단계 이상 props 전달 | Context나 상태관리 라이브러리 권장 |

**LOW (개선 권장)**:
| ID | 패턴 | 설명 |
|----|-------|------|
| `console-log` | console.log/warn/error 잔존 | 배포 코드에 불필요 |
| `too-many-states` | useState 5개 이상 | 커스텀 훅 분리 권장 |
| `any-type` | : any 타입 사용 | 타입 안전성 저하 |

### AP-03: 기존 danger-detector.ts 리팩터링
- 하드코딩된 5개 규칙 → `antipatterns.json` 데이터로 이전
- `detectDangers()` 함수를 JSON 규칙 기반 엔진으로 변환
- 기존 `DangerItem` 인터페이스에 `level: 'critical'` 추가
- 기존 DangerCard UI와 호환 유지

### AP-04: 패턴 매칭 엔진
- **regex**: 단순 정규식 매칭 (줄 단위)
- **ast-context**: AST 기반 매칭 (특정 Hook/함수 내부에서만 검사)
- **count**: 특정 패턴 등장 횟수 기반 (예: useState 5개 이상)
- JSON에서 `pattern.type`으로 매칭 전략 선택

### AP-05: UI 업그레이드
- `critical` 레벨: 빨간 배경 + "🚨 절대 금지" 배지
- 기존 `high/medium/low` 스타일 유지
- critical이 있으면 분석 결과 최상단에 경고 배너 표시

## 4. 파일 구조

```
src/
├── data/
│   └── antipatterns.json          # 안티패턴 규칙 데이터
├── lib/
│   └── danger-detector.ts         # 리팩터링 (JSON 기반 엔진)
└── components/
    └── DangerCard.tsx             # critical 레벨 UI 추가
```

## 5. 구현 순서

1. `src/data/antipatterns.json` 생성 (15+ 규칙)
2. `danger-detector.ts` 리팩터링 (JSON 로드 + 패턴 매칭 엔진)
3. `DangerCard.tsx` critical 레벨 UI 추가
4. 기존 5개 규칙 마이그레이션 검증
5. typecheck + lint + build 검증

## 6. 제약사항

- 오프라인 동작 유지 (JSON은 번들에 포함)
- 기존 `DangerItem` 인터페이스 하위 호환
- AST 파싱은 기존 `parser.ts` 결과 재활용 (추가 파싱 없음)

## 7. 성공 기준

- [ ] antipatterns.json에 최소 15개 규칙 정의
- [ ] 기존 5개 danger 규칙이 JSON 기반으로 동일하게 동작
- [ ] critical 레벨 UI가 시각적으로 구분됨
- [ ] 새 규칙 추가 시 JSON만 수정하면 동작
- [ ] pnpm typecheck && pnpm lint && pnpm build 통과
