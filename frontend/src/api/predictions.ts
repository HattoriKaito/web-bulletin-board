import { apiFetch } from "./client";
import type { Prediction, PredictionChatMessage, PredictionChatReply, Stage } from "../types";

export function listPredictions(raceId: number): Promise<Prediction[]> {
  return apiFetch<Prediction[]>(`/races/${raceId}/predictions`);
}

export function createPrediction(raceId: number, stage: Stage): Promise<Prediction> {
  return apiFetch<Prediction>(`/races/${raceId}/predictions?stage=${stage}`, {
    method: "POST",
  });
}

export function listPredictionChat(predictionId: number): Promise<PredictionChatMessage[]> {
  return apiFetch<PredictionChatMessage[]>(`/predictions/${predictionId}/chat`);
}

export function sendPredictionChatMessage(
  predictionId: number,
  message: string,
): Promise<PredictionChatReply> {
  return apiFetch<PredictionChatReply>(`/predictions/${predictionId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
