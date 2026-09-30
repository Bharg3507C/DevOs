import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { Layout } from "./components/Layout";
import { AuthProvider, useAuth } from "./state/AuthContext";
import { RepositoryProvider } from "./state/RepositoryContext";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { RepositoryPage } from "./pages/RepositoryPage";
import { Files } from "./pages/Files";
import { FileDetailPage } from "./pages/FileDetailPage";
import { Settings } from "./pages/Settings";
import { ComingSoon } from "./pages/ComingSoon";

// Gates the app shell behind authentication. The dev-mode local user counts as
// authenticated, so local development still works without OAuth configured.
function RequireAuth({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAuth();
  if (loading)
    return (
      <div className="flex h-full items-center justify-center bg-bg text-sm text-slate-500">
        Loading…
      </div>
    );
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <RepositoryProvider>
                <Layout />
              </RepositoryProvider>
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/repository" element={<RepositoryPage />} />
          <Route path="/files" element={<Files />} />
          <Route path="/file/:path" element={<FileDetailPage />} />
          <Route path="/settings" element={<Settings />} />
          {/* Later-phase routes: honest placeholders, never fake data. */}
          <Route
            path="/architecture"
            element={<ComingSoon title="Architecture" phase="Phase 2" />}
          />
          <Route
            path="/impact"
            element={<ComingSoon title="Change Impact" phase="Phase 3" />}
          />
          <Route
            path="/technical-debt"
            element={<ComingSoon title="Technical Debt" phase="Phase 4" />}
          />
          <Route
            path="/git-history"
            element={<ComingSoon title="Git History" phase="Phase 3" />}
          />
          <Route
            path="/search"
            element={<ComingSoon title="Search" phase="Phase 5" />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
