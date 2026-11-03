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
