import { apiFetch } from "./client";
import type { OverallSummary, RaceTypeStats } from "../types";

export function getSummary(): Promise<OverallSummary> {
  return apiFetch<OverallSummary>("/summary");
}

export function getSummaryByRaceType(): Promise<RaceTypeStats[]> {
  return apiFetch<RaceTypeStats[]>("/summary/by-race-type");
}
