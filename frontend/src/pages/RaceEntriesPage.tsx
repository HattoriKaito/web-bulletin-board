import { useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { extractPreRegistrationFromImages, getRace, listRaceEntries, upsertRaceEntries } from "../api/races";
import type { RaceEntryInput } from "../api/races";
import type { Race, RaceEntry } from "../types";
import { PredictionPanel } from "../components/PredictionPanel";
import { ImageExtractPanel } from "../components/ImageExtractPanel";

interface EntryFormRow {
  boat_number: number;
  racer_name: string;
  local_win_rate: string;
  national_win_rate: string;
  motor_win_rate: string;
  flag_status: string;
}

function emptyRow(boatNumber: number): EntryFormRow {
  return {
    boat_number: boatNumber,
    racer_name: "",
    local_win_rate: "",
    national_win_rate: "",
    motor_win_rate: "",
    flag_status: "",
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
  "rounded border border-gray-300 px-2 py-1.5 text-base dark:border-gray-600 dark:bg-gray-800";
const uncertainInputClass =
  "rounded border border-amber-400 bg-amber-50 px-2 py-1.5 text-base dark:border-amber-600 dark:bg-amber-950";

export function RaceEntriesPage() {
  const { raceId } = useParams<{ raceId: string }>();
  const raceIdNum = Number(raceId);

  const [race, setRace] = useState<Race | null>(null);
  const [existingEntries, setExistingEntries] = useState<RaceEntry[]>([]);
  const [rows, setRows] = useState<EntryFormRow[]>(() =>
    Array.from({ length: 6 }, (_, i) => emptyRow(i + 1)),
  );
  const [uncertainByBoat, setUncertainByBoat] = useState<Record<number, Set<string>>>({});
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
        if (sorted.length > 0) {
          setRows(
            sorted.map((e) => ({
              boat_number: e.boat_number,
              racer_name: e.racer_name,
              local_win_rate: e.local_win_rate?.toString() ?? "",
              national_win_rate: e.national_win_rate?.toString() ?? "",
              motor_win_rate: e.motor_win_rate?.toString() ?? "",
              flag_status: e.flag_status ?? "",
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
    const boatNumber = rows[index].boat_number;
    setUncertainByBoat((prev) => {
      const current = prev[boatNumber];
      if (!current || !current.has(field)) return prev;
      const next = new Set(current);
      next.delete(field);
      return { ...prev, [boatNumber]: next };
    });
  }

  function fieldClass(boatNumber: number, field: string) {
    return uncertainByBoat[boatNumber]?.has(field) ? uncertainInputClass : inputClass;
  }

  async function handleExtractImages(files: File[]) {
    const result = await extractPreRegistrationFromImages(raceIdNum, files);
    setRows((prev) =>
      prev.map((row) => {
        const extracted = result.boats.find((b) => b.boat_number === row.boat_number);
        if (!extracted) return row;
        return {
          ...row,
          racer_name: extracted.racer_name ?? row.racer_name,
          local_win_rate:
            extracted.local_win_rate != null ? String(extracted.local_win_rate) : row.local_win_rate,
          national_win_rate:
            extracted.national_win_rate != null
              ? String(extracted.national_win_rate)
              : row.national_win_rate,
          motor_win_rate:
            extracted.motor_win_rate != null ? String(extracted.motor_win_rate) : row.motor_win_rate,
          flag_status: extracted.flag_status ?? row.flag_status,
        };
      }),
    );
    setUncertainByBoat((prev) => {
      const next = { ...prev };
      for (const b of result.boats) {
        next[b.boat_number] = new Set(b.uncertain_fields);
      }
      return next;
    });
    setSavedMessage(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);
    setSaving(true);
    try {
      // race_entriesは直前情報（entry_course等）も含めた1レコードのため、
      // このフォームで扱わない項目は既存データ(existingEntries)から引き継いで
      // PUTする（PUT /races/{id}/entriesは全件置き換えのため、ここで空を
      // 送ると直前情報が消えてしまう）。
      const entries: RaceEntryInput[] = rows.map((row) => {
        const original = existingEntries.find((e) => e.boat_number === row.boat_number);
        return {
          boat_number: row.boat_number,
          racer_name: row.racer_name,
          local_win_rate: toNumberOrNull(row.local_win_rate),
          national_win_rate: toNumberOrNull(row.national_win_rate),
          motor_win_rate: toNumberOrNull(row.motor_win_rate),
          flag_status: toStringOrNull(row.flag_status),
          entry_course: original?.entry_course ?? null,
          exhibition_time: original?.exhibition_time ?? null,
          weather_condition: original?.weather_condition ?? null,
          wind_direction: original?.wind_direction ?? null,
          wind_speed: original?.wind_speed ?? null,
        };
      });
      const updated = await upsertRaceEntries(raceIdNum, entries);
      setExistingEntries(updated.slice().sort((a, b) => a.boat_number - b.boat_number));
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
        出走表入力（事前情報）
        {race && ` — ${race.venue} ${race.race_number}R (${race.race_date})`}
      </h1>

      <ImageExtractPanel onExtract={handleExtractImages} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {rows.map((row, index) => (
          <fieldset
            key={row.boat_number}
            className="rounded border border-gray-200 p-3 dark:border-gray-700"
          >
            <legend className="px-1 font-medium text-gray-900 dark:text-gray-100">
              {row.boat_number}号艇
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                選手名
                <input
                  required
                  value={row.racer_name}
                  onChange={(e) => updateRow(index, "racer_name", e.target.value)}
                  className={fieldClass(row.boat_number, "racer_name")}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                当地勝率
                <input
                  inputMode="decimal"
                  value={row.local_win_rate}
                  onChange={(e) => updateRow(index, "local_win_rate", e.target.value)}
                  className={fieldClass(row.boat_number, "local_win_rate")}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                全国勝率
                <input
                  inputMode="decimal"
                  value={row.national_win_rate}
                  onChange={(e) => updateRow(index, "national_win_rate", e.target.value)}
                  className={fieldClass(row.boat_number, "national_win_rate")}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                モーター勝率
                <input
                  inputMode="decimal"
                  value={row.motor_win_rate}
                  onChange={(e) => updateRow(index, "motor_win_rate", e.target.value)}
                  className={fieldClass(row.boat_number, "motor_win_rate")}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                フラグ（F/L等）
                <input
                  value={row.flag_status}
                  onChange={(e) => updateRow(index, "flag_status", e.target.value)}
                  className={fieldClass(row.boat_number, "flag_status")}
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
              to={`/races/${raceIdNum}/pre-race`}
              className="inline-block w-fit rounded bg-indigo-600 px-3 py-2 text-sm text-white"
            >
              → 直前情報入力へ
            </Link>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {saving ? "保存中..." : "6艇まとめて保存"}
        </button>
      </form>

      <PredictionPanel raceId={raceIdNum} stage="entry_confirmed" />
    </div>
  );
}
