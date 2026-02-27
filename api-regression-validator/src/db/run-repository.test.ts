import test from "node:test";
import assert from "node:assert/strict";
import { createRunRepository } from "./run-repository.js";
import type { ComparisonRunResult } from "../core/comparison-result.js";

test("repository stores run and request rows and reads run details", () => {
  const repository = createRunRepository(":memory:");
  const runResult: ComparisonRunResult = {
    startedAt: "2026-02-27T10:00:00.000Z",
    finishedAt: "2026-02-27T10:00:01.000Z",
    durationMs: 1000,
    summary: {
      total: 2,
      passed: 1,
      failed: 1,
      errors: 0,
      failedComparisons: ["failing-query"],
    },
    requests: [
      {
        name: "passing-query",
        type: "graphql",
        status: "PASS",
        errorMessage: undefined,
        headersSummary: ["x-market: fr"],
        variablesSummary: '{"id":"123"}',
        diffText: undefined,
        referenceData: { a: 1 },
        candidateData: { a: 1 },
      },
      {
        name: "failing-query",
        type: "graphql",
        status: "FAIL",
        errorMessage: undefined,
        headersSummary: ["x-market: es"],
        variablesSummary: '{"id":"999"}',
        diffText: "{ -a:1 +a:2 }",
        referenceData: { a: 1 },
        candidateData: { a: 2 },
      },
    ],
  };

  repository.saveRun({
    runId: "run-1",
    referenceUrl: "https://ref.example",
    candidateUrl: "https://cand.example",
    globalHeaders: [["authorization", "***"]],
    queriesDir: "/tmp/queries",
    runResult,
  });

  const run = repository.getRunById("run-1");
  assert.notEqual(run, undefined);
  assert.equal(run?.runResult.summary.failed, 1);
  assert.equal(run?.runResult.requests.length, 2);
});
