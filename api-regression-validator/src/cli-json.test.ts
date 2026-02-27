import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "./cli.js";
import { runComparison } from "./core/comparison-runner.js";
import type { ReportInput } from "./core/comparison-result.js";

test("parseArgs enables json mode when --json is provided", () => {
  const args = parseArgs([
    "--reference-url",
    "https://ref.example",
    "--candidate-url",
    "https://cand.example",
    "--json",
  ]);

  assert.strictEqual(args.json, true);
});

test("json mode output shape includes summary.failedComparisons and requests", () => {
  const reportInputs: ReadonlyArray<ReportInput> = [
    {
      name: "ping",
      type: "graphql",
      headers: [],
      variables: { id: "1" },
      reference: { ok: true, data: { value: 1 }, errors: undefined },
      candidate: { ok: true, data: { value: 1 }, errors: undefined },
    },
  ];
  const runResult = runComparison(reportInputs);
  const parsed = JSON.parse(JSON.stringify(runResult)) as {
    readonly summary: {
      readonly total: number;
      readonly failedComparisons: ReadonlyArray<string>;
    };
    readonly requests: ReadonlyArray<unknown>;
  };

  assert.equal(parsed.summary.total, 1);
  assert.deepEqual(parsed.summary.failedComparisons, []);
  assert.equal(Array.isArray(parsed.requests), true);
});
