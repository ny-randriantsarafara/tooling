import { readdir, readFile, stat } from "node:fs/promises";
import { join, basename } from "node:path";

interface GraphQLRequest {
  readonly type: "graphql";
  readonly name: string;
  readonly query: string;
  readonly variables: Record<string, unknown> | undefined;
  readonly headers: ReadonlyArray<readonly [string, string]>;
}

interface RestRequest {
  readonly type: "rest";
  readonly name: string;
  readonly method: string;
  readonly path: string;
  readonly queryParams: Record<string, string> | undefined;
  readonly body: unknown | undefined;
  readonly headers: ReadonlyArray<readonly [string, string]>;
}

export type RequestDefinition = GraphQLRequest | RestRequest;

interface MetaJson {
  readonly headers?: Record<string, string>;
  readonly variables?: Record<string, unknown>;
  readonly method?: string;
  readonly path?: string;
  readonly queryParams?: Record<string, string>;
}

const GRAPHQL_EXTENSION = ".graphql";
const META_SUFFIX = ".meta.json";
const BODY_SUFFIX = ".body.json";
const GRAPHQL_SUBDIR = "graphql";
const REST_SUBDIR = "rest";

async function tryReadFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return undefined;
  }
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const info = await stat(dirPath);
    return info.isDirectory();
  } catch {
    return false;
  }
}

function headersFromRecord(
  record: Record<string, string> | undefined,
): ReadonlyArray<readonly [string, string]> {
  if (record === undefined) return [];
  return Object.entries(record).map(([key, value]) => [key, value] as const);
}

async function loadGraphQLRequests(
  graphqlDir: string,
): Promise<ReadonlyArray<GraphQLRequest>> {
  if (!(await dirExists(graphqlDir))) return [];

  const entries = await readdir(graphqlDir);
  const graphqlFiles = entries
    .filter((entry) => entry.endsWith(GRAPHQL_EXTENSION))
    .sort();

  const requests: Array<GraphQLRequest> = [];

  for (const file of graphqlFiles) {
    const name = basename(file, GRAPHQL_EXTENSION);
    const queryPath = join(graphqlDir, file);
    const metaPath = join(graphqlDir, `${name}${META_SUFFIX}`);

    const query = await readFile(queryPath, "utf-8");
    const metaRaw = await tryReadFile(metaPath);
    const meta: MetaJson | undefined =
      metaRaw !== undefined ? (JSON.parse(metaRaw) as MetaJson) : undefined;

    requests.push({
      type: "graphql",
      name,
      query,
      variables: meta?.variables,
      headers: headersFromRecord(meta?.headers),
    });
  }

  return requests;
}

async function loadRestRequests(
  restDir: string,
): Promise<ReadonlyArray<RestRequest>> {
  if (!(await dirExists(restDir))) return [];

  const entries = await readdir(restDir);
  const metaFiles = entries
    .filter((entry) => entry.endsWith(META_SUFFIX))
    .sort();

  const requests: Array<RestRequest> = [];

  for (const file of metaFiles) {
    const name = basename(file, META_SUFFIX);
    const metaPath = join(restDir, file);
    const bodyPath = join(restDir, `${name}${BODY_SUFFIX}`);

    const metaRaw = await readFile(metaPath, "utf-8");
    const meta = JSON.parse(metaRaw) as MetaJson;

    if (meta.path === undefined) {
      console.error(
        `REST request "${name}" is missing required "path" in ${file}`,
      );
      continue;
    }

    const bodyRaw = await tryReadFile(bodyPath);
    const body: unknown | undefined =
      bodyRaw !== undefined ? JSON.parse(bodyRaw) : undefined;

    requests.push({
      type: "rest",
      name,
      method: meta.method ?? "GET",
      path: meta.path,
      queryParams: meta.queryParams,
      body,
      headers: headersFromRecord(meta.headers),
    });
  }

  return requests;
}

export async function loadRequests(
  queriesDir: string,
): Promise<ReadonlyArray<RequestDefinition>> {
  const graphqlDir = join(queriesDir, GRAPHQL_SUBDIR);
  const restDir = join(queriesDir, REST_SUBDIR);

  const [graphqlRequests, restRequests] = await Promise.all([
    loadGraphQLRequests(graphqlDir),
    loadRestRequests(restDir),
  ]);

  return [...graphqlRequests, ...restRequests];
}
