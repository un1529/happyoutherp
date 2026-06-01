# 청년회 회계 ERP 웹앱

행복한교회 청년회 회계 업무용 웹앱입니다.

## 주소

- ERP 로그인: `https://happyoutherp.vercel.app/`
- 로그인 없는 청구 제출: `https://happyoutherp.vercel.app/claim.html`

## 로그인 없는 공개 청구 제출 활성화

1. Supabase Dashboard > SQL Editor에서 `public-claim-schema.sql` 전체를 한 번 실행합니다.
2. Supabase Dashboard > Authentication > Providers에서 Anonymous Sign-Ins를 활성화합니다.
3. Cloudflare Turnstile에서 `happyoutherp.vercel.app`용 위젯을 만들고 공개 `Site key`를 `supabase-config.js`의 `turnstileSiteKey`에 넣습니다.
4. Supabase Dashboard > Authentication > Bot and Abuse Protection에서 Cloudflare Turnstile을 선택하고 비밀 `Secret key`를 직접 입력합니다.

Turnstile의 `Secret key`는 HTML, JavaScript, GitHub, 채팅에 넣으면 안 됩니다.

공개 화면에서는 계좌번호와 영수증을 받지 않습니다.

## 권한

- 공개 제출자: 새 청구 추가만 가능
- 회계담당(`accountant`): 공용 ERP 데이터 수정, 공개 접수함 조회 및 처리 상태 수정 가능
- 모니터링 사용자(`monitor`): 공용 ERP 데이터와 공개 접수함 읽기 전용
- 공개 제출자: 기존 청구 목록과 내부 ERP 데이터 조회 불가

`service_role` 키는 관리자 비밀키입니다. HTML, JavaScript, GitHub에 절대 넣으면 안 됩니다.
