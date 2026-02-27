import {
  maskSensitiveHeaders,
  runComparison,
} from "./core/comparison-runner.js";
import type { ReportInput } from "./core/comparison-result.js";

export type { ReportInput } from "./core/comparison-result.js";

function formatQueryDiff(
  name: string,
  status: "PASS" | "FAIL" | "ERROR",
  errorMessage: string | undefined,
  diffText: string | undefined,
  verbose: boolean,
): string {
  const lines: Array<string> = [];

  lines.push(`--- ${name} [${status}] ---`);

  if (errorMessage !== undefined) {
    lines.push(`  ${errorMessage}`);
  }

  if (status === "ERROR") {
    return lines.join("\n");
  }

  if (status === "FAIL" && diffText !== undefined) {
    lines.push(diffText);
  }

  if (status === "PASS" && verbose && diffText !== undefined) {
    if (diffText.length > 0) {
      lines.push(diffText);
    }
  }

  return lines.join("\n");
}

export function printReport(
  referenceUrl: string,
  candidateUrl: string,
  headers: ReadonlyArray<readonly [string, string]>,
  inputs: ReadonlyArray<ReportInput>,
  verbose: boolean,
): boolean {
  const maskedHeaders = maskSensitiveHeaders(headers);
  const result = runComparison(inputs);

  console.log("=== Comparison Report ===");
  console.log(`Reference: ${referenceUrl}`);
  console.log(`Candidate: ${candidateUrl}`);
  if (maskedHeaders.length > 0) {
    console.log(`Headers: ${maskedHeaders.join(", ")}`);
  }
  console.log("");

  for (const requestResult of result.requests) {
    console.log(
      formatQueryDiff(
        requestResult.name,
        requestResult.status,
        requestResult.errorMessage,
        requestResult.diffText,
        verbose,
      ),
    );
    console.log("");
  }

  const { summary } = result;
  console.log("=== Summary ===");
  console.log(
    `Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed} | Errors: ${summary.errors}`,
  );
  console.log("Headers summary:");
  for (const requestResult of result.requests) {
    if (requestResult.headersSummary.length === 0) {
      console.log(`  - ${requestResult.name}: none`);
      continue;
    }
    console.log(
      `  - ${requestResult.name}: ${requestResult.headersSummary.join(", ")}`,
    );
  }

  console.log("Variables summary:");
  for (const requestResult of result.requests) {
    console.log(`  - ${requestResult.name}: ${requestResult.variablesSummary}`);
  }

  if (summary.failedComparisons.length === 0) {
    console.log("Failed comparisons: none");
  } else {
    console.log(`Failed comparisons: ${summary.failedComparisons.join(", ")}`);
  }

  return summary.failed === 0 && summary.errors === 0;
}
