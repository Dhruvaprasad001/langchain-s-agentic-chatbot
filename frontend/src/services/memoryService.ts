import type { MemoryFactResponse } from "../../clients/api";
import { getMemoryApi } from "@/src/services/apiClient";

export type MemoryFact = MemoryFactResponse;

export async function listMemory(): Promise<MemoryFact[]> {
  const res = await getMemoryApi().getMemoryApiV1MemoryGet();
  return res.data.facts;
}
