import { useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { getRace, listRaceEntries, upsertRaceEntries } from "../api/races";
import type { RaceEntryInput } from "../api/races";
import type { Race } from "../types";

interface EntryFormRow {
  boat_number: number;
  racer_name: string;
  local_win_rate: string;
  national_win_rate: string;
  motor_win_rate: string;
  flag_status: string;
  entry_course: string;
  exhibition_time: string;
  weather_condition: string;
  wind_direction: string;
  wind_speed: string;
}

function emptyRow(boatNumber: number): EntryFormRow {
  return {
    boat_number: boatNumber,
    racer_name: "",
    local_win_rate: "",
    national_win_rate: "",
    motor_win_rate: "",
    flag_status: "",
    entry_course: "",
    exhibition_time: "",
    weather_condition: "",
    wind_direction: "",
    wind_speed: "",
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

export function RaceEntriesPage() {
  const { raceId } = useParams<{ raceId: string }>();
  const raceIdNum = Number(raceId);

  const [race, setRace] = useState<Race | null>(null);
  const [rows, setRows] = useState<EntryFormRow[]>(() =>
    Array.from({ length: 6 }, (_, i) => emptyRow(i + 1)),
  );
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
        if (entries.length > 0) {
          setRows(
            entries
              .slice()
              .sort((a, b) => a.boat_number - b.boat_number)
              .map((e) => ({
                boat_number: e.boat_number,
                racer_name: e.racer_name,
                local_win_rate: e.local_win_rate?.toString() ?? "",
                national_win_rate: e.national_win_rate?.toString() ?? "",
                motor_win_rate: e.motor_win_rate?.toString() ?? "",
                flag_status: e.flag_status ?? "",
                entry_course: e.entry_course?.toString() ?? "",
                exhibition_time: e.exhibition_time?.toString() ?? "",
                weather_condition: e.weather_condition ?? "",
                wind_direction: e.wind_direction ?? "",
                wind_speed: e.wind_speed?.toString() ?? "",
              })),
          );
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "取得に失敗しました"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [raceIdNum]);

  function updateRow(index: number, field: keyof EntryFormRow, value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);
    setSaving(true);
    try {
      const entries: RaceEntryInput[] = rows.map((row) => ({
        boat_number: row.boat_number,
        racer_name: row.racer_name,
        local_win_rate: toNumberOrNull(row.local_win_rate),
        national_win_rate: toNumberOrNull(row.national_win_rate),
        motor_win_rate: toNumberOrNull(row.motor_win_rate),
        flag_status: toStringOrNull(row.flag_status),
        entry_course: toNumberOrNull(row.entry_course),
        exhibition_time: toNumberOrNull(row.exhibition_time),
        weather_condition: toStringOrNull(row.weather_condition),
        wind_direction: toStringOrNull(row.wind_direction),
        wind_speed: toNumberOrNull(row.wind_speed),
      }));
      await upsertRaceEntries(raceIdNum, entries);
      setSavedMessage("出走表を保存しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="p-4 text-gray-500">読み込み中...</p>;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <Link to="/races" className="text-sm text-gray-500 underline">
        ← レース一覧へ戻る
      </Link>
      <h1 className="mt-2 mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
        出走表入力
        {race && ` — ${race.venue} ${race.race_number}R (${race.race_date})`}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {rows.map((row, index) => (
          <fieldset
            key={row.boat_number}
            className="rounded border border-gray-200 p-3 dark:border-gray-700"
          >
            <legend className="px-1 font-medium text-gray-900 dark:text-gray-100">
              {row.boat_number}号艇
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300">
                選手名
                <input
                  required
                  value={row.racer_name}
                  onChange={(e) => updateRow(index, "racer_name", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300">
                当地勝率
                <input
                  inputMode="decimal"
                  value={row.local_win_rate}
                  onChange={(e) => updateRow(index, "local_win_rate", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300">
                全国勝率
                <input
                  inputMode="decimal"
                  value={row.national_win_rate}
                  onChange={(e) => updateRow(index, "national_win_rate", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300">
                モーター勝率
                <input
                  inputMode="decimal"
                  value={row.motor_win_rate}
                  onChange={(e) => updateRow(index, "motor_win_rate", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300">
                フラグ（F/L等）
                <input
                  value={row.flag_status}
                  onChange={(e) => updateRow(index, "flag_status", e.target.value)}
                  className={inputClass}
                />
              </label>
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
        {savedMessage && <p className="text-sm text-green-600">{savedMessage}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {saving ? "保存中..." : "6艇まとめて保存"}
        </button>
      </form>
    </div>
  );
}
