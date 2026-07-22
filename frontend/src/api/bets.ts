import { apiFetch } from "./client";
import type { Bet, BetsConfirmResult } from "../types";

export interface BetEntryInput {
  combination: string;
  amount: number;
}

export function listBets(raceId: number): Promise<Bet[]> {
  return apiFetch<Bet[]>(`/races/${raceId}/bets`);
}

export function confirmBets(
  raceId: number,
  entries: BetEntryInput[],
): Promise<BetsConfirmResult> {
  return apiFetch<BetsConfirmResult>(`/races/${raceId}/bets`, {
    method: "PUT",
    body: JSON.stringify({ entries }),
  });
}
