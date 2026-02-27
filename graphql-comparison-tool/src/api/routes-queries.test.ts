import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "./server.js";

async function setupTempEnv(): Promise<{
  readonly tempBase: string;
  readonly tempDbPath: string;
  readonly tempQueriesDir: string;
  readonly cleanup: () => Promise<void>;
}> {
  const tempBase = await mkdtemp(join(tmpdir(), "es-queries-test-"));
  const tempDbPath = join(tempBase, "test.db");
  const tempQueriesDir = join(tempBase, "queries");
  const graphqlDir = join(tempQueriesDir, "graphql");
  await mkdir(graphqlDir, { recursive: true });

  return {
    tempBase,
    tempDbPath,
    tempQueriesDir,
    cleanup: () => rm(tempBase, { recursive: true, force: true }),
  };
}

test("GET /api/queries lists queries from temp dir", async () => {
  const { tempBase, tempDbPath, tempQueriesDir, cleanup } =
    await setupTempEnv();
  const graphqlDir = join(tempQueriesDir, "graphql");

  await writeFile(
    join(graphqlDir, "ping.graphql"),
    "query Ping { ping }",
    "utf-8",
  );
  await writeFile(
    join(graphqlDir, "ping.meta.json"),
    JSON.stringify({ headers: { "x-foo": "bar" }, variables: { id: 1 } }),
    "utf-8",
  );
  await writeFile(
    join(graphqlDir, "simple.graphql"),
    "query Simple { x }",
    "utf-8",
  );

  const api = createApiServer({
    port: 0,
    dbPath: tempDbPath,
    queriesDir: tempQueriesDir,
  });
  const { port, close } = await api.start();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/queries`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as ReadonlyArray<{
      name: string;
      type: string;
      query: string;
      headers?: Record<string, string>;
      variables?: Record<string, unknown>;
    }>;
    assert.equal(Array.isArray(body), true);
    assert.equal(body.length, 2);

    const ping = body.find((q) => q.name === "ping");
    assert.ok(ping);
    assert.equal(ping.type, "graphql");
    assert.equal(ping.query, "query Ping { ping }");
    assert.deepEqual(ping.headers, { "x-foo": "bar" });
    assert.deepEqual(ping.variables, { id: 1 });

    const simple = body.find((q) => q.name === "simple");
    assert.ok(simple);
    assert.equal(simple.type, "graphql");
    assert.equal(simple.query, "query Simple { x }");
  } finally {
    await close();
    await cleanup();
  }
});

test("POST /api/queries creates query files on disk", async () => {
  const { tempBase, tempDbPath, tempQueriesDir, cleanup } =
    await setupTempEnv();
  const graphqlDir = join(tempQueriesDir, "graphql");

  const api = createApiServer({
    port: 0,
    dbPath: tempDbPath,
    queriesDir: tempQueriesDir,
  });
  const { port, close } = await api.start();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/queries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "new-query",
        query: "query New { new }",
        headers: { "Authorization": "Bearer x" },
        variables: { limit: 10 },
      }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as {
      name: string;
      type: string;
      query: string;
      headers?: Record<string, string>;
      variables?: Record<string, unknown>;
    };
    assert.equal(body.name, "new-query");
    assert.equal(body.query, "query New { new }");

    const queryContent = await readFile(
      join(graphqlDir, "new-query.graphql"),
      "utf-8",
    );
    assert.equal(queryContent, "query New { new }");

    const metaContent = await readFile(
      join(graphqlDir, "new-query.meta.json"),
      "utf-8",
    );
    const meta = JSON.parse(metaContent) as {
      headers?: Record<string, string>;
      variables?: Record<string, unknown>;
    };
    assert.deepEqual(meta.headers, { Authorization: "Bearer x" });
    assert.deepEqual(meta.variables, { limit: 10 });
  } finally {
    await close();
    await cleanup();
  }
});

test("PUT /api/queries/:name updates query files", async () => {
  const { tempBase, tempDbPath, tempQueriesDir, cleanup } =
    await setupTempEnv();
  const graphqlDir = join(tempQueriesDir, "graphql");

  await writeFile(
    join(graphqlDir, "old.graphql"),
    "query Old { old }",
    "utf-8",
  );
  await writeFile(
    join(graphqlDir, "old.meta.json"),
    JSON.stringify({ variables: { x: 1 } }),
    "utf-8",
  );

  const api = createApiServer({
    port: 0,
    dbPath: tempDbPath,
    queriesDir: tempQueriesDir,
  });
  const { port, close } = await api.start();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/queries/old`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "query Updated { updated }",
        headers: { "x-new": "value" },
        variables: { y: 2 },
      }),
    });

    assert.equal(res.status, 200);

    const queryContent = await readFile(
      join(graphqlDir, "old.graphql"),
      "utf-8",
    );
    assert.equal(queryContent, "query Updated { updated }");

    const metaContent = await readFile(
      join(graphqlDir, "old.meta.json"),
      "utf-8",
    );
    const meta = JSON.parse(metaContent) as {
      headers?: Record<string, string>;
      variables?: Record<string, unknown>;
    };
    assert.deepEqual(meta.headers, { "x-new": "value" });
    assert.deepEqual(meta.variables, { y: 2 });
  } finally {
    await close();
    await cleanup();
  }
});

