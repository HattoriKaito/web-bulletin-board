const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const TOKEN_KEY = "boatai_token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// FastAPI/Pydanticのバリデーションエラー（422）は detail が
// [{msg, loc, ...}, ...] という配列で返る。そのままJSON.stringifyすると
// 画面に生のJSONが表示されてしまうため、msgだけを取り出して読める文にする。
function extractErrorMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item
          ? String((item as { msg: unknown }).msg)
          : null,
      )
      .filter((m): m is string => m !== null);
    if (messages.length > 0) return messages.join(" / ");
  }
  return JSON.stringify(detail);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  // FormData送信時はブラウザがboundary付きのContent-Typeを自動設定するため、
  // ここで上書きしない（手動でapplication/jsonを設定すると壊れる）。
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail: unknown = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? body;
    } catch {
      // レスポンスボディがJSONでない場合はstatusTextのまま
    }
    throw new ApiError(res.status, extractErrorMessage(detail));
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
