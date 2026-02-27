import {
  readdir,
  readFile,
  writeFile,
  unlink,
  stat,
  mkdir,
} from "node:fs/promises";
import { join, basename } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const GRAPHQL_EXTENSION = ".graphql";
const META_SUFFIX = ".meta.json";
const GRAPHQL_SUBDIR = "graphql";

export interface QueryItem {
  readonly name: string;
  readonly type: "graphql";
  readonly query: string;
  readonly headers?: Record<string, string>;
  readonly variables?: Record<string, unknown>;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Array<Buffer> = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
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

function graphqlDir(queriesDir: string): string {
  return join(queriesDir, GRAPHQL_SUBDIR);
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const info = await stat(dirPath);
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

export async function handleListQueries(
  res: ServerResponse,
  queriesDir: string,
): Promise<void> {
  const dir = graphqlDir(queriesDir);
  if (!(await dirExists(dir))) {
    sendJson(res, 200, []);
    return;
  }

  const entries = await readdir(dir);
  const graphqlFiles = entries
    .filter((entry) => entry.endsWith(GRAPHQL_EXTENSION))
    .sort();

  const items: Array<QueryItem> = [];

  for (const file of graphqlFiles) {
    const name = basename(file, GRAPHQL_EXTENSION);
    const queryPath = join(dir, file);
    const metaPath = join(dir, `${name}${META_SUFFIX}`);

    const query = await readFile(queryPath, "utf-8");
    let headers: Record<string, string> | undefined;
    let variables: Record<string, unknown> | undefined;

    try {
      const metaRaw = await readFile(metaPath, "utf-8");
      const meta = JSON.parse(metaRaw) as {
        headers?: Record<string, string>;
        variables?: Record<string, unknown>;
      };
      headers = meta.headers;
      variables = meta.variables;
    } catch {
      // No meta file or invalid JSON
    }

    items.push({
      name,
      type: "graphql",
      query,
      headers,
      variables,
    });
  }

  sendJson(res, 200, items);
}

export async function handleGetQuery(
  res: ServerResponse,
  queriesDir: string,
  name: string,
): Promise<void> {
  const dir = graphqlDir(queriesDir);
  const queryPath = join(dir, `${name}${GRAPHQL_EXTENSION}`);

  if (!(await fileExists(queryPath))) {
    sendError(res, 404, `Query "${name}" not found`);
    return;
  }

  const query = await readFile(queryPath, "utf-8");
  const metaPath = join(dir, `${name}${META_SUFFIX}`);

  let headers: Record<string, string> | undefined;
  let variables: Record<string, unknown> | undefined;

  try {
    const metaRaw = await readFile(metaPath, "utf-8");
    const meta = JSON.parse(metaRaw) as {
      headers?: Record<string, string>;
      variables?: Record<string, unknown>;
    };
    headers = meta.headers;
    variables = meta.variables;
  } catch {
    // No meta file or invalid JSON
  }

  sendJson(res, 200, {
    name,
    type: "graphql" as const,
    query,
    headers,
    variables,
  });
}

interface CreateQueryBody {
  readonly name: string;
  readonly query: string;
  readonly headers?: Record<string, string>;
  readonly variables?: Record<string, unknown>;
}

function isValidCreateBody(body: unknown): body is CreateQueryBody {
  if (body === null || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  return (
    typeof record.name === "string" &&
    record.name !== "" &&
    typeof record.query === "string"
  );
}

export async function handleCreateQuery(
  req: IncomingMessage,
  res: ServerResponse,
  queriesDir: string,
): Promise<void> {
  const rawBody = await readBody(req);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    sendError(res, 400, "Invalid JSON body");
    return;
  }

  if (!isValidCreateBody(parsed)) {
    sendError(res, 400, "Body must include name and query as non-empty strings");
    return;
  }

  const dir = graphqlDir(queriesDir);
  const queryPath = join(dir, `${parsed.name}${GRAPHQL_EXTENSION}`);
  const metaPath = join(dir, `${parsed.name}${META_SUFFIX}`);

  if (await fileExists(queryPath)) {
    sendError(res, 409, `Query "${parsed.name}" already exists`);
    return;
  }

  await mkdir(dir, { recursive: true });
  await writeFile(queryPath, parsed.query, "utf-8");

  const meta: { headers?: Record<string, string>; variables?: Record<string, unknown> } = {};
  if (parsed.headers !== undefined) meta.headers = parsed.headers;
  if (parsed.variables !== undefined) meta.variables = parsed.variables;

  if (Object.keys(meta).length > 0) {
    await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
  }

  sendJson(res, 201, {
    name: parsed.name,
    type: "graphql" as const,
    query: parsed.query,
    headers: parsed.headers,
    variables: parsed.variables,
  });
}

interface UpdateQueryBody {
  readonly query?: string;
  readonly headers?: Record<string, string>;
  readonly variables?: Record<string, unknown>;
}

function isValidUpdateBody(body: unknown): body is UpdateQueryBody {
  if (body === null || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  if (record.query !== undefined && typeof record.query !== "string") return false;
  if (record.headers !== undefined) {
    if (typeof record.headers !== "object" || record.headers === null) return false;
    const h = record.headers as Record<string, unknown>;
    if (!Object.values(h).every((v) => typeof v === "string")) return false;
  }
  return true;
}

export async function handleUpdateQuery(
  req: IncomingMessage,
  res: ServerResponse,
  queriesDir: string,
  name: string,
): Promise<void> {
  const rawBody = await readBody(req);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    sendError(res, 400, "Invalid JSON body");
    return;
  }

  if (!isValidUpdateBody(parsed)) {
    sendError(res, 400, "Invalid body: query must be string, headers/variables must be objects");
    return;
  }

  const dir = graphqlDir(queriesDir);
  const queryPath = join(dir, `${name}${GRAPHQL_EXTENSION}`);
  const metaPath = join(dir, `${name}${META_SUFFIX}`);

  if (!(await fileExists(queryPath))) {
    sendError(res, 404, `Query "${name}" not found`);
    return;
  }

  if (parsed.query !== undefined) {
    await writeFile(queryPath, parsed.query, "utf-8");
  }

  const existingMeta: { headers?: Record<string, string>; variables?: Record<string, unknown> } = {};
  try {
    const metaRaw = await readFile(metaPath, "utf-8");
    Object.assign(existingMeta, JSON.parse(metaRaw) as object);
  } catch {
    // No meta or invalid
  }

  if (parsed.headers !== undefined) existingMeta.headers = parsed.headers;
  if (parsed.variables !== undefined) existingMeta.variables = parsed.variables;

  const query =
    parsed.query !== undefined
      ? parsed.query
      : await readFile(queryPath, "utf-8");

  await writeFile(
    metaPath,
    JSON.stringify(
      {
        headers: existingMeta.headers,
        variables: existingMeta.variables,
      },
      null,
      2,
    ),
    "utf-8",
  );

  sendJson(res, 200, {
    name,
    type: "graphql" as const,
    query,
    headers: existingMeta.headers,
    variables: existingMeta.variables,
  });
}

export async function handleDeleteQuery(
  res: ServerResponse,
  queriesDir: string,
  name: string,
): Promise<void> {
  const dir = graphqlDir(queriesDir);
  const queryPath = join(dir, `${name}${GRAPHQL_EXTENSION}`);
  const metaPath = join(dir, `${name}${META_SUFFIX}`);

  if (!(await fileExists(queryPath))) {
    sendError(res, 404, `Query "${name}" not found`);
    return;
  }

  await unlink(queryPath);
  try {
    await unlink(metaPath);
  } catch {
    // Meta may not exist
  }

  setCorsHeaders(res);
  res.writeHead(204);
  res.end();
}
