/**
 * Safe fetch wrapper for API calls.
 * Automatically handles auth (via the BaseLayout fetch interceptor)
 * and provides safe JSON parsing with descriptive errors.
 */
export async function apiFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, options);
  const text = await res.text();

  let data: T;
  try {
    data = JSON.parse(text);
  } catch (err: any) {
    throw new Error(
      `JSON Parse Error on ${url}: ${err.message}. Raw response (first 500 chars): ${text.slice(0, 500)}`
    );
  }

  return { ok: res.ok, status: res.status, data };
}
