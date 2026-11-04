export const NETWORK_ERROR = "네트워크 연결을 확인하고 다시 시도해주세요.";

/**
 * 서버 액션 호출을 감싸서, 연결이 끊겼을 때(로밍·지하철 등) 에러 화면 대신
 * { ok: false, error } 로 돌려준다. 폼은 이 메시지를 그대로 보여주면 된다.
 */
export async function safe<T extends { ok: boolean }>(run: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try {
    return await run();
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}
