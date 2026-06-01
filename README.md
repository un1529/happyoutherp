# 청년회 회계 ERP 웹앱

행복한교회 청년회 회계 업무용 웹앱입니다.

## 주소

- ERP 로그인: `https://happyoutherp.vercel.app/`
- 로그인 없는 청구 제출: `https://happyoutherp.vercel.app/claim.html`

## 공개 청구 활성화

1. SQL Editor에서 `public-claim-schema.sql`을 실행합니다.
2. 이미 공개 청구 SQL을 실행했다면 SQL Editor에서 `add-claim-receipts.sql`을 실행합니다.
3. Authentication > Providers에서 Anonymous Sign-Ins를 켭니다.
4. Cloudflare Turnstile에서 `happyoutherp.vercel.app` 위젯을 만들고 공개 `Site key`를 `supabase-config.js`의 `turnstileSiteKey`에 넣습니다.
5. Supabase Authentication > Bot and Abuse Protection에서 Turnstile을 선택하고 비밀 `Secret key`를 직접 입력합니다.

Turnstile `Secret key`는 HTML, JavaScript, GitHub, 채팅에 넣으면 안 됩니다.

영수증은 비공개 Storage 버킷에 저장되며 임원진만 내부 접수함에서 열 수 있습니다.

## 권한

- 공개 제출자: 새 청구와 영수증 추가만 가능
- 회계담당(`accountant`): ERP 수정, 공개 접수함 조회와 처리 상태 수정 가능
- 모니터링 사용자(`monitor`): ERP와 공개 접수함 읽기 전용
- 공개 제출자: 기존 청구 목록, 영수증, 내부 ERP 데이터 조회 불가
