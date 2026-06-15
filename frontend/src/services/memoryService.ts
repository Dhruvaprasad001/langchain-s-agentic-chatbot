import { getIdToken } from "@/src/services/authService";
import { BACKEND_URL } from "@/src/services/apiClient";

export interface MemoryFact {
  id: string;
  content: string;
  timestamp: string | null;
}

export async function listMemory(): Promise<MemoryFact[]> {
  const token = await getIdToken();
  const res = await fetch(`${BACKEND_URL}/api/v1/memory`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.facts as MemoryFact[];
}
