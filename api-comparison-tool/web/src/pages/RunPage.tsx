import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  createRun,
  listQueries,
  type PostRunResponse,
  type QueryItem,
} from "../api";
import KeyValueEditor from "../components/KeyValueEditor";

export default function RunPage() {
  const navigate = useNavigate();
  const [referenceUrl, setReferenceUrl] = useState("");
  const [candidateUrl, setCandidateUrl] = useState("");
  const [queriesDir, setQueriesDir] = useState("./queries");
  const [headersRaw, setHeadersRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [queries, setQueries] = useState<ReadonlyArray<QueryItem>>([]);
  const [queriesLoading, setQueriesLoading] = useState(false);
  const [queriesError, setQueriesError] = useState<string | null>(null);
  const [selectedQueries, setSelectedQueries] = useState<
    ReadonlyArray<string>
  >([]);
  const [perRequestHeaders, setPerRequestHeaders] = useState<
    Record<string, ReadonlyArray<readonly [string, string]>>
  >({});
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);

  function parseHeaders(): ReadonlyArray<readonly [string, string]> {
    if (headersRaw.trim() === "") return [];
    return headersRaw
      .split("\n")
      .filter((line) => line.includes(":"))
      .map((line) => {
        const idx = line.indexOf(":");
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()] as const;
      });
  }

  async function handleLoadQueries() {
    setQueriesLoading(true);
    setQueriesError(null);
    try {
      const list = await listQueries();
      setQueries(list);
      setSelectedQueries(list.map((q) => q.name));
    } catch (err) {
      setQueriesError(err instanceof Error ? err.message : String(err));
    } finally {
      setQueriesLoading(false);
    }
  }

  function toggleQuery(name: string) {
    setSelectedQueries((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : [...prev, name],
    );
  }

  function toggleAllQueries() {
    if (selectedQueries.length === queries.length) {
      setSelectedQueries([]);
    } else {
      setSelectedQueries(queries.map((q) => q.name));
    }
  }

  function setHeadersForQuery(
    name: string,
    pairs: ReadonlyArray<readonly [string, string]>,
  ) {
    setPerRequestHeaders((prev) => {
      const next = { ...prev };
      if (pairs.length === 0) {
        delete next[name];
      } else {
        next[name] = pairs;
      }
      return next;
    });
  }

  function getHeadersForQuery(
    name: string,
  ): ReadonlyArray<readonly [string, string]> {
    return perRequestHeaders[name] ?? [];
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const filteredPerRequestHeaders =
        Object.keys(perRequestHeaders).length > 0
          ? Object.fromEntries(
              Object.entries(perRequestHeaders).filter(
                ([name, pairs]) =>
                  selectedQueries.includes(name) && pairs.length > 0,
              ),
            )
          : undefined;

      const payload = {
        referenceUrl,
        candidateUrl,
        globalHeaders: parseHeaders(),
        queriesDir,
        ...(selectedQueries.length > 0 && {
          selectedRequests: selectedQueries,
        }),
        ...(filteredPerRequestHeaders !== undefined &&
          Object.keys(filteredPerRequestHeaders).length > 0 && {
            perRequestHeaders: filteredPerRequestHeaders,
          }),
      };
      const result: PostRunResponse = await createRun(payload);
      navigate(`/runs/${result.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const cardStyle = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
    padding: "1.25rem",
    marginBottom: "1rem",
  };

  const labelStyle = {
    display: "block" as const,
    fontSize: "0.8125rem",
    fontWeight: 600 as const,
    color: "var(--color-text-secondary)",
    marginBottom: "0.375rem",
  };

  return (
    <div>
      <h2
        style={{
          margin: "0 0 0.25rem",
          fontSize: "1.5rem",
          fontWeight: 700,
        }}
      >
        Launch Comparison Run
      </h2>
      <p
        style={{
          margin: "0 0 1.5rem",
          fontSize: "0.875rem",
          color: "var(--color-text-secondary)",
        }}
      >
        Compare GraphQL responses between two endpoints.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column" }}
      >
        <div style={cardStyle}>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              marginBottom: "1rem",
              color: "var(--color-text)",
            }}
          >
            Endpoints
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div>
              <label style={labelStyle}>Reference URL</label>
              <input
                type="url"
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
                required
                placeholder="https://ref.example.com/graphql"
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={labelStyle}>Candidate URL</label>
              <input
                type="url"
                value={candidateUrl}
                onChange={(e) => setCandidateUrl(e.target.value)}
                required
                placeholder="https://candidate.example.com/graphql"
                style={{ width: "100%" }}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Queries Directory</label>
            <input
              type="text"
              value={queriesDir}
              onChange={(e) => setQueriesDir(e.target.value)}
              placeholder="./queries"
              style={{ width: "100%", maxWidth: 400 }}
            />
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              marginBottom: "0.75rem",
              color: "var(--color-text)",
            }}
          >
            Global Headers
          </div>
          <textarea
            value={headersRaw}
            onChange={(e) => setHeadersRaw(e.target.value)}
            placeholder={"Authorization: Bearer my-token\nx-market: fr"}
            rows={3}
            style={{
              width: "100%",
              fontFamily: "var(--font-mono)",
              fontSize: "0.8125rem",
              resize: "vertical",
            }}
          />
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--color-text)",
              }}
            >
              Query Selection
            </div>
            <button
              type="button"
              onClick={handleLoadQueries}
              disabled={queriesLoading}
              style={{
                padding: "0.375rem 0.875rem",
                fontSize: "0.8125rem",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-primary)",
                fontWeight: 500,
              }}
            >
              {queriesLoading ? "Loading..." : "Load Queries"}
            </button>
          </div>

          {queriesError !== null && (
            <p
              style={{
                color: "var(--color-fail)",
                margin: "0.5rem 0",
                fontSize: "0.875rem",
              }}
            >
              {queriesError}
            </p>
          )}

          {queries.length > 0 && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.625rem 0",
                  borderBottom: "1px solid var(--color-border-light)",
                  marginBottom: "0.5rem",
                }}
              >
                <button
                  type="button"
                  onClick={toggleAllQueries}
                  style={{
                    padding: "0.25rem 0.625rem",
                    fontSize: "0.75rem",
                    background: "transparent",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {selectedQueries.length === queries.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
                <span
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {selectedQueries.length} of {queries.length} selected
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                {queries.map((q) => (
                  <div key={q.name}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.625rem",
                        padding: "0.5rem 0.25rem",
                        cursor: "pointer",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedQueries.includes(q.name)}
                        onChange={() => toggleQuery(q.name)}
                        style={{ accentColor: "var(--color-primary)" }}
                      />
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.8125rem",
                          fontWeight: 500,
                        }}
                      >
                        {q.name}
                      </span>
                      <span
                        style={{
                          padding: "0.0625rem 0.375rem",
                          borderRadius: "var(--radius-full)",
                          fontSize: "0.625rem",
                          fontWeight: 600,
                          background: "var(--color-primary-light)",
                          color: "var(--color-primary)",
                        }}
                      >
                        {q.type}
                      </span>
                    </label>
                    {selectedQueries.includes(q.name) && (
                      <div style={{ marginLeft: "1.75rem" }}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedQuery((prev) =>
                              prev === q.name ? null : q.name,
                            )
                          }
                          style={{
                            padding: "0.1875rem 0",
                            fontSize: "0.75rem",
                            background: "none",
                            border: "none",
                            color: "var(--color-primary)",
                            cursor: "pointer",
                          }}
                        >
                          {expandedQuery === q.name
                            ? "- Hide headers"
                            : "+ Per-request headers"}
                        </button>
                        {expandedQuery === q.name && (
                          <div
                            style={{
                              marginTop: "0.5rem",
                              padding: "0.75rem",
                              background: "var(--color-bg)",
                              borderRadius: "var(--radius-md)",
                              border: "1px solid var(--color-border-light)",
                            }}
                          >
                            <KeyValueEditor
                              value={getHeadersForQuery(q.name)}
                              onChange={(pairs) =>
                                setHeadersForQuery(q.name, pairs)
                              }
                              label="Headers for this query"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.625rem 2rem",
              fontSize: "0.9375rem",
              fontWeight: 600,
            }}
          >
            {loading ? "Running..." : "Run Comparison"}
          </button>
          {error !== null && (
            <span style={{ color: "var(--color-fail)", fontSize: "0.875rem" }}>
              {error}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
