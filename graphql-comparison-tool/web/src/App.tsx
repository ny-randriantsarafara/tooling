import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import RunPage from "./pages/RunPage";
import HistoryPage from "./pages/HistoryPage";
import RunDetailsPage from "./pages/RunDetailsPage";
import QueriesPage from "./pages/QueriesPage";
import QueryEditorPage from "./pages/QueryEditorPage";

const NAV_LINKS = [
  { to: "/", label: "Run", end: true },
  { to: "/queries", label: "Queries" },
  { to: "/history", label: "History" },
] as const;

function NavBar() {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 2rem",
        height: 56,
        background: "#fff",
        borderBottom: "1px solid var(--color-border)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "2.5rem" }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: "1.125rem",
            color: "var(--color-text)",
            letterSpacing: "-0.025em",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          GQL Diff
        </span>
        <nav style={{ display: "flex", gap: "0.25rem", height: 56 }}>
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={"end" in link}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                padding: "0 0.875rem",
                height: "100%",
                fontSize: "0.875rem",
                fontWeight: isActive ? 600 : 400,
                color: isActive
                  ? "var(--color-primary)"
                  : "var(--color-text-secondary)",
                borderBottom: isActive
                  ? "2px solid var(--color-primary)"
                  : "2px solid transparent",
                transition: "color 0.15s, border-color 0.15s",
                textDecoration: "none",
              })}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius-full)",
          background:
            "linear-gradient(135deg, var(--color-primary), #7c3aed)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: "0.75rem",
          fontWeight: 600,
        }}
      >
        U
      </div>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <main style={{ padding: "1.5rem 2rem", maxWidth: 1200, margin: "0 auto" }}>
        <Routes>
          <Route path="/" element={<RunPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/queries" element={<QueriesPage />} />
          <Route path="/queries/new" element={<QueryEditorPage />} />
          <Route path="/queries/:name" element={<QueryEditorPage />} />
          <Route path="/runs/:runId" element={<RunDetailsPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
