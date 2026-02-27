import type { ComparisonRequestResult } from "../api";

interface RequestResultDetailsProps {
  readonly request: ComparisonRequestResult;
}

export default function RequestResultDetails({
  request,
}: RequestResultDetailsProps) {
  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        borderTop: "1px solid var(--color-border-light)",
        background: "var(--color-bg)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            padding: "0.75rem",
            background: "var(--color-surface)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border-light)",
          }}
        >
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
            Headers
          </div>
          {request.headersSummary.length === 0 ? (
            <span
              style={{
                fontSize: "0.8125rem",
                color: "var(--color-text-muted)",
                fontStyle: "italic",
              }}
            >
              none
            </span>
          ) : (
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
              }}
            >
              {request.headersSummary.map((header) => (
                <li
                  key={header}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8125rem",
                    color: "var(--color-text-secondary)",
                    padding: "0.125rem 0",
                  }}
                >
                  {header}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div
          style={{
            padding: "0.75rem",
            background: "var(--color-surface)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border-light)",
          }}
        >
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
            Variables
          </div>
          <pre
            style={{
              margin: 0,
              fontSize: "0.8125rem",
              whiteSpace: "pre-wrap",
              color: "var(--color-text-secondary)",
            }}
          >
            {request.variablesSummary}
          </pre>
        </div>
      </div>

      {request.errorMessage !== undefined && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            background: "var(--color-fail-bg)",
            border: "1px solid #fecaca",
            borderRadius: "var(--radius-md)",
            fontSize: "0.875rem",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--color-fail)" }}>
            Error:
          </span>{" "}
          {request.errorMessage}
        </div>
      )}

      {request.diffText !== undefined && (
        <div style={{ marginBottom: "1rem" }}>
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
            Diff
          </div>
          <pre
            style={{
              background: "#1e293b",
              color: "#e2e8f0",
              padding: "1rem",
              borderRadius: "var(--radius-md)",
              overflow: "auto",
              fontSize: "0.8125rem",
              whiteSpace: "pre-wrap",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            {request.diffText}
          </pre>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
        }}
      >
        {request.referenceData !== undefined && (
          <div style={{ minWidth: 0 }}>
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
              Reference data
            </div>
            <pre
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border-light)",
                padding: "0.75rem",
                borderRadius: "var(--radius-md)",
                overflow: "auto",
                fontSize: "0.8125rem",
                maxHeight: "80vh",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
                color: "var(--color-text-secondary)",
                lineHeight: 1.5,
              }}
            >
              {JSON.stringify(request.referenceData, null, 2)}
            </pre>
          </div>
        )}
        {request.candidateData !== undefined && (
          <div style={{ minWidth: 0 }}>
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
              Candidate data
            </div>
            <pre
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border-light)",
                padding: "0.75rem",
                borderRadius: "var(--radius-md)",
                overflow: "auto",
                fontSize: "0.8125rem",
                maxHeight: "80vh",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
                color: "var(--color-text-secondary)",
                lineHeight: 1.5,
              }}
            >
              {JSON.stringify(request.candidateData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
