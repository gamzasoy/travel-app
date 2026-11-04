import { describe, expect, it } from "vitest";
import { NETWORK_ERROR, safe } from "./safe-action";

describe("safe", () => {
  it("정상 결과는 그대로 돌려준다", async () => {
    expect(await safe(async () => ({ ok: true as const }))).toEqual({ ok: true });
    expect(await safe(async () => ({ ok: false as const, error: "PIN이 맞지 않아요." }))).toEqual({
      ok: false,
      error: "PIN이 맞지 않아요.",
    });
  });

  it("호출이 던지면 네트워크 안내 메시지로 바꾼다", async () => {
    expect(
      await safe(async () => {
        throw new TypeError("Failed to fetch");
      }),
    ).toEqual({ ok: false, error: NETWORK_ERROR });
  });
});
