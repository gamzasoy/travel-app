/**
 * 상위 노션 페이지 아래에 여행 플래너용 데이터베이스 7개를 만든다.
 *
 *   npm run setup:notion -- <상위 페이지 URL 또는 ID>
 *
 * 이미 예전 버전(5개)으로 만들어 쓰고 있다면, 새로 생긴 준비물·예약 DB 2개만 추가:
 *
 *   npm run setup:notion -- <상위 페이지 URL 또는 ID> --add-prep
 *   (여행·멤버 DB 는 .env.local 의 NOTION_DS_TRIPS, NOTION_DS_MEMBERS 를 사용)
 *
 * NOTION_TOKEN 은 환경변수 또는 .env.local 에서 읽는다.
 * 실행할 때마다 새 DB 를 만들므로, 이미 만들었다면 다시 실행하지 말 것.
 */
import { Client } from "@notionhq/client";
import {
  CHECKLIST_BAG_OPTIONS,
  CHECKLIST_CATEGORY_OPTIONS,
  CURRENCY_OPTIONS,
  DS_ENV,
  EXPENSE_CATEGORY_OPTIONS,
  P,
  PLACE_CATEGORY_OPTIONS,
  RESERVATION_KIND_OPTIONS,
  type DsKey,
} from "../src/lib/notion/schema";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* .env.local 없음 — 환경변수만 사용 */
}

const token = process.env.NOTION_TOKEN;
const args = process.argv.slice(2);
const addPrepOnly = args.includes("--add-prep");
const parentArg = args.find((a) => !a.startsWith("--"));
if (!token || !parentArg) {
  console.error("사용법: NOTION_TOKEN=... npm run setup:notion -- <상위 페이지 URL 또는 ID> [--add-prep]");
  process.exit(1);
}
const existingTrips = process.env.NOTION_DS_TRIPS;
const existingMembers = process.env.NOTION_DS_MEMBERS;
if (addPrepOnly && (!existingTrips || !existingMembers)) {
  console.error("--add-prep 은 .env.local 의 NOTION_DS_TRIPS, NOTION_DS_MEMBERS(기존 여행·멤버 DB)가 필요합니다.");
  process.exit(1);
}

// URL 의 쿼리스트링을 떼고, 끝에서부터 32자리 hex 를 찾는다.
// (제목 슬러그가 "DB-", "Cafe-" 처럼 hex 문자로 끝나면 앞에서부터 찾을 때 ID 가 밀린다)
const hex = parentArg
  .split(/[?#]/)[0]
  .replace(/-/g, "")
  .match(/[0-9a-f]{32}(?![0-9a-f])/i)?.[0];
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

/** 준비물·예약 DB (여행 DB 에 관계로 연결) */
async function createPrepDbs(ids: Partial<Record<DsKey, string>>, tripsId: string, membersId: string) {
  ids.checklist = await createDb("checklist", "준비물", {
    [P.title]: { title: {} },
    [P.trip]: rel(tripsId),
    [P.checked]: { checkbox: {} },
    [P.expenseCategory]: opts(CHECKLIST_CATEGORY_OPTIONS),
    [P.bag]: opts(CHECKLIST_BAG_OPTIONS),
    [P.packedBy]: rel(membersId),
    [P.order]: { number: { format: "number" } },
  });

  ids.reservations = await createDb("reservations", "예약", {
    [P.title]: { title: {} },
    [P.trip]: rel(tripsId),
    [P.reservationKind]: opts(RESERVATION_KIND_OPTIONS),
    [P.when]: { date: {} },
    [P.confirmation]: { rich_text: {} },
    [P.note]: { rich_text: {} },
    [P.link]: { url: {} },
  });
}

function printEnv(ids: Partial<Record<DsKey, string>>) {
  console.log("\n.env.local 에 아래 값을 붙여넣으세요:\n");
  for (const key of Object.keys(ids) as DsKey[]) console.log(`${DS_ENV[key]}=${ids[key]}`);
}

async function main() {
  const ids = {} as Record<DsKey, string>;

  if (addPrepOnly) {
    await createPrepDbs(ids, existingTrips!, existingMembers!);
    printEnv(ids);
    return;
  }

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

  await createPrepDbs(ids, ids.trips, ids.members);
  printEnv(ids);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
