import { createDatabase } from "./client.js";
import type { ComparisonRunResult } from "../core/comparison-result.js";

interface SaveRunInput {
  readonly runId: string;
  readonly referenceUrl: string;
  readonly candidateUrl: string;
  readonly globalHeaders: ReadonlyArray<readonly [string, string]>;
  readonly queriesDir: string;
  readonly runResult: ComparisonRunResult;
}

interface StoredRun {
  readonly id: string;
  readonly referenceUrl: string;
  readonly candidateUrl: string;
  readonly globalHeaders: ReadonlyArray<readonly [string, string]>;
  readonly queriesDir: string;
  readonly runResult: ComparisonRunResult;
}

interface RunRow {
  readonly id: string;
  readonly started_at: string;
  readonly finished_at: string;
  readonly duration_ms: number;
  readonly reference_url: string;
  readonly candidate_url: string;
  readonly global_headers_json: string;
  readonly queries_dir: string;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly errors: number;
  readonly failed_comparisons_json: string;
}

interface RequestRow {
  readonly request_name: string;
  readonly request_type: "graphql" | "rest";
  readonly status: "PASS" | "FAIL" | "ERROR";
  readonly error_message: string | null;
  readonly headers_summary_json: string;
  readonly variables_summary: string;
  readonly diff_text: string | null;
  readonly reference_data_json: string | null;
  readonly candidate_data_json: string | null;
}

function stringify(value: unknown): string {
  return JSON.stringify(value);
}

function parseJson(value: string): unknown {
  return JSON.parse(value);
}

function parseStringArray(value: string): ReadonlyArray<string> {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter((item): item is string => typeof item === "string");
}

function parseHeaderPairs(
  value: string,
): ReadonlyArray<readonly [string, string]> {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) {
    return [];
  }

  const pairs: Array<readonly [string, string]> = [];
  for (const item of parsed) {
    if (Array.isArray(item) && item.length === 2) {
      const first = item[0];
      const second = item[1];
      if (typeof first === "string" && typeof second === "string") {
        pairs.push([first, second]);
      }
    }
  }
  return pairs;
}

function parseUnknown(value: string | null): unknown {
  if (value === null) {
    return undefined;
  }
  return parseJson(value);
}

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

export interface RunRepository {
  saveRun: (input: SaveRunInput) => void;
  getRunById: (runId: string) => StoredRun | undefined;
  listRuns: () => ReadonlyArray<RunListItem>;
}

export function createRunRepository(databasePath: string): RunRepository {
  const database = createDatabase(databasePath);
  const insertRun = database.prepare(`
    INSERT INTO runs (
      id, started_at, finished_at, duration_ms,
      reference_url, candidate_url, global_headers_json, queries_dir,
      total, passed, failed, errors, failed_comparisons_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRequest = database.prepare(`
    INSERT INTO run_requests (
      run_id, request_name, request_type, status, error_message,
      headers_summary_json, variables_summary, diff_text,
      reference_data_json, candidate_data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const selectRunById = database.prepare<[string], RunRow>(`
    SELECT
      id, started_at, finished_at, duration_ms,
      reference_url, candidate_url, global_headers_json, queries_dir,
      total, passed, failed, errors, failed_comparisons_json
    FROM runs
    WHERE id = ?
  `);
  const selectRequestsByRunId = database.prepare<[string], RequestRow>(`
    SELECT
      request_name, request_type, status, error_message,
      headers_summary_json, variables_summary, diff_text,
      reference_data_json, candidate_data_json
    FROM run_requests
    WHERE run_id = ?
    ORDER BY id ASC
  `);
  const selectAllRuns = database.prepare<[], RunRow>(`
    SELECT
      id, started_at, finished_at, duration_ms,
      reference_url, candidate_url, global_headers_json, queries_dir,
      total, passed, failed, errors, failed_comparisons_json
    FROM runs
    ORDER BY started_at DESC
  `);
  const insertTransaction = database.transaction((input: SaveRunInput) => {
    insertRun.run(
      input.runId,
      input.runResult.startedAt,
      input.runResult.finishedAt,
      input.runResult.durationMs,
      input.referenceUrl,
      input.candidateUrl,
      stringify(input.globalHeaders),
      input.queriesDir,
      input.runResult.summary.total,
      input.runResult.summary.passed,
      input.runResult.summary.failed,
      input.runResult.summary.errors,
      stringify(input.runResult.summary.failedComparisons),
    );

    for (const request of input.runResult.requests) {
      insertRequest.run(
        input.runId,
        request.name,
        request.type,
        request.status,
        request.errorMessage ?? null,
        stringify(request.headersSummary),
        request.variablesSummary,
        request.diffText ?? null,
        request.referenceData !== undefined
          ? stringify(request.referenceData)
          : null,
        request.candidateData !== undefined
          ? stringify(request.candidateData)
          : null,
      );
    }
  });

  return {
    saveRun(input): void {
      insertTransaction(input);
    },

    getRunById(runId): StoredRun | undefined {
      const runRow = selectRunById.get(runId);

      if (runRow === undefined) {
        return undefined;
      }

      const requestRows = selectRequestsByRunId.all(runId);

      return {
        id: runRow.id,
        referenceUrl: runRow.reference_url,
        candidateUrl: runRow.candidate_url,
        globalHeaders: parseHeaderPairs(runRow.global_headers_json),
        queriesDir: runRow.queries_dir,
        runResult: {
          startedAt: runRow.started_at,
          finishedAt: runRow.finished_at,
          durationMs: runRow.duration_ms,
          summary: {
            total: runRow.total,
            passed: runRow.passed,
            failed: runRow.failed,
            errors: runRow.errors,
            failedComparisons: parseStringArray(runRow.failed_comparisons_json),
          },
          requests: requestRows.map((requestRow) => ({
            name: requestRow.request_name,
            type: requestRow.request_type,
            status: requestRow.status,
            errorMessage: requestRow.error_message ?? undefined,
            headersSummary: parseStringArray(requestRow.headers_summary_json),
            variablesSummary: requestRow.variables_summary,
            diffText: requestRow.diff_text ?? undefined,
            referenceData: parseUnknown(requestRow.reference_data_json),
            candidateData: parseUnknown(requestRow.candidate_data_json),
          })),
        },
      };
    },

    listRuns(): ReadonlyArray<RunListItem> {
      const rows = selectAllRuns.all();
      return rows.map((row) => ({
        id: row.id,
        startedAt: row.started_at,
        referenceUrl: row.reference_url,
        candidateUrl: row.candidate_url,
        total: row.total,
        passed: row.passed,
        failed: row.failed,
        errors: row.errors,
        durationMs: row.duration_ms,
      }));
    },
  };
}
