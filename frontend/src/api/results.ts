import { apiFetch } from "./client";
import type { RaceResult } from "../types";

export function getResult(raceId: number): Promise<RaceResult | null> {
  return apiFetch<RaceResult | null>(`/races/${raceId}/results`);
}

export function upsertResult(
  raceId: number,
  finishingOrder: string,
  payoutAmount: number,
): Promise<RaceResult> {
  return apiFetch<RaceResult>(`/races/${raceId}/results`, {
    method: "PUT",
    body: JSON.stringify({ finishing_order: finishingOrder, payout_amount: payoutAmount }),
  });
}
