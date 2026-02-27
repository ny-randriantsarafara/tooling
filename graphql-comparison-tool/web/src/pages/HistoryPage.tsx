import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listRuns, type RunListItem } from "../api";

function StatPill({
  value,
  color,
}: {
  readonly value: number;
  readonly color: string;
}) {
  return (
    <span
      style={{
        fontWeight: 600,
        fontSize: "0.8125rem",
        color: value > 0 ? color : "var(--color-text-muted)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {value}
    </span>
  );
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<ReadonlyArray<RunListItem>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRuns()
      .then(setRuns)
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <p style={{ color: "var(--color-text-muted)", padding: "2rem 0" }}>
        Loading history...
      </p>
    );
  }

  if (error !== null) {
    return <p style={{ color: "var(--color-fail)" }}>{error}</p>;
  }

  if (runs.length === 0) {
    return (
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
        No runs yet. Go to <Link to="/">Run</Link> to launch one.
      </div>
    );
  }

  return (
    <div>
      <h2
        style={{
          margin: "0 0 1.25rem",
          fontSize: "1.5rem",
          fontWeight: 700,
        }}
      >
        Run History
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {runs.map((run) => {
          const hasFailures = run.failed > 0 || run.errors > 0;

          return (
            <Link
              key={run.id}
              to={`/runs/${run.id}`}
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
                transition: "box-shadow 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "var(--radius-full)",
                    background: hasFailures
                      ? "var(--color-fail)"
                      : "var(--color-pass)",
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "0.9375rem",
                      marginBottom: "0.125rem",
                    }}
                  >
                    {new Date(run.startedAt).toLocaleString()}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--color-text-muted)",
                      fontFamily: "var(--font-mono)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {run.referenceUrl} → {run.candidateUrl}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1.5rem",
                  flexShrink: 0,
                  marginLeft: "1rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    alignItems: "center",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "0.625rem",
                        color: "var(--color-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Total
                    </div>
                    <StatPill value={run.total} color="var(--color-info)" />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "0.625rem",
                        color: "var(--color-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Pass
                    </div>
                    <StatPill value={run.passed} color="var(--color-pass)" />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "0.625rem",
                        color: "var(--color-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Fail
                    </div>
                    <StatPill value={run.failed} color="var(--color-fail)" />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "0.625rem",
                        color: "var(--color-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Err
                    </div>
                    <StatPill value={run.errors} color="var(--color-warn)" />
                  </div>
                </div>

                <span
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--color-text-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {run.durationMs}ms
                </span>

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
    </div>
  );
}
