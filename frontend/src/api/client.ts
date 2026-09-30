// Thin typed API client. Credentials are included so the server-side session
// cookie flows with every request. No tokens are ever stored in the browser.

import type {
  AnalysisJob,
  CurrentUser,
  FileDetail,
  Overview,
  PaginatedFiles,
  Repository,
} from "../types";

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      const body = await resp.json();
      detail = body.detail ?? detail;
    } catch {
      // non-JSON error body; keep statusText
    }
    throw new ApiError(resp.status, detail);
  }
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

export interface ProvidersStatus {
  github: boolean;
  gitlab: boolean;
  dev_mode: boolean;
}

export const api = {
  me: () => request<CurrentUser>("/api/auth/me"),

  providers: () => request<ProvidersStatus>("/api/auth/providers"),

  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  listRepositories: () => request<Repository[]>("/api/repositories"),

  connectRepository: (owner: string, name: string, provider?: string) =>
    request<{ repository: Repository }>("/api/repositories/connect", {
      method: "POST",
      body: JSON.stringify({ owner, name, provider }),
    }),

  getRepository: (id: number) => request<Repository>(`/api/repositories/${id}`),

  analyseRepository: (id: number) =>
    request<{ job: AnalysisJob }>(`/api/repositories/${id}/analyse`, {
      method: "POST",
    }),

  getOverview: (id: number) =>
    request<Overview>(`/api/repositories/${id}/overview`),

  listFiles: (id: number, page = 1, pageSize = 50, search?: string) => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (search) params.set("search", search);
    return request<PaginatedFiles>(
      `/api/repositories/${id}/files?${params.toString()}`,
    );
  },

  getFileDetail: (id: number, fileId: number) =>
    request<FileDetail>(`/api/repositories/${id}/files/${fileId}`),

  getJob: (jobId: number) =>
    request<AnalysisJob>(`/api/analysis-jobs/${jobId}`),
};

export { BASE_URL };
