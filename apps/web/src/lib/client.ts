/** A POST from the browser: the answer's status and JSON, or network: true when nothing came back. */
export type Answer = { network: true } | { network: false; status: number; data: Record<string, unknown> };

export async function post(url: string, body: unknown): Promise<Answer> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json().catch(() => ({}));
    return { network: false, status: res.status, data };
  } catch {
    return { network: true };
  }
}
