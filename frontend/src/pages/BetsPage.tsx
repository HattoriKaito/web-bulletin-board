import { useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { confirmBets, listBets } from "../api/bets";
import { getRace } from "../api/races";
import { listPredictions } from "../api/predictions";
import type { Bet, Prediction, Race } from "../types";

interface BetFormRow {
  combination: string;
  amount: string;
}

function emptyRow(): BetFormRow {
  return { combination: "", amount: "200" };
}

const inputClass =
  "rounded border border-gray-300 px-2 py-1.5 text-base dark:border-gray-600 dark:bg-gray-800";

export function BetsPage() {
  const { raceId } = useParams<{ raceId: string }>();
  const raceIdNum = Number(raceId);

  const [race, setRace] = useState<Race | null>(null);
  const [rows, setRows] = useState<BetFormRow[]>(() => Array.from({ length: 5 }, emptyRow));
  const [aiSuggestedBets, setAiSuggestedBets] = useState<Bet[]>([]);
  const [finalPrediction, setFinalPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [aiUnavailableNotice, setAiUnavailableNotice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getRace(raceIdNum), listBets(raceIdNum), listPredictions(raceIdNum)])
      .then(([raceData, bets, predictions]) => {
        if (cancelled) return;
        setRace(raceData);

        const actual = bets.filter((b) => !b.is_ai_suggested);
        const ai = bets.filter((b) => b.is_ai_suggested);
        setAiSuggestedBets(ai);

        if (actual.length > 0) {
          setRows(
            actual.map((b) => ({ combination: b.bet_combination, amount: String(b.amount) })),
          );
        }

        const latestFinal = predictions.find((p) => p.stage === "final") ?? null;
        setFinalPrediction(latestFinal);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "取得に失敗しました"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [raceIdNum]);

  function updateRow(index: number, field: keyof BetFormRow, value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function copyFromAiSuggestion() {
    if (!finalPrediction) return;
    setRows(
      finalPrediction.suggested_bets.map((combo) => ({ combination: combo, amount: "200" })),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);
    setAiUnavailableNotice(false);
    setSaving(true);
    try {
      const entries = rows.map((row) => ({
        combination: row.combination,
        amount: Number(row.amount),
      }));
      const result = await confirmBets(raceIdNum, entries);
      setAiSuggestedBets(result.ai_suggested_bets);
      setAiUnavailableNotice(!result.ai_suggested_available);
      setSavedMessage("買い目を確定しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "確定に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="p-4 text-gray-500">読み込み中...</p>;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Link to="/races" className="text-sm text-gray-500 underline">
        ← レース一覧へ戻る
      </Link>
      <h1 className="mt-2 mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
        買い目確定
        {race && ` — ${race.venue} ${race.race_number}R (${race.race_date})`}
      </h1>

      {finalPrediction && (
        <button
          type="button"
          onClick={copyFromAiSuggestion}
          className="mb-3 rounded border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 dark:border-indigo-700 dark:text-indigo-300"
        >
          AI提案（最終）をコピーして編集
        </button>
      )}
      {!finalPrediction && (
        <p className="mb-3 text-sm text-gray-500">
          締切直前のAI予想がまだ生成されていません。自由に買い目を入力できます。
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-5 text-sm text-gray-500">{index + 1}.</span>
            <input
              required
              placeholder="組み合わせ（例：1-2-3）"
              value={row.combination}
              onChange={(e) => updateRow(index, "combination", e.target.value)}
              className={`${inputClass} flex-1`}
            />
            <input
              required
              type="number"
              min={1}
              placeholder="金額"
              value={row.amount}
              onChange={(e) => updateRow(index, "amount", e.target.value)}
              className={`${inputClass} w-24`}
            />
            <span className="text-sm text-gray-500">円</span>
          </div>
        ))}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {savedMessage && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-green-600">{savedMessage}</p>
            {aiUnavailableNotice && (
              <p className="text-sm text-amber-600">
                締切直前のAI予想が無かったため、AI提案データは記録されませんでした。
              </p>
            )}
            <Link
              to={`/races/${raceIdNum}/results`}
              className="inline-block w-fit rounded bg-indigo-600 px-3 py-2 text-sm text-white"
            >
              → 結果入力へ
            </Link>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {saving ? "確定中..." : "この内容で買い目を確定"}
        </button>
      </form>

      {aiSuggestedBets.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 font-medium text-gray-900 dark:text-gray-100">
            AI提案の買い目（参考）
          </h2>
          <ul className="flex flex-wrap gap-2">
            {aiSuggestedBets.map((b) => (
              <li
                key={b.id}
                className="rounded bg-indigo-50 px-2 py-1 font-mono text-sm text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
              >
                {b.bet_combination}（{b.amount}円）
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
