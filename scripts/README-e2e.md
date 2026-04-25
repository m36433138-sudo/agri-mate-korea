# Realtime RLS e2e 테스트 사용법

`src/test/realtime-rls.e2e.test.ts`는 실제 WebSocket 연결로
`realtime.messages` RLS 정책을 admin/employee/customer 세 역할에서 검증합니다.

## 1) 테스트 계정 시드 (최초 1회 또는 비밀번호 갱신 시)

비밀번호는 임의 문자열로 생성하면 됩니다.

```bash
PASS=$(node -e "console.log('E2eRlsTest!'+require('crypto').randomBytes(8).toString('hex'))")
bun scripts/seed-e2e-users.mjs "$PASS"
```

생성/멱등 갱신되는 계정:
- `e2e-admin@ym.local` → role: admin
- `e2e-employee@ym.local` → role: employee, employees 테이블에 "E2E 테스트 기사"로 연결
- `e2e-customer@ym.local` → role: customer

자격증명은 `.test-credentials.json` (gitignore됨) 에 저장됩니다.

## 2) 테스트 실행

직렬 실행 권장 (병렬 ws 핸드셰이크가 느려져 차단 케이스가 timeout과 구별 안 될 수 있음):

```bash
bunx vitest run src/test/realtime-rls.e2e.test.ts \
  --no-file-parallelism --sequence.concurrent=false
```

전체 소요 ~55초 (차단 케이스는 ~5초씩, 허용 케이스는 ~1.5초).

## 3) 정리 (선택)

테스트 계정을 제거하려면 Lovable Cloud → Users에서 `e2e-*@ym.local` 3개와
employees 테이블의 "E2E 테스트 기사" 행을 삭제하세요.
