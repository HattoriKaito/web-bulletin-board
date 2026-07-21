import { useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { getRace, listRaceEntries, upsertRaceEntries } from "../api/races";
import type { RaceEntryInput } from "../api/races";
import type { Race, RaceEntry } from "../types";
import { PredictionPanel } from "../components/PredictionPanel";

interface PreRaceFormRow {
  boat_number: number;
  racer_name: string;
  entry_course: string;
  exhibition_time: string;
  weather_condition: string;
  wind_direction: string;
  wind_speed: string;
}

function toRow(entry: RaceEntry): PreRaceFormRow {
  return {
    boat_number: entry.boat_number,
    racer_name: entry.racer_name,
    entry_course: entry.entry_course?.toString() ?? "",
    exhibition_time: entry.exhibition_time?.toString() ?? "",
    weather_condition: entry.weather_condition ?? "",
    wind_direction: entry.wind_direction ?? "",
    wind_speed: entry.wind_speed?.toString() ?? "",
  };
}

function toNumberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function toStringOrNull(value: string): string | null {
  return value.trim() === "" ? null : value;
}

const inputClass =
  "rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800";

export function PreRaceInfoPage() {
  const { raceId } = useParams<{ raceId: string }>();
  const raceIdNum = Number(raceId);

  const [race, setRace] = useState<Race | null>(null);
  const [existingEntries, setExistingEntries] = useState<RaceEntry[]>([]);
  const [rows, setRows] = useState<PreRaceFormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getRace(raceIdNum), listRaceEntries(raceIdNum)])
      .then(([raceData, entries]) => {
        if (cancelled) return;
        setRace(raceData);
        const sorted = entries.slice().sort((a, b) => a.boat_number - b.boat_number);
        setExistingEntries(sorted);
        setRows(sorted.map(toRow));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "取得に失敗しました"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [raceIdNum]);

  function updateRow(index: number, field: keyof PreRaceFormRow, value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);
    setSaving(true);
    try {
      // race_entriesはboat_numberの他に選手名・勝率等も必須項目のため、
      // 既存データ(existingEntries)に直前情報の入力値をマージしてPUTする。
      // （PUT /races/{id}/entriesは全件置き換えのため、この画面で
      // 触っていない項目を欠落させないための措置）
      const entries: RaceEntryInput[] = rows.map((row) => {
        const original = existingEntries.find((e) => e.boat_number === row.boat_number);
        return {
          boat_number: row.boat_number,
          racer_name: row.racer_name,
          local_win_rate: original?.local_win_rate ?? null,
          national_win_rate: original?.national_win_rate ?? null,
          motor_win_rate: original?.motor_win_rate ?? null,
          flag_status: original?.flag_status ?? null,
          entry_course: toNumberOrNull(row.entry_course),
          exhibition_time: toNumberOrNull(row.exhibition_time),
          weather_condition: toStringOrNull(row.weather_condition),
          wind_direction: toStringOrNull(row.wind_direction),
          wind_speed: toNumberOrNull(row.wind_speed),
        };
      });
      const updated = await upsertRaceEntries(raceIdNum, entries);
      setExistingEntries(updated.slice().sort((a, b) => a.boat_number - b.boat_number));
      setSavedMessage("直前情報を保存しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="p-4 text-gray-500">読み込み中...</p>;

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <Link to={`/races/${raceIdNum}/entries`} className="text-sm text-gray-500 underline">
          ← 出走表入力へ戻る
        </Link>
        <p className="mt-4 text-gray-500">
          先に出走表（選手名など）を登録してから直前情報を入力してください。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <Link to="/races" className="text-sm text-gray-500 underline">
        ← レース一覧へ戻る
      </Link>
      <h1 className="mt-2 mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
        直前情報入力
        {race && ` — ${race.venue} ${race.race_number}R (${race.race_date})`}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {rows.map((row, index) => (
          <fieldset
            key={row.boat_number}
            className="rounded border border-gray-200 p-3 dark:border-gray-700"
          >
            <legend className="px-1 font-medium text-gray-900 dark:text-gray-100">
              {row.boat_number}号艇 ・ {row.racer_name}
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300">
                進入コース
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={row.entry_course}
                  onChange={(e) => updateRow(index, "entry_course", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300">
                展示タイム
                <input
                  inputMode="decimal"
                  value={row.exhibition_time}
                  onChange={(e) => updateRow(index, "exhibition_time", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300">
                天候
                <input
                  value={row.weather_condition}
                  onChange={(e) => updateRow(index, "weather_condition", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300">
                風向
                <input
                  value={row.wind_direction}
                  onChange={(e) => updateRow(index, "wind_direction", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300">
                風速
                <input
                  inputMode="decimal"
                  value={row.wind_speed}
                  onChange={(e) => updateRow(index, "wind_speed", e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
          </fieldset>
        ))}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {savedMessage && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-green-600">{savedMessage}</p>
            <Link
              to={`/races/${raceIdNum}/odds`}
              className="inline-block w-fit rounded bg-indigo-600 px-3 py-2 text-sm text-white"
            >
              → オッズ入力へ
            </Link>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {saving ? "保存中..." : "直前情報を保存"}
        </button>
      </form>

      <PredictionPanel raceId={raceIdNum} stage="pre_race" />
    </div>
  );
}
