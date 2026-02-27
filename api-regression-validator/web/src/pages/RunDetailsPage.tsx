import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getRunById, type StoredRun } from "../api";
import RunSummary from "../components/RunSummary";
import RequestResultList from "../components/RequestResultList";

function StatusBadge({ summary }: { readonly summary: StoredRun["runResult"]["summary"] }) {
  const hasFailures = summary.failed > 0 || summary.errors > 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.375rem",
        padding: "0.25rem 0.75rem",
        borderRadius: "var(--radius-full)",
        fontSize: "0.75rem",
        fontWeight: 600,
        background: hasFailures ? "var(--color-fail-bg)" : "var(--color-pass-bg)",
        color: hasFailures ? "var(--color-fail)" : "var(--color-pass)",
      }}
    >
      <span style={{ fontSize: "0.625rem" }}>{hasFailures ? "\u2717" : "\u2713"}</span>
      {hasFailures ? "Has Failures" : "Completed"}
    </span>
  );
}

function MetaField({
  label,
  value,
  icon,
}: {
  readonly label: string;
  readonly value: string;
  readonly icon: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: "0.375rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 0.75rem",
          background: "var(--color-bg)",
          border: "1px solid var(--color-border-light)",
          borderRadius: "var(--radius-md)",
          fontFamily: "var(--font-mono)",
          fontSize: "0.8125rem",
          color: "var(--color-text-secondary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ flexShrink: 0 }}>{icon}</span>
        {value}
      </div>
    </div>
  );
}

export default function RunDetailsPage() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<StoredRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (runId === undefined) return;
    getRunById(runId)
      .then(setRun)
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return (
      <p style={{ color: "var(--color-text-muted)", padding: "2rem 0" }}>
        Loading run details...
      </p>
    );
  }

  if (error !== null) {
    return <p style={{ color: "var(--color-fail)" }}>{error}</p>;
  }

  if (run === null) {
    return <p style={{ color: "var(--color-text-muted)" }}>Run not found.</p>;
  }

  return (
    <div>
      <Link
        to="/history"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          fontSize: "0.875rem",
          color: "var(--color-text-secondary)",
          marginBottom: "1.25rem",
        }}
      >
        ← Back to History
      </Link>

      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "1.25rem",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "0.375rem",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700 }}>
                Run {run.id.slice(0, 9)}...
              </h2>
              <StatusBadge summary={run.runResult.summary} />
            </div>
            <div
              style={{
                fontSize: "0.8125rem",
                color: "var(--color-text-muted)",
              }}
            >
              Started: {new Date(run.runResult.startedAt).toLocaleString()} ·
              Duration: {run.runResult.durationMs}ms
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <MetaField label="Reference" value={run.referenceUrl} icon="🔗" />
          <MetaField label="Candidate" value={run.candidateUrl} icon="🔗" />
          <MetaField label="Queries Path" value={run.queriesDir} icon="📁" />
        </div>
      </div>

      <RunSummary summary={run.runResult.summary} />
      <RequestResultList requests={run.runResult.requests} />
    </div>
  );
}
