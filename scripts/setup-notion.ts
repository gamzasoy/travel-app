/**
 * 상위 노션 페이지 아래에 여행 플래너용 데이터베이스 5개를 만든다.
 *
 *   npm run setup:notion -- <상위 페이지 URL 또는 ID>
 *
 * NOTION_TOKEN 은 환경변수 또는 .env.local 에서 읽는다.
 * 실행할 때마다 새 DB 를 만들므로, 이미 만들었다면 다시 실행하지 말 것.
 */
import { Client } from "@notionhq/client";
import {
  CURRENCY_OPTIONS,
  DS_ENV,
  EXPENSE_CATEGORY_OPTIONS,
  P,
  PLACE_CATEGORY_OPTIONS,
  type DsKey,
} from "../src/lib/notion/schema";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* .env.local 없음 — 환경변수만 사용 */
}

const token = process.env.NOTION_TOKEN;
const parentArg = process.argv[2];
if (!token || !parentArg) {
  console.error("사용법: NOTION_TOKEN=... npm run setup:notion -- <상위 페이지 URL 또는 ID>");
  process.exit(1);
}

const hex = parentArg.replace(/-/g, "").match(/[0-9a-f]{32}/i)?.[0];
if (!hex) {
  console.error("상위 페이지 ID(32자리)를 찾을 수 없습니다.");
  process.exit(1);
}
const parentId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

const notion = new Client({ auth: token });

const opts = (names: readonly string[]) => ({
  select: { options: names.map((name) => ({ name })) },
});
const rel = (dataSourceId: string) => ({
  relation: { data_source_id: dataSourceId, single_property: {} },
});

async function createDb(key: DsKey, title: string, properties: Record<string, unknown>) {
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: parentId },
    title: [{ type: "text", text: { content: title } }],
    initial_data_source: { properties: properties as never },
  });
  const ds = "data_sources" in db ? db.data_sources?.[0] : undefined;
  if (!ds) throw new Error(`${title}: 데이터 소스를 찾을 수 없습니다`);
  console.log(`✓ ${title}`);
  return ds.id;
}

async function main() {
  const ids = {} as Record<DsKey, string>;

  ids.trips = await createDb("trips", "여행", {
    [P.title]: { title: {} },
    [P.startEnd]: { date: {} },
    [P.pin]: { rich_text: {} },
    [P.localCurrency]: opts(CURRENCY_OPTIONS),
    [P.settleCurrency]: opts(CURRENCY_OPTIONS),
    [P.manualRate]: { number: { format: "number" } },
  });

  ids.members = await createDb("members", "멤버", {
    [P.title]: { title: {} },
    [P.trip]: rel(ids.trips),
    [P.color]: { select: {} },
  });

  ids.places = await createDb("places", "장소", {
    [P.title]: { title: {} },
    [P.trip]: rel(ids.trips),
    [P.address]: { rich_text: {} },
    [P.lat]: { number: { format: "number" } },
    [P.lng]: { number: { format: "number" } },
    [P.googlePlaceId]: { rich_text: {} },
    [P.placeCategory]: opts(PLACE_CATEGORY_OPTIONS),
    [P.visited]: { checkbox: {} },
  });

  ids.schedule = await createDb("schedule", "일정", {
    [P.title]: { title: {} },
    [P.trip]: rel(ids.trips),
    [P.when]: { date: {} },
    [P.place]: rel(ids.places),
    [P.note]: { rich_text: {} },
    [P.order]: { number: { format: "number" } },
  });

  ids.expenses = await createDb("expenses", "지출", {
    [P.title]: { title: {} },
    [P.trip]: rel(ids.trips),
    [P.amount]: { number: { format: "number" } },
    [P.currency]: opts(CURRENCY_OPTIONS),
    [P.rate]: { number: { format: "number" } },
    [P.payer]: rel(ids.members),
    [P.participants]: rel(ids.members),
    [P.expenseCategory]: opts(EXPENSE_CATEGORY_OPTIONS),
    [P.date]: { date: {} },
    [P.place]: rel(ids.places),
  });

  // 노션에서 볼 때 편하라고 넣는 원화 환산 수식 (앱은 이 값을 쓰지 않음). 실패해도 무방.
  try {
    await notion.dataSources.update({
      data_source_id: ids.expenses,
      properties: {
        [P.krwTotal]: {
          formula: {
            expression: `if(prop("${P.currency}") == "JPY", round(prop("${P.amount}") * prop("${P.rate}") / 100), prop("${P.amount}"))`,
          },
        },
      } as never,
    });
    console.log("✓ 원화환산 수식");
  } catch (e) {
    console.warn("! 원화환산 수식 추가 실패(무시 가능):", (e as Error).message);
  }

  console.log("\n.env.local 에 아래 값을 붙여넣으세요:\n");
  for (const key of Object.keys(ids) as DsKey[]) console.log(`${DS_ENV[key]}=${ids[key]}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
