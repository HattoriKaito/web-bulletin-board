import { apiFetch } from "./client";
import type { OverallSummary } from "../types";

export function getSummary(): Promise<OverallSummary> {
  return apiFetch<OverallSummary>("/summary");
}
