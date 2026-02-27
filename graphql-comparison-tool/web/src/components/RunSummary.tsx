import type { ComparisonSummary } from "../api";

interface RunSummaryProps {
  readonly summary: ComparisonSummary;
}

const STAT_CARDS = [
  { key: "total", label: "TOTAL", color: "var(--color-info)", bg: "var(--color-info-bg)" },
  { key: "passed", label: "PASSED", color: "var(--color-pass)", bg: "var(--color-pass-bg)" },
  { key: "failed", label: "FAILED", color: "var(--color-fail)", bg: "var(--color-fail-bg)" },
  { key: "errors", label: "ERRORS", color: "var(--color-warn)", bg: "var(--color-warn-bg)" },
] as const;

export default function RunSummary({ summary }: RunSummaryProps) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        {STAT_CARDS.map((card) => {
          const value = summary[card.key];
          return (
            <div
              key={card.key}
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderLeft: `4px solid ${card.color}`,
                borderRadius: "var(--radius-lg)",
                padding: "1.25rem 1rem",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: value > 0 ? card.color : "var(--color-text-muted)",
                  lineHeight: 1.2,
                }}
              >
                {value}
              </div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  letterSpacing: "0.05em",
                  marginTop: "0.375rem",
                }}
              >
                {card.label}
              </div>
            </div>
          );
        })}
      </div>
      {summary.failedComparisons.length > 0 && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "var(--color-fail-bg)",
            border: "1px solid #fecaca",
            borderRadius: "var(--radius-md)",
            fontSize: "0.875rem",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--color-fail)" }}>
            Failed:
          </span>{" "}
          <span style={{ color: "var(--color-text-secondary)" }}>
            {summary.failedComparisons.join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}
