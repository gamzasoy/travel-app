import "server-only";
import { Client } from "@notionhq/client";
import { DS_ENV, type DsKey } from "./schema";

let client: Client | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`환경변수 ${name} 이(가) 설정되지 않았습니다. .env.example 참고`);
  return v;
}

export function notion(): Client {
  // NOTION_BASE_URL 은 테스트용 가짜 서버를 가리킬 때만 사용 (e2e/mock-notion.ts)
  if (!client) client = new Client({ auth: requireEnv("NOTION_TOKEN"), baseUrl: process.env.NOTION_BASE_URL });
  return client;
}

/** 데이터 소스 ID (Notion API 2025-09-03: DB ID가 아니라 data source ID를 사용) */
export function dsId(key: DsKey): string {
  return requireEnv(DS_ENV[key]);
}
