import { useEffect, useState } from "react";
import { createPrediction, listPredictions } from "../api/predictions";
import type { Prediction, Stage } from "../types";

const STAGE_LABELS: Record<Stage, string> = {
  entry_confirmed: "出走表確定時点",
  pre_race: "直前情報時点",
  final: "締切直前（最終）",
};

export function PredictionPanel({ raceId, stage }: { raceId: number; stage: Stage }) {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPredictions(raceId)
      .then((all) => {
        if (cancelled) return;
        const latest = all.find((p) => p.stage === stage);
        if (latest) setPrediction(latest);
      })
      .catch(() => {
        // 履歴取得の失敗は致命的ではないため無視し、生成ボタンは使える状態にしておく
      })
      .finally(() => !cancelled && setLoadingHistory(false));
    return () => {
      cancelled = true;
    };
  }, [raceId, stage]);

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    setShowDetail(false);
    try {
      const result = await createPrediction(raceId, stage);
      setPrediction(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI予想の生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mt-6 rounded border border-indigo-200 p-4 dark:border-indigo-800">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-medium text-gray-900 dark:text-gray-100">
          AI予想（{STAGE_LABELS[stage]}）
        </h2>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="w-fit flex-shrink-0 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {generating ? "生成中..." : "AI予想を生成"}
        </button>
      </div>

      {loadingHistory && <p className="text-sm text-gray-500">読み込み中...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {prediction && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {prediction.suggested_bets.map((combo) => (
              <span
                key={combo}
                className="rounded bg-indigo-50 px-2 py-1 font-mono text-sm text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
              >
                {combo}
              </span>
            ))}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {prediction.summary_reasoning}
          </p>
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="w-fit text-sm text-indigo-600 underline"
          >
            {showDetail ? "詳細を閉じる" : "もっと詳しく"}
          </button>
          {showDetail && (
            <p className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {prediction.detailed_reasoning}
            </p>
          )}
        </div>
      )}

      {!loadingHistory && !prediction && !generating && (
        <p className="text-sm text-gray-500">まだAI予想は生成されていません。</p>
      )}
    </div>
  );
}
