import type { HttpResponse } from "../http-client.js";

export type RequestType = "graphql" | "rest";
export type QueryStatus = "PASS" | "FAIL" | "ERROR";

export interface ReportInput {
  readonly name: string;
  readonly type: RequestType;
  readonly headers: ReadonlyArray<readonly [string, string]>;
  readonly variables: Record<string, unknown> | undefined;
  readonly reference: HttpResponse;
  readonly candidate: HttpResponse;
}

export interface ComparisonSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly errors: number;
  readonly failedComparisons: ReadonlyArray<string>;
}

export interface ComparisonRequestResult {
  readonly name: string;
  readonly type: RequestType;
  readonly status: QueryStatus;
  readonly errorMessage: string | undefined;
  readonly headersSummary: ReadonlyArray<string>;
  readonly variablesSummary: string;
  readonly diffText: string | undefined;
  readonly referenceData: unknown;
  readonly candidateData: unknown;
}

export interface ComparisonRunResult {
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly summary: ComparisonSummary;
  readonly requests: ReadonlyArray<ComparisonRequestResult>;
}
