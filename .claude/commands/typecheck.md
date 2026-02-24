# 타입체크

TypeScript 타입 오류를 검사합니다.

## 실행

```bash
npx tsc --noEmit
```

## 자주 발생하는 오류 패턴

- Babel AST 노드 타입 불일치 → `as unknown as T` 패턴 사용
- React 컴포넌트 props 타입 누락 → 명시적 인터페이스 정의
- 옵셔널 체이닝 필요 → `?.` 연산자 활용

## 오류 수정 후

타입 오류 수정 완료 시 `pnpm build`로 빌드 검증까지 진행합니다.
