import { diff, diffString } from "json-diff";
import type {
  ComparisonRequestResult,
  ComparisonRunResult,
  QueryStatus,
  ReportInput,
} from "./comparison-result.js";

export interface StatusResult {
  readonly status: QueryStatus;
  readonly errorMessage: string | undefined;
}

export function maskSensitiveHeaders(
  headers: ReadonlyArray<readonly [string, string]>,
): ReadonlyArray<string> {
  return headers.map(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === "authorization" ||
      lowerKey.includes("token") ||
      lowerKey.includes("secret")
    ) {
      return `${key}: ***`;
    }
    return `${key}: ${value}`;
  });
}

export function formatVariables(
  variables: Record<string, unknown> | undefined,
): string {
  if (variables === undefined) {
    return "none";
  }

  const keys = Object.keys(variables);
  if (keys.length === 0) {
    return "empty object";
  }

  try {
    return JSON.stringify(variables);
  } catch {
    return "unserializable";
  }
}

export function resolveInputStatus(input: ReportInput): StatusResult {
  if (!input.reference.ok) {
    return {
      status: "ERROR",
      errorMessage: `Reference server error: ${input.reference.error}`,
    };
  }
  if (!input.candidate.ok) {
    return {
      status: "ERROR",
      errorMessage: `Candidate server error: ${input.candidate.error}`,
    };
  }

  const refHasErrors =
    input.reference.errors !== undefined && input.reference.errors.length > 0;
  const candHasErrors =
    input.candidate.errors !== undefined && input.candidate.errors.length > 0;

  if (refHasErrors !== candHasErrors) {
    const detail = refHasErrors
      ? "Reference returned GraphQL errors but candidate did not"
      : "Candidate returned GraphQL errors but reference did not";
    return {
      status: "FAIL",
      errorMessage: detail,
    };
  }

  const rawDiff: unknown = diff(input.reference.data, input.candidate.data, {
    sort: true,
  });

  if (rawDiff === undefined) {
    return { status: "PASS", errorMessage: undefined };
  }

  return { status: "FAIL", errorMessage: undefined };
}

const DIFF_OPTIONS = { sort: true, full: true } as const;

function buildDiffText(
  input: ReportInput,
  status: QueryStatus,
): string | undefined {
  if (status !== "FAIL" || !input.reference.ok || !input.candidate.ok) {
    return undefined;
  }

  return diffString(input.reference.data, input.candidate.data, DIFF_OPTIONS);
}

export function runComparison(
  inputs: ReadonlyArray<ReportInput>,
): ComparisonRunResult {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  let passed = 0;
  let failed = 0;
  let errors = 0;
  const failedComparisons: Array<string> = [];
  const requests: Array<ComparisonRequestResult> = [];

  for (const input of inputs) {
    const { status, errorMessage } = resolveInputStatus(input);

    switch (status) {
      case "PASS":
        passed++;
        break;
      case "FAIL":
        failed++;
        failedComparisons.push(input.name);
        break;
      case "ERROR":
        errors++;
        break;
    }

    requests.push({
      name: input.name,
      type: input.type,
      status,
      errorMessage,
      headersSummary: maskSensitiveHeaders(input.headers),
      variablesSummary: formatVariables(input.variables),
      diffText: buildDiffText(input, status),
      referenceData: input.reference.ok ? input.reference.data : undefined,
      candidateData: input.candidate.ok ? input.candidate.data : undefined,
    });
  }

  const finishedAtMs = Date.now();
  const finishedAt = new Date(finishedAtMs).toISOString();

  return {
    startedAt,
    finishedAt,
    durationMs: finishedAtMs - startedAtMs,
    summary: {
      total: inputs.length,
      passed,
      failed,
      errors,
      failedComparisons,
    },
    requests,
  };
}
