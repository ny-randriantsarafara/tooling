# API Regression Validator

Validate API responses (GraphQL and REST) between two endpoints (reference vs candidate) to detect regressions during migrations or deployments.

## Prerequisites

- Node.js 18+
- npm

## Installation

```bash
npm install
```

## CLI Usage

```bash
npm run compare -- \
  --reference-url https://api.prod.example.com/graphql \
  --candidate-url https://api.staging.example.com/graphql \
  -H "Authorization: Bearer <token>"
```

### Options

| Flag | Description |
|------|-------------|
| `--reference-url` | Base URL of the reference (trusted) API |
| `--candidate-url` | Base URL of the candidate (testing) API |
| `-H, --header` | HTTP header (repeatable), e.g. `-H "Authorization: Bearer xxx"` |
| `--queries-dir` | Directory containing query files (default: `./queries`) |
| `-v, --verbose` | Show detailed diff output |
| `--json` | Output results as JSON |

## Web UI

Start the API server and web interface:

```bash
npm run dev
```

Opens at `http://localhost:5173`. View run history, inspect diffs, and re-run comparisons.

## Query Format

### GraphQL Queries

Place `.graphql` files in `queries/graphql/` with companion `.meta.json` files:

**`queries/graphql/example.graphql`**
```graphql
query GetArticle($id: ID!) {
  article(id: $id) {
    id
    title
  }
}
```

**`queries/graphql/example.meta.json`**
```json
{
  "variables": { "id": "123" },
  "operationName": "GetArticle"
}
```

### REST Queries

Place query files in `queries/rest/` following the same pattern with `.meta.json` for request details.

## Database

Run history is stored in `runs.db` (SQLite). To reset:

```bash
rm runs.db
npm run db:migrate
```
