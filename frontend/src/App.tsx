import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RepositoryProvider } from "./state/RepositoryContext";
import { Dashboard } from "./pages/Dashboard";
import { RepositoryPage } from "./pages/RepositoryPage";
import { Files } from "./pages/Files";
import { FileDetailPage } from "./pages/FileDetailPage";
import { Settings } from "./pages/Settings";
import { ComingSoon } from "./pages/ComingSoon";

export default function App() {
  return (
    <RepositoryProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
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
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </RepositoryProvider>
  );
}
