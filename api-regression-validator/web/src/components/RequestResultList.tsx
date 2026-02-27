import { useState, useMemo } from "react";
import type { ComparisonRequestResult } from "../api";
import RequestResultDetails from "./RequestResultDetails";

interface RequestResultListProps {
  readonly requests: ReadonlyArray<ComparisonRequestResult>;
}

const STATUS_CONFIG = {
  PASS: { color: "var(--color-pass)", bg: "var(--color-pass-bg)", icon: "\u2713" },
  FAIL: { color: "var(--color-fail)", bg: "var(--color-fail-bg)", icon: "\u2717" },
  ERROR: { color: "var(--color-warn)", bg: "var(--color-warn-bg)", icon: "!" },
} as const;

type StatusFilter = "ALL" | "PASS" | "FAIL" | "ERROR";

function estimateSize(data: unknown): string {
  if (data === undefined) return "—";
  const bytes = JSON.stringify(data).length;
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

export default function RequestResultList({
  requests,
}: RequestResultListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const filtered = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return requests.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (lowerSearch !== "" && !r.name.toLowerCase().includes(lowerSearch)) {
        return false;
      }
      return true;
    });
  }, [requests, search, statusFilter]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "1.125rem",
            fontWeight: 600,
          }}
        >
          Requests ({requests.length})
        </h3>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
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
              placeholder="Filter requests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                paddingLeft: "2rem",
                width: 200,
                fontSize: "0.8125rem",
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={{ fontSize: "0.8125rem", minWidth: 120 }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PASS">Passed</option>
            <option value="FAIL">Failed</option>
            <option value="ERROR">Errors</option>
          </select>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {filtered.map((request) => {
          const originalIndex = requests.indexOf(request);
          const isExpanded = expandedIndex === originalIndex;
          const cfg = STATUS_CONFIG[request.status];

          return (
            <div
              key={request.name}
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                transition: "box-shadow 0.15s",
                ...(isExpanded
                  ? { boxShadow: "var(--shadow-md)" }
                  : {}),
              }}
            >
              <button
                onClick={() =>
                  setExpandedIndex(isExpanded ? null : originalIndex)
                }
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  padding: "1rem 1.25rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "var(--color-text)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "var(--radius-full)",
                      background: cfg.bg,
                      color: cfg.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {cfg.icon}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                      {request.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--color-text-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {request.type}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1.5rem",
                  }}
                >
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        color: "var(--color-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Size
                    </div>
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {estimateSize(request.referenceData)}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--color-text-muted)",
                      transition: "transform 0.2s",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
                    }}
                  >
                    ▼
                  </span>
                </div>
              </button>
              {isExpanded && <RequestResultDetails request={request} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
