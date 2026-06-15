/**
 * Singleton factories for the generated OpenAPI clients.
 *
 * The `accessToken` field in Configuration accepts a function that returns
 * a Promise<string>, so we plug getIdToken() straight in — the generated
 * client resolves it before every request automatically.
 *
 * Chat streaming is deliberately excluded: the generated ChatApi uses Axios
 * which cannot consume SSE. chatService.ts keeps its fetch-based implementation.
 */

import { Configuration } from "../../clients/configuration";
import { SessionsApi } from "../../clients/api";
import { getIdToken } from "@/src/services/authService";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export { BACKEND_URL };

function makeConfiguration(): Configuration {
  return new Configuration({
    basePath: BACKEND_URL,
    // Resolved before every request — always fresh Firebase token
    accessToken: () => getIdToken(),
  });
}

// One instance per browser session; re-created on hot reload in dev
let _sessionsApi: SessionsApi | null = null;

export function getSessionsApi(): SessionsApi {
  if (!_sessionsApi) {
    _sessionsApi = new SessionsApi(makeConfiguration(), BACKEND_URL);
  }
  return _sessionsApi;
}
