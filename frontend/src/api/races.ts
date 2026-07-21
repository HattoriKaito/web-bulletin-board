import { apiFetch } from "./client";
import type { Race, RaceEntry } from "../types";

export interface RaceCreateInput {
  venue: string;
  race_number: number;
  race_date: string;
  race_type: string;
}

export interface RaceEntryInput {
  boat_number: number;
  racer_name: string;
  local_win_rate: number | null;
  national_win_rate: number | null;
  motor_win_rate: number | null;
  flag_status: string | null;
  entry_course: number | null;
  exhibition_time: number | null;
  weather_condition: string | null;
  wind_direction: string | null;
  wind_speed: number | null;
}

export function listRaces(): Promise<Race[]> {
  return apiFetch<Race[]>("/races");
}

export function getRace(raceId: number): Promise<Race> {
  return apiFetch<Race>(`/races/${raceId}`);
}

export function createRace(input: RaceCreateInput): Promise<Race> {
  return apiFetch<Race>("/races", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteRace(raceId: number): Promise<void> {
  return apiFetch<void>(`/races/${raceId}`, { method: "DELETE" });
}

export function listRaceEntries(raceId: number): Promise<RaceEntry[]> {
  return apiFetch<RaceEntry[]>(`/races/${raceId}/entries`);
}

export function upsertRaceEntries(
  raceId: number,
  entries: RaceEntryInput[],
): Promise<RaceEntry[]> {
  return apiFetch<RaceEntry[]>(`/races/${raceId}/entries`, {
    method: "PUT",
    body: JSON.stringify({ entries }),
  });
}
