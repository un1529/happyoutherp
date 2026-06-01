# 청년회 회계 ERP 웹앱

- ERP 로그인: `https://happyoutherp.vercel.app/`
- 로그인 없는 청구 제출: `https://happyoutherp.vercel.app/claim.html`

## 공개 청구 활성화

1. 기존 공개 청구 SQL을 실행했다면 SQL Editor에서 최신 `add-claim-receipts.sql`을 실행합니다.
2. Authentication > Providers에서 Anonymous Sign-Ins를 켜고 Save를 누릅니다.
3. Cloudflare Turnstile 공개 `Site key`는 `supabase-config.js`에 넣습니다.
4. Turnstile 비밀 `Secret key`는 Supabase Bot and Abuse Protection에만 직접 입력합니다.

영수증은 비공개 Storage에 저장됩니다. 계좌번호는 별도 보안 테이블에 저장되어 회계담당자만 확인할 수 있습니다.

## 권한

- 공개 제출자: 새 청구, 영수증, 지급 계좌번호 추가만 가능
- 회계담당(`accountant`): ERP 수정, 공개 접수함 처리, 계좌번호 확인 가능
- 모니터링 사용자(`monitor`): ERP와 접수함 읽기 전용. 계좌번호 확인 불가
- 공개 제출자: 기존 청구 목록, 영수증, 계좌번호, 내부 ERP 데이터 조회 불가
