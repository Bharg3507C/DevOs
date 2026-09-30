// Shared TypeScript types mirroring the backend Pydantic schemas.

export interface Repository {
  id: number;
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

export interface CurrentUser {
  authenticated?: boolean;
  login?: string;
  avatar_url?: string | null;
  dev_mode?: boolean;
}
