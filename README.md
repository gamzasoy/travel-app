# 여행 플래너

친구들과 함께 쓰는 여행 일정 · 가계부(N빵 정산, 엔화 지원) · 구글 지도 모바일 PWA.
데이터는 Notion 데이터베이스에 저장됩니다.

## 개발

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3000
npm run test                 # 단위 테스트 (Vitest)
npm run test:e2e             # 모바일 뷰포트 E2E (Playwright)
npm run lint && npm run build
```

계획: 노션 연동 → 입장(PIN) → 가계부/정산 → 일정 → 지도 → PWA.

## 노션 준비

1. https://www.notion.so/profile/integrations 에서 내부 통합을 만들고 토큰을 `.env.local` 의 `NOTION_TOKEN` 에 넣기
2. 노션에 빈 상위 페이지를 만들고 `···` → 연결 → 만든 통합 추가
3. `npm run setup:notion -- <상위 페이지 URL>` 실행 → 출력된 `NOTION_DS_*` 값을 `.env.local` 에 붙여넣기
   (여행/멤버/장소/일정/지출 DB 5개가 생성됩니다. 여러 번 실행하면 DB 가 중복 생성됩니다.)
4. 여행 DB 에 행 하나를 직접 추가(이름, 기간, PIN)하고, 멤버 DB 에 친구들을 추가한 뒤 `여행` 관계를 연결

## 친구에게 공유하기

여행 DB 에서 해당 행을 열어 페이지 URL 끝의 32자리 ID 를 복사하고, 배포 주소 뒤에 붙여 공유합니다.

```
https://<배포주소>/t/<여행 페이지 ID>
```

링크로 들어와 PIN 을 입력하고 "나는 누구인가요?"에서 이름을 고르면 30일간 유지됩니다.
PIN 이 비어 있는 여행은 입장이 거부됩니다. `SESSION_SECRET` 은 `openssl rand -hex 32` 로 만든 값을 쓰세요.

## 구글 지도 (선택)

키가 없어도 앱은 동작합니다. 지도 대신 안내가 보이고, 장소는 이름·주소를 직접 입력해 저장할 수 있어요(길찾기는 이름·주소 검색).
키를 설정하면 지도·마커·날짜별 경로선·장소 검색(자동완성)이 켜집니다.

1. Google Cloud 에서 **Maps JavaScript API** 와 **Places API (New)** 를 활성화
2. API 키 발급 → HTTP referrer 를 배포 도메인(와 `localhost:3000`)으로 제한
3. 지도 → 지도 관리에서 Map ID 생성 (없으면 개발용 `DEMO_MAP_ID` 사용)
4. `.env.local` 에 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAP_ID` 설정 (Vercel 은 환경변수에도 등록)