test("DELETE /api/queries/:name removes files", async () => {
  const { tempBase, tempDbPath, tempQueriesDir, cleanup } =
    await setupTempEnv();
  const graphqlDir = join(tempQueriesDir, "graphql");

  await writeFile(
    join(graphqlDir, "to-delete.graphql"),
    "query X { x }",
    "utf-8",
  );
  await writeFile(
    join(graphqlDir, "to-delete.meta.json"),
    "{}",
    "utf-8",
  );

  const api = createApiServer({
    port: 0,
    dbPath: tempDbPath,
    queriesDir: tempQueriesDir,
  });
  const { port, close } = await api.start();

  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/api/queries/to-delete`,
      { method: "DELETE" },
    );

    assert.equal(res.status, 204);

    const { access } = await import("node:fs/promises");
    await assert.rejects(
      () => access(join(graphqlDir, "to-delete.graphql")),
      { code: "ENOENT" },
    );
    await assert.rejects(
      () => access(join(graphqlDir, "to-delete.meta.json")),
      { code: "ENOENT" },
    );
  } finally {
    await close();
    await cleanup();
  }
});

test("GET /api/queries/:name returns single query", async () => {
  const { tempBase, tempDbPath, tempQueriesDir, cleanup } =
    await setupTempEnv();
  const graphqlDir = join(tempQueriesDir, "graphql");

  await writeFile(
    join(graphqlDir, "single.graphql"),
    "query Single { single }",
    "utf-8",
  );
  await writeFile(
    join(graphqlDir, "single.meta.json"),
    JSON.stringify({ variables: { id: 42 } }),
    "utf-8",
  );

  const api = createApiServer({
    port: 0,
    dbPath: tempDbPath,
    queriesDir: tempQueriesDir,
  });
  const { port, close } = await api.start();

  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/api/queries/single`,
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      name: string;
      type: string;
      query: string;
      variables?: Record<string, unknown>;
    };
    assert.equal(body.name, "single");
    assert.equal(body.type, "graphql");
    assert.equal(body.query, "query Single { single }");
    assert.deepEqual(body.variables, { id: 42 });
  } finally {
    await close();
    await cleanup();
  }
});

test("POST returns 409 for duplicate name", async () => {
  const { tempBase, tempDbPath, tempQueriesDir, cleanup } =
    await setupTempEnv();
  const graphqlDir = join(tempQueriesDir, "graphql");

  await writeFile(
    join(graphqlDir, "exists.graphql"),
    "query Exists { x }",
    "utf-8",
  );

  const api = createApiServer({
    port: 0,
    dbPath: tempDbPath,
    queriesDir: tempQueriesDir,
  });
  const { port, close } = await api.start();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/queries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "exists",
        query: "query New { new }",
      }),
    });

    assert.equal(res.status, 409);
    const body = (await res.json()) as { error: string };
    assert.ok(body.error.includes("already exists"));
  } finally {
    await close();
    await cleanup();
  }
});

test("PUT returns 404 for nonexistent query", async () => {
  const { tempBase, tempDbPath, tempQueriesDir, cleanup } =
    await setupTempEnv();

  const api = createApiServer({
    port: 0,
    dbPath: tempDbPath,
    queriesDir: tempQueriesDir,
  });
  const { port, close } = await api.start();

  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/api/queries/nonexistent`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "query X { x }" }),
      },
    );

    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.ok(body.error.includes("not found"));
  } finally {
    await close();
    await cleanup();
  }
});

test("DELETE returns 404 for nonexistent query", async () => {
  const { tempBase, tempDbPath, tempQueriesDir, cleanup } =
    await setupTempEnv();

  const api = createApiServer({
    port: 0,
    dbPath: tempDbPath,
    queriesDir: tempQueriesDir,
  });
  const { port, close } = await api.start();

  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/api/queries/nonexistent`,
      { method: "DELETE" },
    );

    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.ok(body.error.includes("not found"));
  } finally {
    await close();
    await cleanup();
  }
});
