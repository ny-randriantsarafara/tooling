import test from "node:test";
import assert from "node:assert/strict";
import { printReport, type ReportInput } from "./reporter.js";

function captureLogs(run: () => void): ReadonlyArray<string> {
  const messages: Array<string> = [];
  const originalLog = console.log;
  console.log = (...args: ReadonlyArray<unknown>) => {
    messages.push(args.map((arg) => String(arg)).join(" "));
  };

  try {
    run();
  } finally {
    console.log = originalLog;
  }

  return messages;
}

test("summary includes request headers, variables and failed comparisons", () => {
  const inputs: ReadonlyArray<ReportInput> = [
    {
      name: "playlist-by-database-id",
      type: "graphql",
      headers: [["x-market", "fr"]] as const,
      variables: { id: "123" },
      reference: { ok: true, data: { data: "same" }, errors: undefined },
      candidate: { ok: true, data: { data: "same" }, errors: undefined },
    },
    {
      name: "picture-by-database-id",
      type: "graphql",
      headers: [["x-market", "es"]] as const,
      variables: { id: "999" },
      reference: { ok: true, data: { data: "left" }, errors: undefined },
      candidate: { ok: true, data: { data: "right" }, errors: undefined },
    },
  ];

  const output = captureLogs(() => {
    printReport(
      "https://ref.example",
      "https://cand.example",
      [],
      inputs,
      false,
    );
  }).join("\n");

  assert.match(output, /Headers summary:/);
  assert.match(output, /Variables summary:/);
  assert.match(output, /Failed comparisons: picture-by-database-id/);
});
