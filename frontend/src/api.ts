const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface HealthResponse {
  status: string;
  provider: string;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return res.json();
}
