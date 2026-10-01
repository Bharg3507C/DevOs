// Shared TypeScript types mirroring the backend Pydantic schemas.

export interface Repository {
  id: number;
  provider: Provider;
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  is_private: boolean;
  primary_language: string | null;
  languages: Record<string, number> | null;
  size_kb: number | null;
  created_at: string;
}

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface JobStep {
  name: string;
  status: "pending" | "running" | "done";
}

export interface AnalysisJob {
  id: number;
  repository_id: number;
  status: JobStatus;
  steps: JobStep[] | null;
  error: string | null;
  files_processed: number;
  parsing_failures: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface Overview {
  total_files: number;
  total_functions: number;
  total_classes: number;
  total_dependencies: number;
  total_tests: number;
  average_complexity: number;
  languages: Record<string, number>;
  last_analysed_at: string | null;
  last_commit_sha: string | null;
}

export interface FileSummary {
  id: number;
  path: string;
  language: string | null;
  loc: number;
  is_test: boolean;
  parse_error: string | null;
}

export interface PaginatedFiles {
  items: FileSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface FunctionInfo {
  name: string;
  qualified_name: string | null;
  start_line: number;
  end_line: number;
  loc: number;
  num_params: number;
  cyclomatic_complexity: number;
  is_async: boolean;
  is_method: boolean;
  is_test: boolean;
}

export interface ClassInfo {
  name: string;
  start_line: number;
  end_line: number;
  base_classes: string[] | null;
  num_methods: number;
}

export interface ImportInfo {
  module: string;
  symbol: string | null;
  alias: string | null;
  is_relative: boolean;
  line: number;
}

export interface FileDetail {
  id: number;
  path: string;
  language: string | null;
  loc: number;
  size_bytes: number;
  is_test: boolean;
  parse_error: string | null;
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  dependents_count: number;
  dependencies_count: number;
  max_complexity: number;
}

export type Provider = "github" | "gitlab";

export interface CurrentUser {
  authenticated?: boolean;
  login?: string;
  provider?: Provider;
  avatar_url?: string | null;
  dev_mode?: boolean;
}

// --- Architecture ---

export interface ArchNode {
  id: string;
  path: string;
  language: string | null;
  loc: number;
  is_test: boolean;
  num_functions: number;
  num_classes: number;
  dependency_count: number;
  dependent_count: number;
}

export interface ArchEdge {
  source: string;
  target: string;
  via_module: string | null;
}

export interface CircularDependency {
  cycle: string[];
}

export interface Architecture {
  nodes: ArchNode[];
  edges: ArchEdge[];
  circular_dependencies: CircularDependency[];
}

// --- Git history ---

export interface CommitRecord {
  sha: string;
  author_name: string | null;
  author_email: string | null;
  message: string | null;
  committed_at: string | null;
  files_changed: number;
}

export interface FileChurn {
  path: string;
  file_id: number | null;
  change_count: number;
  total_insertions: number;
  total_deletions: number;
}

export interface Contributor {
  login: string;
  commit_count: number;
}

export interface CommitsOverTime {
  date: string;
  count: number;
}

export interface GitHistory {
  commits: CommitRecord[];
  top_changed_files: FileChurn[];
  contributors: Contributor[];
  commits_over_time: CommitsOverTime[];
  total_commits: number;
}

// --- Search ---

export interface SearchResult {
  file_id: number;
  path: string;
  language: string | null;
  kind: "file" | "function" | "method" | "class" | "import";
  symbol: string | null;
  start_line: number | null;
  end_line: number | null;
  match_reason: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
}

// --- Change impact ---

export interface ImpactNode {
  file_id: number;
  path: string;
  distance: number;
  kind: "direct" | "indirect" | "test";
}

export interface ImpactResponse {
  origin_file_id: number;
  origin_path: string;
  directly_affected: number;
  indirectly_affected: number;
  related_tests: number;
  nodes: ImpactNode[];
}

export interface BrowseRepoItem {
  full_name: string;
  owner: string;
  name: string;
  is_private: boolean;
  primary_language: string | null;
  default_branch: string;
  size_kb: number;
}

export interface BrowseResult {
  items: BrowseRepoItem[];
}

export interface DebtFinding {
  file_id: number | null;
  path: string | null;
  severity: "high" | "medium" | "low" | "info";
  score: number;
  reasons: string[];
  signals: Record<string, unknown> | null;
}

// --- Technical debt ---

export interface TechnicalDebt {
  findings: DebtFinding[];
  total_findings: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}
