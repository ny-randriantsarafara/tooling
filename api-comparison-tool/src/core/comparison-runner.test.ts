import test from "node:test";
import assert from "node:assert/strict";
import { runComparison } from "./comparison-runner.js";
import type { ReportInput } from "./comparison-result.js";
import type { HttpResponse } from "../http-client.js";

function makeInput(
  name: string,
  reference: HttpResponse,
  candidate: HttpResponse,
  headers: ReadonlyArray<readonly [string, string]> = [],
  variables: Record<string, unknown> | undefined = undefined,
): ReportInput {
  return {
    name,
    type: "graphql",
    headers,
    variables,
    reference,
    candidate,
  };
}

test("runComparison returns correct summary counts for PASS and FAIL", () => {
  const inputs: ReadonlyArray<ReportInput> = [
    makeInput(
      "passing-query",
      { ok: true, data: { a: 1 }, errors: undefined },
      { ok: true, data: { a: 1 }, errors: undefined },
      [["x-market", "fr"]],
      { id: "123" },
    ),
    makeInput(
      "failing-query",
      { ok: true, data: { a: 1 }, errors: undefined },
      { ok: true, data: { a: 2 }, errors: undefined },
      [["x-market", "es"]],
      { id: "999" },
    ),
  ];

  const result = runComparison(inputs);

  assert.strictEqual(result.summary.total, 2);
  assert.strictEqual(result.summary.passed, 1);
  assert.strictEqual(result.summary.failed, 1);
  assert.strictEqual(result.summary.errors, 0);
  assert.deepStrictEqual(result.summary.failedComparisons, ["failing-query"]);
  assert.strictEqual(result.requests.length, 2);
});

test("runComparison increments errors for non-ok responses", () => {
  const inputs: ReadonlyArray<ReportInput> = [
    makeInput(
      "error-query",
      { ok: false, error: "HTTP 500" },
      { ok: true, data: {}, errors: undefined },
    ),
  ];

  const result = runComparison(inputs);

  assert.strictEqual(result.summary.total, 1);
  assert.strictEqual(result.summary.errors, 1);
  assert.deepStrictEqual(result.summary.failedComparisons, []);
});

test("runComparison returns failed comparisons list", () => {
  const inputs: ReadonlyArray<ReportInput> = [
    makeInput(
      "passing-query",
      { ok: true, data: { same: true }, errors: undefined },
      { ok: true, data: { same: true }, errors: undefined },
    ),
    makeInput(
      "failing-query",
      { ok: true, data: { x: 1 }, errors: undefined },
      { ok: true, data: { x: 2 }, errors: undefined },
    ),
  ];

  const result = runComparison(inputs);

  assert.deepStrictEqual(result.summary.failedComparisons, ["failing-query"]);
});

test("runComparison returns metadata summaries for each request", () => {
  const inputs: ReadonlyArray<ReportInput> = [
    makeInput(
      "passing-query",
      { ok: true, data: {}, errors: undefined },
      { ok: true, data: {}, errors: undefined },
      [["x-market", "fr"]],
      { id: "123" },
    ),
    makeInput(
      "failing-query",
      { ok: true, data: { a: 1 }, errors: undefined },
      { ok: true, data: { a: 2 }, errors: undefined },
      [["x-locale", "en"]],
      { id: "999" },
    ),
  ];

  const result = runComparison(inputs);

  assert.strictEqual(result.requests.length, 2);

  const passMeta = result.requests.find((r) => r.name === "passing-query");
  if (!passMeta) assert.fail("passing-query metadata should exist");
  assert.deepStrictEqual(passMeta.headersSummary, ["x-market: fr"]);
  assert.strictEqual(passMeta.variablesSummary, '{"id":"123"}');

  const failMeta = result.requests.find((r) => r.name === "failing-query");
  if (!failMeta) assert.fail("failing-query metadata should exist");
  assert.deepStrictEqual(failMeta.headersSummary, ["x-locale: en"]);
  assert.strictEqual(failMeta.variablesSummary, '{"id":"999"}');
});

test("runComparison handles metadata edge cases and masking", () => {
  const inputs: ReadonlyArray<ReportInput> = [
    makeInput(
      "no-variables",
      { ok: true, data: { ok: true }, errors: undefined },
      { ok: true, data: { ok: true }, errors: undefined },
      [["authorization", "Bearer secret-token"]],
      undefined,
    ),
    makeInput(
      "empty-variables",
      { ok: true, data: { ok: true }, errors: undefined },
      { ok: true, data: { ok: true }, errors: undefined },
      [],
      {},
    ),
  ];

  const result = runComparison(inputs);
  assert.deepStrictEqual(result.requests[0]?.headersSummary, [
    "authorization: ***",
  ]);
  assert.strictEqual(result.requests[0]?.variablesSummary, "none");
  assert.strictEqual(result.requests[1]?.variablesSummary, "empty object");
});
