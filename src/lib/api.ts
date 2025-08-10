const API_BASE = '';

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}
export function setToken(token: string) {
  if (typeof window !== "undefined") localStorage.setItem("token", token);
}
export function clearToken() {
  if (typeof window !== "undefined") localStorage.removeItem("token");
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}

export type DocumentRow = {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  extractedText: string | null;
  path: string;
};

export type OcrStatus = {
  status: "idle" | "queued" | "running" | "completed" | "failed";
  progress: number;
  message?: string;
  error?: string;
  startedAt?: string;
  updatedAt?: string;
  finishedAt?: string;
};
