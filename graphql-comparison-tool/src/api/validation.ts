interface RunPayload {
  readonly referenceUrl: string;
  readonly candidateUrl: string;
  readonly globalHeaders: ReadonlyArray<readonly [string, string]>;
  readonly queriesDir: string;
  readonly selectedRequests?: ReadonlyArray<string>;
  readonly perRequestHeaders?: Readonly<
    Record<string, ReadonlyArray<readonly [string, string]>>
  >;
}

interface ValidationSuccess {
  readonly ok: true;
  readonly payload: RunPayload;
}

interface ValidationFailure {
  readonly ok: false;
  readonly error: string;
}

type ValidationResult = ValidationSuccess | ValidationFailure;

function isStringArray(value: unknown): value is ReadonlyArray<string> {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isHeaderPair(value: unknown): value is readonly [string, string] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "string" &&
    typeof value[1] === "string"
  );
}

function isHeaderPairs(
  value: unknown,
): value is ReadonlyArray<readonly [string, string]> {
  return Array.isArray(value) && value.every(isHeaderPair);
}

function isPerRequestHeaders(
  value: unknown,
): value is Readonly<
  Record<string, ReadonlyArray<readonly [string, string]>>
> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  for (const [, v] of Object.entries(value)) {
    if (!isHeaderPairs(v)) {
      return false;
    }
  }
  return true;
}

export function validateRunPayload(body: unknown): ValidationResult {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const record = body as Record<string, unknown>;

  if (
    typeof record["referenceUrl"] !== "string" ||
    record["referenceUrl"] === ""
  ) {
    return {
      ok: false,
      error: "referenceUrl is required and must be a non-empty string",
    };
  }

  if (
    typeof record["candidateUrl"] !== "string" ||
    record["candidateUrl"] === ""
  ) {
    return {
      ok: false,
      error: "candidateUrl is required and must be a non-empty string",
    };
  }

  const globalHeaders = record["globalHeaders"] ?? [];
  if (!isHeaderPairs(globalHeaders)) {
    return {
      ok: false,
      error: "globalHeaders must be an array of [key, value] string pairs",
    };
  }

  const queriesDir =
    typeof record["queriesDir"] === "string" && record["queriesDir"] !== ""
      ? record["queriesDir"]
      : "./queries";

  const selectedRequests = record["selectedRequests"];
  if (selectedRequests !== undefined && !isStringArray(selectedRequests)) {
    return {
      ok: false,
      error: "selectedRequests must be an array of strings",
    };
  }

  const perRequestHeaders = record["perRequestHeaders"];
  if (perRequestHeaders !== undefined && !isPerRequestHeaders(perRequestHeaders)) {
    return {
      ok: false,
      error:
        "perRequestHeaders must be an object mapping query names to arrays of [key, value] string pairs",
    };
  }

  const payload: RunPayload = {
    referenceUrl: record["referenceUrl"],
    candidateUrl: record["candidateUrl"],
    globalHeaders,
    queriesDir,
    ...(selectedRequests !== undefined && { selectedRequests }),
    ...(perRequestHeaders !== undefined && { perRequestHeaders }),
  };

  return {
    ok: true,
    payload,
  };
}
