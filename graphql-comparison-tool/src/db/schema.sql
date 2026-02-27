CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  reference_url TEXT NOT NULL,
  candidate_url TEXT NOT NULL,
  global_headers_json TEXT NOT NULL,
  queries_dir TEXT NOT NULL,
  total INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  errors INTEGER NOT NULL,
  failed_comparisons_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS run_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  request_name TEXT NOT NULL,
  request_type TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  headers_summary_json TEXT NOT NULL,
  variables_summary TEXT NOT NULL,
  diff_text TEXT,
  reference_data_json TEXT,
  candidate_data_json TEXT,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_run_requests_run_id ON run_requests(run_id);
