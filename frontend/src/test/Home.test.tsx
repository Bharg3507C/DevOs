import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Home } from "../pages/Home";

// The homepage renders sign-in buttons via useAuth; mock the context.
vi.mock("../state/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    providers: { github: true, gitlab: true, dev_mode: false },
    loading: false,
    authenticated: false,
    refresh: vi.fn(),
    logout: vi.fn(),
  }),
}));

// The 3D canvas uses requestAnimationFrame + canvas 2d context which jsdom
// stubs; mock the component to a no-op to keep the test focused on content.
vi.mock("../components/marketing/DependencyGraph3D", () => ({
  DependencyGraph3D: () => <div data-testid="graph3d" />,
}));

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

describe("Home", () => {
  it("shows the tagline and value proposition", () => {
    renderHome();
    expect(screen.getAllByText(/before you change it/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: /DevOS vs GitHub vs GitLab/i }),
    ).toBeInTheDocument();
  });

  it("offers both provider sign-in options", () => {
    renderHome();
    expect(
      screen.getAllByText(/Continue with GitHub/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Continue with GitLab/i).length,
    ).toBeGreaterThan(0);
  });

  it("renders the capability comparison table rows", () => {
    renderHome();
    expect(
      screen.getByText(/Static code knowledge graph/i),
    ).toBeInTheDocument();
    // Appears in both the features grid and the comparison table.
    expect(
      screen.getAllByText(/Circular dependency detection/i).length,
    ).toBeGreaterThan(0);
  });
});
