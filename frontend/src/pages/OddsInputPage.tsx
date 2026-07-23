import { useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { createOdds, getRace, listOdds } from "../api/races";
import type { Odds, Race, Stage } from "../types";
import { PredictionPanel } from "../components/PredictionPanel";
import { BetCombinationBadges } from "../components/BetCombinationBadges";

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
  "rounded-lg border border-navy-500 bg-navy-900 px-2 py-1.5 text-base text-ink-100 placeholder:text-ink-400 focus:border-accent-400 focus:outline-none";

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

  if (loading) return <p className="min-h-screen bg-navy-950 p-4 text-ink-400">読み込み中...</p>;

  return (
    <div className="min-h-screen bg-navy-950">
      <div className="mx-auto max-w-2xl p-4">
        <Link to="/races" className="text-sm text-ink-400 underline hover:text-ink-100">
          ← レース一覧へ戻る
        </Link>
        <h1 className="mt-2 mb-4 font-heading text-xl font-bold text-ink-100">
          オッズ入力
          {race && (
            <span className="ml-2 font-mono text-base font-normal text-ink-400">
              {race.venue} {race.race_number}R ({race.race_date})
            </span>
          )}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink-300">
            入力時点
            <select value={stage} onChange={(e) => setStage(e.target.value as Stage)} className={inputClass}>
              {(Object.keys(STAGE_LABELS) as Stage[]).map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <input
                  placeholder="組み合わせ（例：1-2-3）"
                  value={row.combination}
                  onChange={(e) => updateRow(index, "combination", e.target.value)}
                  className={`${inputClass} min-w-0 flex-1 basis-32 font-mono`}
                />
                <input
                  placeholder="オッズ"
                  inputMode="decimal"
                  value={row.odds_value}
                  onChange={(e) => updateRow(index, "odds_value", e.target.value)}
                  className={`${inputClass} w-20 flex-1 font-mono sm:flex-none`}
                />
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  disabled={rows.length === 1}
                  className="px-2 py-1.5 text-sm text-ink-400 hover:text-ink-100 disabled:opacity-30"
                >
                  削除
                </button>
              </div>
            ))}
            <button type="button" onClick={addRow} className="w-fit text-sm text-accent-400 underline">
              + 組み合わせを追加
            </button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {savedMessage && <p className="text-sm text-green-400">{savedMessage}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent-500 px-3 py-2 font-medium text-white shadow-lg shadow-accent-500/20 hover:bg-accent-600 disabled:opacity-50"
          >
            {saving ? "保存中..." : "オッズを記録"}
          </button>
        </form>

        <h2 className="mt-8 mb-2 font-heading font-bold text-ink-100">記録済みオッズ</h2>
        {recordedOdds.length === 0 ? (
          <p className="text-ink-400">まだ記録されたオッズはありません。</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {recordedOdds.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between rounded-xl border border-navy-600 bg-navy-800 px-3 py-2"
              >
                <BetCombinationBadges combination={o.combination} size="sm" />
                <span className="font-mono text-ink-100">{o.odds_value}倍</span>
                <span className="text-ink-400">{STAGE_LABELS[o.stage]}</span>
              </li>
            ))}
          </ul>
        )}

        <PredictionPanel raceId={raceIdNum} stage="final" />

        <Link
          to={`/races/${raceIdNum}/bets`}
          className="mt-6 inline-block w-fit rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-white hover:bg-accent-600"
        >
          → 買い目確定へ
        </Link>
      </div>
    </div>
  );
}
