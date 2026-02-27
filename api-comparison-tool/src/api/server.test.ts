import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer as createMockGraphql } from "node:http";
import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "./server.js";

function startMockGraphqlServer(): Promise<{
  readonly url: string;
  readonly close: () => Promise<void>;
}> {
  return new Promise((resolve, reject) => {
    const server = createMockGraphql((_, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ data: { ping: "pong" } }));
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") {
        reject(new Error("Failed to bind mock server"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise<void>((r, rj) => {
            server.close((e) => (e ? rj(e) : r()));
          }),
      });
    });
  });
}

async function setupTempQueries(): Promise<{
  readonly queriesDir: string;
  readonly cleanup: () => Promise<void>;
}> {
  const tmpBase = await mkdtemp(join(tmpdir(), "es-api-test-"));
  const queriesDir = join(tmpBase, "queries");
  const graphqlDir = join(queriesDir, "graphql");
  await mkdir(graphqlDir, { recursive: true });
  await writeFile(
    join(graphqlDir, "ping.graphql"),
    "query Ping { ping }",
    "utf-8",
  );

  return {
    queriesDir,
    cleanup: () => rm(tmpBase, { recursive: true, force: true }),
  };
}

async function setupTempQueriesWithTwo(): Promise<{
  readonly queriesDir: string;
  readonly cleanup: () => Promise<void>;
}> {
  const tmpBase = await mkdtemp(join(tmpdir(), "es-api-test-two-"));
  const queriesDir = join(tmpBase, "queries");
  const graphqlDir = join(queriesDir, "graphql");
  await mkdir(graphqlDir, { recursive: true });
  await writeFile(
    join(graphqlDir, "ping.graphql"),
    "query Ping { ping }",
    "utf-8",
  );
  await writeFile(
    join(graphqlDir, "pong.graphql"),
    "query Pong { pong }",
    "utf-8",
  );

  return {
    queriesDir,
    cleanup: () => rm(tmpBase, { recursive: true, force: true }),
  };
}

test("GET /api/runs returns empty list initially", async () => {
  const tmpBase = await mkdtemp(join(tmpdir(), "es-api-empty-"));
  const dbPath = join(tmpBase, "test.db");

  const api = createApiServer({ port: 0, dbPath });
  const { port, close } = await api.start();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/runs`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as ReadonlyArray<unknown>;
    assert.equal(Array.isArray(body), true);
    assert.equal(body.length, 0);
  } finally {
    await close();
    await rm(tmpBase, { recursive: true, force: true });
  }
});

test("POST /api/runs creates run and GET /api/runs/:id returns it", async () => {
  const tmpBase = await mkdtemp(join(tmpdir(), "es-api-run-"));
  const dbPath = join(tmpBase, "test.db");
  const { queriesDir, cleanup } = await setupTempQueries();

  const mock = await startMockGraphqlServer();
  const api = createApiServer({ port: 0, dbPath });
  const { port, close } = await api.start();

  try {
    const postRes = await fetch(`http://127.0.0.1:${port}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        referenceUrl: mock.url,
        candidateUrl: mock.url,
        globalHeaders: [],
        queriesDir,
      }),
    });

    assert.equal(postRes.status, 201);
    const postBody = (await postRes.json()) as {
      runId: string;
      summary: { total: number };
    };
    assert.equal(typeof postBody.runId, "string");
    assert.equal(postBody.summary.total, 1);

    const getRes = await fetch(
      `http://127.0.0.1:${port}/api/runs/${postBody.runId}`,
    );
    assert.equal(getRes.status, 200);
    const getBody = (await getRes.json()) as {
      id: string;
      runResult: { summary: { total: number } };
    };
    assert.equal(getBody.id, postBody.runId);
    assert.equal(getBody.runResult.summary.total, 1);
  } finally {
    await close();
    await mock.close();
    await cleanup();
    await rm(tmpBase, { recursive: true, force: true });
  }
});

test("POST /api/runs returns 400 for invalid payload", async () => {
  const tmpBase = await mkdtemp(join(tmpdir(), "es-api-bad-"));
  const dbPath = join(tmpBase, "test.db");

  const api = createApiServer({ port: 0, dbPath });
  const { port, close } = await api.start();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bad: true }),
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(typeof body.error, "string");
  } finally {
    await close();
    await rm(tmpBase, { recursive: true, force: true });
  }
});

test("GET /api/runs/:id returns 404 for unknown run", async () => {
  const tmpBase = await mkdtemp(join(tmpdir(), "es-api-404-"));
  const dbPath = join(tmpBase, "test.db");

  const api = createApiServer({ port: 0, dbPath });
  const { port, close } = await api.start();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/runs/nonexistent`);
    assert.equal(res.status, 404);
  } finally {
    await close();
    await rm(tmpBase, { recursive: true, force: true });
  }
});

test("POST /api/runs respects selectedRequests filter", async () => {
  const tmpBase = await mkdtemp(join(tmpdir(), "es-api-selected-"));
  const dbPath = join(tmpBase, "test.db");
  const { queriesDir, cleanup } = await setupTempQueriesWithTwo();

  const mock = await startMockGraphqlServer();
  const api = createApiServer({ port: 0, dbPath });
  const { port, close } = await api.start();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        referenceUrl: mock.url,
        candidateUrl: mock.url,
        globalHeaders: [],
        queriesDir,
        selectedRequests: ["ping"],
      }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as {
      runId: string;
      summary: { total: number };
    };
    assert.equal(body.summary.total, 1);
  } finally {
    await close();
    await mock.close();
    await cleanup();
    await rm(tmpBase, { recursive: true, force: true });
  }
});

test("POST /api/runs applies perRequestHeaders overrides", async () => {
  const tmpBase = await mkdtemp(join(tmpdir(), "es-api-headers-"));
  const dbPath = join(tmpBase, "test.db");
  const { queriesDir, cleanup } = await setupTempQueries();

  const mock = await startMockGraphqlServer();
  const api = createApiServer({ port: 0, dbPath });
  const { port, close } = await api.start();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        referenceUrl: mock.url,
        candidateUrl: mock.url,
        globalHeaders: [],
        queriesDir,
        perRequestHeaders: { ping: [["x-override", "yes"]] },
      }),
    });

    assert.equal(res.status, 201);
  } finally {
    await close();
    await mock.close();
    await cleanup();
    await rm(tmpBase, { recursive: true, force: true });
  }
});
