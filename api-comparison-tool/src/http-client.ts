import type { RequestDefinition } from "./request-loader.js";

interface HttpSuccessResponse {
  readonly ok: true;
  readonly data: unknown;
  readonly errors: ReadonlyArray<unknown> | undefined;
}

interface HttpErrorResponse {
  readonly ok: false;
  readonly error: string;
}

export type HttpResponse = HttpSuccessResponse | HttpErrorResponse;

function mergeHeaders(
  globalHeaders: ReadonlyArray<readonly [string, string]>,
  perRequestHeaders: ReadonlyArray<readonly [string, string]>,
): Headers {
  const merged = new Headers();
  for (const [key, value] of globalHeaders) {
    merged.set(key, value);
  }
  for (const [key, value] of perRequestHeaders) {
    merged.set(key, value);
  }
  return merged;
}

function buildRestUrl(
  baseUrl: string,
  path: string,
  queryParams: Record<string, string> | undefined,
): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`);

  if (queryParams !== undefined) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

async function sendGraphQL(
  baseUrl: string,
  query: string,
  variables: Record<string, unknown> | undefined,
  headers: Headers,
): Promise<HttpResponse> {
  headers.set("Content-Type", "application/json");

  const body = JSON.stringify(
    variables !== undefined ? { query, variables } : { query },
  );

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const json = (await response.json()) as {
      data?: unknown;
      errors?: ReadonlyArray<unknown>;
    };

    return { ok: true, data: json.data, errors: json.errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

async function sendRest(
  baseUrl: string,
  method: string,
  path: string,
  queryParams: Record<string, string> | undefined,
  body: unknown | undefined,
  headers: Headers,
): Promise<HttpResponse> {
  const url = buildRestUrl(baseUrl, path, queryParams);

  const hasBody = body !== undefined;
  if (hasBody) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data: unknown = await response.json();
    return { ok: true, data, errors: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function sendRequest(
  request: RequestDefinition,
  baseUrl: string,
  globalHeaders: ReadonlyArray<readonly [string, string]>,
): Promise<HttpResponse> {
  const headers = mergeHeaders(globalHeaders, request.headers);

  switch (request.type) {
    case "graphql":
      return sendGraphQL(baseUrl, request.query, request.variables, headers);
    case "rest":
      return sendRest(
        baseUrl,
        request.method,
        request.path,
        request.queryParams,
        request.body,
        headers,
      );
  }
}
