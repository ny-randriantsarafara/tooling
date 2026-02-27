interface KeyValueEditorProps {
  readonly value: ReadonlyArray<readonly [string, string]>;
  readonly onChange: (pairs: ReadonlyArray<readonly [string, string]>) => void;
  readonly label?: string;
}

export default function KeyValueEditor({
  value,
  onChange,
  label,
}: KeyValueEditorProps) {
  function handleKeyChange(idx: number, newKey: string) {
    const next = [...value];
    next[idx] = [newKey, next[idx][1]];
    onChange(next);
  }

  function handleValueChange(idx: number, newVal: string) {
    const next = [...value];
    next[idx] = [next[idx][0], newVal];
    onChange(next);
  }

  function handleAdd() {
    onChange([...value, ["", ""]]);
  }

  function handleRemove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {label !== undefined && (
        <label
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--color-text-secondary)",
          }}
        >
          {label}
        </label>
      )}
      {value.map(([k, v], idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            value={k}
            onChange={(e) => handleKeyChange(idx, e.target.value)}
            placeholder="Key"
            style={{
              flex: 1,
              fontFamily: "var(--font-mono)",
              fontSize: "0.8125rem",
            }}
          />
          <input
            type="text"
            value={v}
            onChange={(e) => handleValueChange(idx, e.target.value)}
            placeholder="Value"
            style={{
              flex: 1,
              fontFamily: "var(--font-mono)",
              fontSize: "0.8125rem",
            }}
          />
          <button
            type="button"
            onClick={() => handleRemove(idx)}
            style={{
              background: "transparent",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
              padding: "0.375rem 0.625rem",
              fontSize: "0.75rem",
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={handleAdd}
        style={{
          alignSelf: "flex-start",
          background: "transparent",
          border: "1px dashed var(--color-border)",
          color: "var(--color-primary)",
          padding: "0.375rem 0.75rem",
          fontSize: "0.8125rem",
          fontWeight: 500,
        }}
      >
        + Add
      </button>
    </div>
  );
}
