# Commit → Push → PR

현재 변경사항을 커밋하고 푸시한 뒤 PR을 생성합니다.

## 절차

1. `git status` — 변경 파일 확인
2. `git diff` — 변경 내용 확인
3. 변경사항 요약 후 커밋 메시지 제안 (사용자 확인)
4. `git add` — 관련 파일만 스테이징
5. `git commit -m "..."` — 커밋
6. `git push` — 원격 저장소 푸시
7. `gh pr create` — PR 생성 (필요 시)

## 커밋 메시지 규칙

```
feat: 새 기능
fix: 버그 수정
refactor: 코드 개선 (기능 변경 없음)
docs: 문서 수정
chore: 설정/의존성 변경
```
