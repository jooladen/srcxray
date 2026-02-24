# 빌드 검증

프로덕션 빌드가 성공하는지 확인합니다.

## 실행 순서

```bash
# 1. 타입체크
npx tsc --noEmit

# 2. 린트
pnpm lint

# 3. 프로덕션 빌드
pnpm build
```

## 빌드 실패 시

1. 타입 오류: `src/` 내 관련 파일만 확인
2. 빌드 오류: `.next/` 폴더 삭제 후 재시도
3. 의존성 오류: `pnpm install` 재실행

## 빌드 성공 기준

- TypeScript 오류 0개
- ESLint 오류 0개
- Next.js 빌드 완료 (`.next/` 생성)
