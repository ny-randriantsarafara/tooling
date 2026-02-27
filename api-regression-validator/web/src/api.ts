const BASE = "/api";

interface RunListItem {
  readonly id: string;
  readonly startedAt: string;
  readonly referenceUrl: string;
  readonly candidateUrl: string;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly errors: number;
  readonly durationMs: number;
}

interface ComparisonRequestResult {
  readonly name: string;
  readonly type: "graphql" | "rest";
  readonly status: "PASS" | "FAIL" | "ERROR";
  readonly errorMessage: string | undefined;
  readonly headersSummary: ReadonlyArray<string>;
  readonly variablesSummary: string;
  readonly diffText: string | undefined;
  readonly referenceData: unknown;
  readonly candidateData: unknown;
}

interface ComparisonSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly errors: number;
  readonly failedComparisons: ReadonlyArray<string>;
}

interface ComparisonRunResult {
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly summary: ComparisonSummary;
  readonly requests: ReadonlyArray<ComparisonRequestResult>;
}

interface StoredRun {
  readonly id: string;
  readonly referenceUrl: string;
  readonly candidateUrl: string;
  readonly queriesDir: string;
  readonly runResult: ComparisonRunResult;
}

interface PostRunResponse {
  readonly runId: string;
  readonly summary: ComparisonSummary;
  readonly requests: ReadonlyArray<ComparisonRequestResult>;
}

interface RunPayload {
  readonly referenceUrl: string;
  readonly candidateUrl: string;
  readonly globalHeaders: ReadonlyArray<readonly [string, string]>;
  readonly queriesDir: string;
  readonly selectedRequests?: ReadonlyArray<string>;
  readonly perRequestHeaders?: Readonly<Record<string, ReadonlyArray<readonly [string, string]>>>;
}

export type {
  RunListItem,
  ComparisonRequestResult,
  ComparisonSummary,
  ComparisonRunResult,
  StoredRun,
  PostRunResponse,
  RunPayload,
};

export async function listRuns(): Promise<ReadonlyArray<RunListItem>> {
  const res = await fetch(`${BASE}/runs`);
  return res.json();
}

export async function getRunById(runId: string): Promise<StoredRun> {
  const res = await fetch(`${BASE}/runs/${runId}`);
  if (!res.ok) {
    throw new Error(`Run not found: ${runId}`);
  }
  return res.json();
}

export async function createRun(payload: RunPayload): Promise<PostRunResponse> {
  const res = await fetch(`${BASE}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? "Failed to create run");
  }
  return res.json();
}

// --- Query CRUD ---

interface QueryItem {
  readonly name: string;
  readonly type: "graphql";
  readonly query: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly variables?: Readonly<Record<string, unknown>>;
}

interface CreateQueryPayload {
  readonly name: string;
  readonly query: string;
  readonly headers?: Record<string, string>;
  readonly variables?: Record<string, unknown>;
}

interface UpdateQueryPayload {
  readonly query?: string;
  readonly headers?: Record<string, string>;
  readonly variables?: Record<string, unknown>;
}

export type { QueryItem, CreateQueryPayload, UpdateQueryPayload };

export async function listQueries(): Promise<ReadonlyArray<QueryItem>> {
  const res = await fetch(`${BASE}/queries`);
  return res.json();
}

export async function getQuery(name: string): Promise<QueryItem> {
  const res = await fetch(`${BASE}/queries/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Query not found: ${name}`);
  return res.json();
}

export async function createQuery(payload: CreateQueryPayload): Promise<QueryItem> {
  const res = await fetch(`${BASE}/queries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? "Failed to create query");
  }
  return res.json();
}

export async function updateQuery(name: string, payload: UpdateQueryPayload): Promise<QueryItem> {
  const res = await fetch(`${BASE}/queries/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? "Failed to update query");
  }
  return res.json();
}

export async function deleteQuery(name: string): Promise<void> {
  const res = await fetch(`${BASE}/queries/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete query: ${name}`);
}
