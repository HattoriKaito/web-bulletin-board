import { useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { createOdds, getRace, listOdds } from "../api/races";
import type { Odds, Race, Stage } from "../types";
import { PredictionPanel } from "../components/PredictionPanel";

interface OddsFormRow {
  combination: string;
  odds_value: string;
}

const STAGE_LABELS: Record<Stage, string> = {
  entry_confirmed: "出走表確定時点",
  pre_race: "直前情報時点",
  final: "締切直前（最終）",
};

function emptyRow(): OddsFormRow {
  return { combination: "", odds_value: "" };
}

const inputClass =
  "rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800";

export function OddsInputPage() {
  const { raceId } = useParams<{ raceId: string }>();
  const raceIdNum = Number(raceId);

  const [race, setRace] = useState<Race | null>(null);
  const [stage, setStage] = useState<Stage>("pre_race");
  const [rows, setRows] = useState<OddsFormRow[]>(() => [emptyRow()]);
  const [recordedOdds, setRecordedOdds] = useState<Odds[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getRace(raceIdNum), listOdds(raceIdNum)])
      .then(([raceData, odds]) => {
        if (cancelled) return;
        setRace(raceData);
        setRecordedOdds(odds);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "取得に失敗しました"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [raceIdNum]);

  function updateRow(index: number, field: keyof OddsFormRow, value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);
    setSaving(true);
    try {
      const entries = rows
        .filter((row) => row.combination.trim() !== "" && row.odds_value.trim() !== "")
        .map((row) => ({
          combination: row.combination.trim(),
          odds_value: Number(row.odds_value),
        }));
      if (entries.length === 0) {
        setError("組み合わせとオッズを1件以上入力してください");
        return;
      }
      const created = await createOdds(raceIdNum, stage, entries);
      setRecordedOdds((prev) => [...created, ...prev]);
      setRows([emptyRow()]);
      setSavedMessage(`${entries.length}件のオッズを記録しました。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
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
        オッズ入力
        {race && ` — ${race.venue} ${race.race_number}R (${race.race_date})`}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          入力時点
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as Stage)}
            className={inputClass}
          >
            {(Object.keys(STAGE_LABELS) as Stage[]).map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                placeholder="組み合わせ（例：1-2-3）"
                value={row.combination}
                onChange={(e) => updateRow(index, "combination", e.target.value)}
                className={`${inputClass} flex-1`}
              />
              <input
                placeholder="オッズ"
                inputMode="decimal"
                value={row.odds_value}
                onChange={(e) => updateRow(index, "odds_value", e.target.value)}
                className={`${inputClass} w-24`}
              />
              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={rows.length === 1}
                className="text-sm text-gray-400 disabled:opacity-30"
              >
                削除
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="w-fit text-sm text-indigo-600 underline"
          >
            + 組み合わせを追加
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {savedMessage && <p className="text-sm text-green-600">{savedMessage}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {saving ? "保存中..." : "オッズを記録"}
        </button>
      </form>

      <h2 className="mt-8 mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
        記録済みオッズ
      </h2>
      {recordedOdds.length === 0 ? (
        <p className="text-gray-500">まだ記録されたオッズはありません。</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {recordedOdds.map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-1 dark:border-gray-700"
            >
              <span className="font-mono">{o.combination}</span>
              <span>{o.odds_value}倍</span>
              <span className="text-gray-500">{STAGE_LABELS[o.stage]}</span>
            </li>
          ))}
        </ul>
      )}

      <PredictionPanel raceId={raceIdNum} stage="final" />
    </div>
  );
}
