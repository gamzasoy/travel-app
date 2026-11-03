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
