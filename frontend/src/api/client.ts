/** Thin fetch wrapper: same-origin `/api` (proxied by Vite), JSON in/out, cookie auth. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface ErrorBody {
  error?: string;
  details?: { fieldErrors?: Record<string, string[] | undefined> };
}

/** "Validation failed" alone isn't helpful; surface the first field problem too. */
function errorMessage(body: ErrorBody | null, fallback: string): string {
  const fieldErrors = body?.details?.fieldErrors ?? {};
  const [field, messages] = Object.entries(fieldErrors).find(([, m]) => m?.length) ?? [];
  if (field && messages) return `${field}: ${messages[0]}`;
  return body?.error ?? fallback;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, errorMessage(body, res.statusText || 'Request failed'));
  return body as T;
}
