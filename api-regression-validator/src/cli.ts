import { resolve } from "node:path";
import { loadRequests } from "./request-loader.js";
import { sendRequest } from "./http-client.js";
import type { HttpResponse } from "./http-client.js";
import { printReport } from "./reporter.js";
import type { ReportInput } from "./reporter.js";
import { runComparison } from "./core/comparison-runner.js";

interface CliArgs {
  readonly referenceUrl: string;
  readonly candidateUrl: string;
  readonly headers: ReadonlyArray<readonly [string, string]>;
  readonly queriesDir: string;
  readonly verbose: boolean;
  readonly json: boolean;
}

function parseHeader(raw: string): readonly [string, string] {
  const colonIndex = raw.indexOf(":");
  if (colonIndex === -1) {
    console.error(`Invalid header format: "${raw}". Expected "Key: Value".`);
    process.exit(1);
  }
  const key = raw.slice(0, colonIndex).trim();
  const value = raw.slice(colonIndex + 1).trim();
  return [key, value] as const;
}

export function parseArgs(argv: ReadonlyArray<string>): CliArgs {
  let referenceUrl: string | undefined;
  let candidateUrl: string | undefined;
  let queriesDir = "./queries";
  let verbose = false;
  let json = false;
  const headers: Array<readonly [string, string]> = [];

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    switch (arg) {
      case "--reference-url": {
        i++;
        referenceUrl = argv[i];
        break;
      }
      case "--candidate-url": {
        i++;
        candidateUrl = argv[i];
        break;
      }
      case "-H":
      case "--header": {
        i++;
        const headerValue = argv[i];
        if (headerValue === undefined) {
          console.error(`Missing value for ${arg}`);
          process.exit(1);
        }
        headers.push(parseHeader(headerValue));
        break;
      }
      case "--queries-dir": {
        i++;
        queriesDir = argv[i] ?? queriesDir;
        break;
      }
      case "--verbose":
      case "-v": {
        verbose = true;
        break;
      }
      case "--json": {
        json = true;
        break;
      }
      default: {
        console.error(`Unknown argument: ${arg}`);
        printUsage();
        process.exit(1);
      }
    }

    i++;
  }

  if (referenceUrl === undefined || candidateUrl === undefined) {
    console.error(
      "Missing required arguments: --reference-url and --candidate-url",
    );
    printUsage();
    process.exit(1);
  }

  return {
    referenceUrl,
    candidateUrl,
    headers,
    queriesDir: resolve(queriesDir),
    verbose,
    json,
  };
}

function printUsage(): void {
  console.log(`
Usage:
  npx tsx src/cli.ts --reference-url <url> --candidate-url <url> [options]

Required:
  --reference-url <url>    Reference server URL
  --candidate-url <url>    Candidate server URL

Options:
  -H, --header <Key: Value>   Global header sent with all requests (repeatable)
  --queries-dir <path>         Path to queries directory (default: ./queries)
  -v, --verbose                Show full response for passing requests too
  --json                       Print structured JSON result

Queries directory structure:
  queries/graphql/    .graphql files + optional .meta.json
  queries/rest/       .meta.json files + optional .body.json

Per-request headers in .meta.json override global -H headers.

Example:
  npx tsx src/cli.ts \\
    --reference-url https://ref.example.com \\
    --candidate-url https://candidate.example.com \\
    -H "Authorization: Bearer my-token"
`);
}

export async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.json) {
    console.log(`Loading requests from ${args.queriesDir}...\n`);
  }
  const requests = await loadRequests(args.queriesDir);

  if (requests.length === 0) {
    console.error(
      "No requests found. Add .graphql files in queries/graphql/ or .meta.json files in queries/rest/.",
    );
    process.exit(1);
  }

  if (!args.json) {
    console.log(`Found ${requests.length} requests. Running comparisons...\n`);
  }

  const reportInputs: Array<ReportInput> = [];

  for (const request of requests) {
    const [reference, candidate]: readonly [HttpResponse, HttpResponse] =
      await Promise.all([
        sendRequest(request, args.referenceUrl, args.headers),
        sendRequest(request, args.candidateUrl, args.headers),
      ]);

    const variables =
      request.type === "graphql" ? request.variables : undefined;

    reportInputs.push({
      name: request.name,
      type: request.type,
      headers: request.headers,
      variables,
      reference,
      candidate,
    });
  }

  if (args.json) {
    const runResult = runComparison(reportInputs);
    console.log(JSON.stringify(runResult, null, 2));
    const passed =
      runResult.summary.failed === 0 && runResult.summary.errors === 0;
    process.exit(passed ? 0 : 1);
  }

  const allPassed = printReport(
    args.referenceUrl,
    args.candidateUrl,
    args.headers,
    reportInputs,
    args.verbose,
  );

  process.exit(allPassed ? 0 : 1);
}

const entrypoint = process.argv[1];
if (entrypoint !== undefined && entrypoint.endsWith("src/cli.ts")) {
  run();
}
