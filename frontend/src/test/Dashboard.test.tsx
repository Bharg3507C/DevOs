import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "../pages/Dashboard";
import type { OutletContext } from "../components/Layout";
import { api } from "../api/client";
import type { Overview, Repository } from "../types";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>(
    "../api/client",
  );
  return { ...actual, api: { ...actual.api, getOverview: vi.fn() } };
});

const repo: Repository = {
  id: 1,
  owner: "octocat",
  name: "hello",
  full_name: "octocat/hello",
  default_branch: "main",
  is_private: false,
  primary_language: "Python",
  languages: { Python: 2048 },
  size_kb: 10,
  created_at: new Date().toISOString(),
};

vi.mock("../state/RepositoryContext", () => ({
  useRepository: () => ({
    repositories: [repo],
    selected: repo,
    loading: false,
    error: null,
    selectRepository: vi.fn(),
    refresh: vi.fn(),
  }),
}));

function renderDashboard() {
  const ctx: OutletContext = {
    refreshAfterAnalysis: () => {},
    lastCompletedJobId: null,
  };
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<OutletShim ctx={ctx} />}>
          <Route path="*" element={<Dashboard />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

// Minimal shim providing outlet context to the Dashboard under test.
import { Outlet } from "react-router-dom";
function OutletShim({ ctx }: { ctx: OutletContext }) {
  return <Outlet context={ctx} />;
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders analysed stats from the overview", async () => {
    const overview: Overview = {
      total_files: 7,
      total_functions: 23,
      total_classes: 4,
      total_dependencies: 11,
      total_tests: 2,
      average_complexity: 3.4,
      languages: { Python: 2048 },
      last_analysed_at: new Date().toISOString(),
      last_commit_sha: "abc123",
    };
    (api.getOverview as ReturnType<typeof vi.fn>).mockResolvedValue(overview);

    renderDashboard();

    await waitFor(() => expect(screen.getByText("7")).toBeInTheDocument());
    expect(screen.getByText("23")).toBeInTheDocument();
    expect(screen.getByText("Dependencies")).toBeInTheDocument();
    expect(screen.getByText("3.4")).toBeInTheDocument();
  });

  it("prompts to analyse when the repo has not been analysed", async () => {
    const overview: Overview = {
      total_files: 0,
      total_functions: 0,
      total_classes: 0,
      total_dependencies: 0,
      total_tests: 0,
      average_complexity: 0,
      languages: {},
      last_analysed_at: null,
      last_commit_sha: null,
    };
    (api.getOverview as ReturnType<typeof vi.fn>).mockResolvedValue(overview);

    renderDashboard();

    await waitFor(() =>
      expect(
        screen.getByText(/has not been analysed yet/i),
      ).toBeInTheDocument(),
    );
  });
});
