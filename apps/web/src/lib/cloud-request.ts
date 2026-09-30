export type ApiResult<T> = T & { error?: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function cloudRequest<T>(
  path: string,
  method: string,
  accessToken: string,
  body?: unknown,
  retryIdempotently = false,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const attempts = retryIdempotently ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetcher(path, {
        method,
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      if (attempt + 1 < attempts) { await wait(250 * (attempt + 1)); continue; }
      throw new Error("The cloud request timed out or lost its connection. Please try again.");
    }

    const responseBody: unknown = await response.json().catch(() => null);
    if (retryIdempotently && response.status >= 500 && attempt + 1 < attempts) {
      await wait(250 * (attempt + 1));
      continue;
    }
    if (!response.ok) {
      const message = isRecord(responseBody) && typeof responseBody.error === "string" ? responseBody.error : "The cloud request could not be completed.";
      throw new Error(message);
    }
    if (!isRecord(responseBody)) throw new Error("The cloud service returned an invalid response.");
    return responseBody as ApiResult<T>;
  }
  throw new Error("The cloud request could not be completed. Please try again.");
}
