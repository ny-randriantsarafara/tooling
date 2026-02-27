import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { loadRequests } from "../request-loader.js";
import { sendRequest } from "../http-client.js";
import type { HttpResponse } from "../http-client.js";
import { runComparison } from "../core/comparison-runner.js";
import type { ReportInput } from "../core/comparison-result.js";
import {
  createRunRepository,
  type RunRepository,
} from "../db/run-repository.js";
import { validateRunPayload } from "./validation.js";
import {
  handleListQueries,
  handleGetQuery,
  handleCreateQuery,
  handleUpdateQuery,
  handleDeleteQuery,
} from "./routes-queries.js";

const DEFAULT_PORT = 4310;
const DEFAULT_DB_PATH = "runs.db";
const DEFAULT_QUERIES_DIR = "./queries";

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  data: unknown,
): void {
  setCorsHeaders(res);
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function sendError(
  res: ServerResponse,
  statusCode: number,
  message: string,
): void {
  sendJson(res, statusCode, { error: message });
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Array<Buffer> = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function parseRunIdFromUrl(url: string): string | undefined {
  const match = /^\/api\/runs\/([^/]+)$/.exec(url);
  return match?.[1];
}

function parseQueryNameFromUrl(url: string): string | undefined {
  const match = /^\/api\/queries\/([^/]+)$/.exec(url);
  return match?.[1];
}

async function handlePostRun(
  req: IncomingMessage,
  res: ServerResponse,
  repository: RunRepository,
): Promise<void> {
  const rawBody = await readBody(req);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    sendError(res, 400, "Invalid JSON body");
    return;
  }

  const validation = validateRunPayload(parsed);
  if (!validation.ok) {
    sendError(res, 400, validation.error);
    return;
  }

  const {
    referenceUrl,
    candidateUrl,
    globalHeaders,
    queriesDir,
    selectedRequests,
    perRequestHeaders,
  } = validation.payload;
  const resolvedQueriesDir = resolve(queriesDir);
  const runId = randomUUID();

  try {
    const requests = await loadRequests(resolvedQueriesDir);
    const filteredRequests =
      selectedRequests !== undefined
        ? requests.filter((r) => selectedRequests.includes(r.name))
        : requests;

    if (filteredRequests.length === 0) {
      sendError(res, 400, "No requests found in the queries directory");
      return;
    }

    const reportInputs: Array<ReportInput> = [];
    for (const request of filteredRequests) {
      const extraHeaders = perRequestHeaders?.[request.name] ?? [];
      const requestWithOverrides = {
        ...request,
        headers: [...(request.headers ?? []), ...extraHeaders],
      };
      const [reference, candidate]: readonly [HttpResponse, HttpResponse] =
        await Promise.all([
          sendRequest(requestWithOverrides, referenceUrl, globalHeaders),
          sendRequest(requestWithOverrides, candidateUrl, globalHeaders),
        ]);

      const variables =
        request.type === "graphql" ? request.variables : undefined;

      reportInputs.push({
        name: request.name,
        type: request.type,
        headers: requestWithOverrides.headers,
        variables,
        reference,
        candidate,
      });
    }

    const runResult = runComparison(reportInputs);

    repository.saveRun({
      runId,
      referenceUrl,
      candidateUrl,
      globalHeaders,
      queriesDir: resolvedQueriesDir,
      runResult,
    });

    sendJson(res, 201, { runId, ...runResult });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendError(res, 500, message);
  }
}

function handleGetRuns(res: ServerResponse, repository: RunRepository): void {
  const runs = repository.listRuns();
  sendJson(res, 200, runs);
}

function handleGetRunById(
  res: ServerResponse,
  repository: RunRepository,
  runId: string,
): void {
  const run = repository.getRunById(runId);
  if (run === undefined) {
    sendError(res, 404, `Run "${runId}" not found`);
    return;
  }
  sendJson(res, 200, run);
}

async function handleGetRequests(
  res: ServerResponse,
  queriesDir: string,
): Promise<void> {
  try {
    const requests = await loadRequests(resolve(queriesDir));
    const summary = requests.map((r) => ({
      name: r.name,
      type: r.type,
    }));
    sendJson(res, 200, summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendError(res, 500, message);
  }
}

export function createApiServer(options?: {
  readonly port?: number;
  readonly dbPath?: string;
  readonly queriesDir?: string;
}): {
  readonly start: () => Promise<{
    readonly port: number;
    readonly close: () => Promise<void>;
  }>;
} {
  const port = options?.port ?? DEFAULT_PORT;
  const dbPath = options?.dbPath ?? DEFAULT_DB_PATH;
  const queriesDir = resolve(options?.queriesDir ?? DEFAULT_QUERIES_DIR);

  return {
    start() {
      const repository = createRunRepository(dbPath);

      return new Promise((resolveStart, rejectStart) => {
        const server = createServer(async (req, res) => {
          const method = req.method ?? "GET";
          const url = req.url ?? "/";

          setCorsHeaders(res);
          if (method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
          }

          try {
            if (method === "POST" && url === "/api/runs") {
              await handlePostRun(req, res, repository);
              return;
            }

            if (method === "GET" && url === "/api/runs") {
              handleGetRuns(res, repository);
              return;
            }

            const runId = parseRunIdFromUrl(url);
            if (method === "GET" && runId !== undefined) {
              handleGetRunById(res, repository, runId);
              return;
            }

            if (method === "GET" && url === "/api/requests") {
              await handleGetRequests(res, queriesDir);
              return;
            }

            if (method === "GET" && url === "/api/queries") {
              await handleListQueries(res, queriesDir);
              return;
            }

            const queryName = parseQueryNameFromUrl(url);
            if (method === "GET" && queryName !== undefined) {
              await handleGetQuery(res, queriesDir, queryName);
              return;
            }

            if (method === "POST" && url === "/api/queries") {
              await handleCreateQuery(req, res, queriesDir);
              return;
            }

            if (method === "PUT" && queryName !== undefined) {
              await handleUpdateQuery(req, res, queriesDir, queryName);
              return;
            }

            if (method === "DELETE" && queryName !== undefined) {
              await handleDeleteQuery(res, queriesDir, queryName);
              return;
            }

            sendError(res, 404, "Not found");
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            sendError(res, 500, message);
          }
        });

        server.on("error", rejectStart);
        server.listen(port, "127.0.0.1", () => {
          const address = server.address();
          const resolvedPort =
            address !== null && typeof address !== "string"
              ? address.port
              : port;

          resolveStart({
            port: resolvedPort,
            close: () =>
              new Promise<void>((closeResolve, closeReject) => {
                server.close((err) => {
                  if (err) {
                    closeReject(err);
                    return;
                  }
                  closeResolve();
                });
              }),
          });
        });
      });
    },
  };
}

const isEntrypoint =
  process.argv[1] !== undefined && process.argv[1].endsWith("api/server.ts");
if (isEntrypoint) {
  const apiServer = createApiServer();
  apiServer.start().then(({ port: boundPort }) => {
    console.log(`API server running at http://127.0.0.1:${boundPort}`);
  });
}
