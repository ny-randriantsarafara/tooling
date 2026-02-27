import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { listQueries, type QueryItem } from "../api";

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

type TypeFilter = "all" | "graphql" | "rest";

export default function QueriesPage() {
  const [queries, setQueries] = useState<ReadonlyArray<QueryItem>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  useEffect(() => {
    listQueries()
      .then(setQueries)
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return queries.filter((q) => {
      if (typeFilter !== "all" && q.type !== typeFilter) return false;
      if (lowerSearch !== "" && !q.name.toLowerCase().includes(lowerSearch)) {
        return false;
      }
      return true;
    });
  }, [queries, search, typeFilter]);

  if (loading) {
    return (
      <p style={{ color: "var(--color-text-muted)", padding: "2rem 0" }}>
        Loading queries...
      </p>
    );
  }

  if (error !== null) {
    return <p style={{ color: "var(--color-fail)" }}>{error}</p>;
  }

  const filterButtons: ReadonlyArray<{ readonly value: TypeFilter; readonly label: string }> = [
    { value: "all", label: "All" },
    { value: "graphql", label: "GraphQL" },
    { value: "rest", label: "REST" },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
            Queries
          </h2>
          <p
            style={{
              margin: "0.25rem 0 0",
              fontSize: "0.875rem",
              color: "var(--color-text-secondary)",
            }}
          >
            Manage your GraphQL query collection for comparison runs.
          </p>
        </div>
        <Link
          to="/queries/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.5rem 1.25rem",
            background: "var(--color-primary)",
            color: "#fff",
            borderRadius: "var(--radius-md)",
            fontSize: "0.875rem",
            fontWeight: 500,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          + New Query
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          gap: "1rem",
        }}
      >
        <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
          <span
            style={{
              position: "absolute",
              left: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-muted)",
              fontSize: "0.875rem",
              pointerEvents: "none",
            }}
          >
            {"\u{1F50D}"}
          </span>
          <input
            type="text"
            placeholder="Search queries by name or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "2.25rem", width: "100%", fontSize: "0.8125rem" }}
          />
        </div>
        <div
          style={{
            display: "flex",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
          }}
        >
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setTypeFilter(btn.value)}
              style={{
                padding: "0.4375rem 1rem",
                fontSize: "0.8125rem",
                fontWeight: 500,
                border: "none",
                borderRadius: 0,
                background:
                  typeFilter === btn.value
                    ? "var(--color-primary)"
                    : "var(--color-surface)",
                color:
                  typeFilter === btn.value
                    ? "#fff"
                    : "var(--color-text-secondary)",
                cursor: "pointer",
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "var(--color-text-muted)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          {queries.length === 0 ? (
            <>
              No queries yet.{" "}
              <Link to="/queries/new">Create your first query</Link>.
            </>
          ) : (
            "No queries match your filter."
          )}
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {filtered.map((q) => {
            const headersCount = q.headers
              ? Object.keys(q.headers).length
              : 0;
            const variablesPreview = q.variables
              ? truncate(JSON.stringify(q.variables), 80)
              : undefined;

            return (
              <Link
                key={q.name}
                to={`/queries/${encodeURIComponent(q.name)}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem 1.25rem",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-lg)",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "box-shadow 0.15s, border-color 0.15s",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.625rem",
                      marginBottom: "0.25rem",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: "0.9375rem",
                        color: "var(--color-primary)",
                      }}
                    >
                      {q.name}
                    </span>
                    <span
                      style={{
                        padding: "0.125rem 0.5rem",
                        borderRadius: "var(--radius-full)",
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        background: "var(--color-primary-light)",
                        color: "var(--color-primary)",
                      }}
                    >
                      {q.type}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.8125rem",
                      color: "var(--color-text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {variablesPreview ?? (
                      <span style={{ fontStyle: "italic" }}>No variables</span>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    flexShrink: 0,
                    marginLeft: "1rem",
                  }}
                >
                  {headersCount > 0 && (
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--color-text-muted)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      {headersCount} Header{headersCount > 1 ? "s" : ""}
                    </span>
                  )}
                  <span
                    style={{
                      color: "var(--color-text-muted)",
                      fontSize: "0.75rem",
                    }}
                  >
                    ›
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
