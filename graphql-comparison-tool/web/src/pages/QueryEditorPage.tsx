import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getQuery,
  createQuery,
  updateQuery,
  deleteQuery,
  type QueryItem,
} from "../api";
import KeyValueEditor from "../components/KeyValueEditor";

function pairsFromRecord(
  rec: Readonly<Record<string, string>> | undefined,
): ReadonlyArray<readonly [string, string]> {
  if (!rec) return [];
  return Object.entries(rec);
}

function recordFromPairs(
  pairs: ReadonlyArray<readonly [string, string]>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of pairs) {
    if (k.trim() !== "") out[k.trim()] = v;
  }
  return out;
}

export default function QueryEditorPage() {
  const { name: paramName } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const isNew = paramName === "new";

  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [headersPairs, setHeadersPairs] = useState<
    ReadonlyArray<readonly [string, string]>
  >([]);
  const [variablesRaw, setVariablesRaw] = useState("{}");

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuery = useCallback((queryName: string) => {
    setLoading(true);
    setError(null);
    getQuery(queryName)
      .then((q: QueryItem) => {
        setName(q.name);
        setQuery(q.query);
        setHeadersPairs(pairsFromRecord(q.headers));
        setVariablesRaw(
          q.variables ? JSON.stringify(q.variables, null, 2) : "{}",
        );
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isNew && paramName) loadQuery(paramName);
  }, [isNew, paramName, loadQuery]);

  function parseVariables(): Record<string, unknown> {
    const trimmed = variablesRaw.trim();
    if (trimmed === "") return {};
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const headers = recordFromPairs(headersPairs);
      const variables = parseVariables();

      if (isNew) {
        await createQuery({ name: name.trim(), query, headers, variables });
      } else if (paramName) {
        await updateQuery(paramName, { query, headers, variables });
      }
      navigate("/queries");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!paramName || isNew) return;
    if (!window.confirm(`Delete query "${paramName}"?`)) return;

    setSaving(true);
    setError(null);

    try {
      await deleteQuery(paramName);
      navigate("/queries");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p style={{ color: "var(--color-text-muted)", padding: "2rem 0" }}>
        Loading query...
      </p>
    );
  }

  if (error !== null && !isNew && !paramName) {
    return <p style={{ color: "var(--color-fail)" }}>{error}</p>;
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
      <Link
        to="/queries"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          fontSize: "0.875rem",
          color: "var(--color-text-secondary)",
          marginBottom: "1.25rem",
        }}
      >
        ← Back to Queries
      </Link>

      <h2
        style={{
          margin: "0 0 1.5rem",
          fontSize: "1.5rem",
          fontWeight: 700,
        }}
      >
        {isNew ? "New Query" : `Edit: ${paramName}`}
      </h2>

      <div style={cardStyle}>
        <div style={{ marginBottom: "1rem" }}>
          <label style={labelStyle}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            readOnly={!isNew}
            placeholder="query-name"
            style={{
              width: "100%",
              maxWidth: 400,
              fontFamily: "var(--font-mono)",
              fontSize: "0.8125rem",
              ...(isNew
                ? {}
                : {
                    background: "var(--color-bg)",
                    color: "var(--color-text-muted)",
                    cursor: "not-allowed",
                  }),
            }}
          />
        </div>

        <div>
          <label style={labelStyle}>Query</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="query { ... }"
            rows={20}
            style={{
              width: "100%",
              fontFamily: "var(--font-mono)",
              fontSize: "0.8125rem",
              resize: "vertical",
            }}
          />
        </div>
      </div>

      <div style={cardStyle}>
        <KeyValueEditor
          value={headersPairs}
          onChange={setHeadersPairs}
          label="Headers"
        />
      </div>

      <div style={cardStyle}>
        <label style={labelStyle}>Variables (JSON)</label>
        <textarea
          value={variablesRaw}
          onChange={(e) => setVariablesRaw(e.target.value)}
          placeholder='{ "id": "123" }'
          rows={10}
          style={{
            width: "100%",
            fontFamily: "var(--font-mono)",
            fontSize: "0.8125rem",
            resize: "vertical",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || (isNew && !name.trim())}
          style={{
            padding: "0.625rem 2rem",
            fontSize: "0.9375rem",
            fontWeight: 600,
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {!isNew && paramName && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            style={{
              padding: "0.625rem 1.5rem",
              background: "transparent",
              border: "1px solid var(--color-fail)",
              color: "var(--color-fail)",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Delete
          </button>
        )}
        {error !== null && (
          <span style={{ color: "var(--color-fail)", fontSize: "0.875rem" }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
