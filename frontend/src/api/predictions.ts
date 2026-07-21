import { apiFetch } from "./client";
import type { Prediction, Stage } from "../types";

export function listPredictions(raceId: number): Promise<Prediction[]> {
  return apiFetch<Prediction[]>(`/races/${raceId}/predictions`);
}

export function createPrediction(raceId: number, stage: Stage): Promise<Prediction> {
  return apiFetch<Prediction>(`/races/${raceId}/predictions?stage=${stage}`, {
    method: "POST",
  });
}
