import { useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { extractPreRegistrationFromImages, getRace, listRaceEntries, upsertRaceEntries } from "../api/races";
import type { RaceEntryInput } from "../api/races";
import type { Race, RaceEntry } from "../types";
import { PredictionPanel } from "../components/PredictionPanel";
import { ImageExtractPanel } from "../components/ImageExtractPanel";
import { BoatBadge } from "../components/BoatBadge";

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
  "rounded-lg border border-navy-500 bg-navy-900 px-2 py-1.5 text-base text-ink-100 placeholder:text-ink-400 focus:border-accent-400 focus:outline-none";
const uncertainInputClass =
  "rounded-lg border border-caution-400 bg-caution-950 px-2 py-1.5 text-base text-ink-100 focus:border-caution-400 focus:outline-none";

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

  function fieldClass(boatNumber: number, field: string, mono = false) {
    const base = uncertainByBoat[boatNumber]?.has(field) ? uncertainInputClass : inputClass;
    return mono ? `${base} font-mono` : base;
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

  if (loading) return <p className="min-h-screen bg-navy-950 p-4 text-ink-400">読み込み中...</p>;

  return (
    <div className="min-h-screen bg-navy-950">
      <div className="mx-auto max-w-6xl p-4">
        <Link to="/races" className="text-sm text-ink-400 underline hover:text-ink-100">
          ← レース一覧へ戻る
        </Link>
        <h1 className="mt-2 mb-4 font-heading text-xl font-bold text-ink-100">
          出走表入力（事前情報）
          {race && (
            <span className="ml-2 font-mono text-base font-normal text-ink-400">
              {race.venue} {race.race_number}R ({race.race_date})
            </span>
          )}
        </h1>

        <ImageExtractPanel onExtract={handleExtractImages} />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid auto-cols-[82%] grid-flow-col gap-3 overflow-x-auto snap-x snap-mandatory pb-2 sm:auto-cols-fr sm:grid-flow-row sm:grid-cols-2 sm:overflow-visible md:grid-cols-3 xl:grid-cols-6">
            {rows.map((row, index) => (
              <div
                key={row.boat_number}
                className="flex snap-center flex-col gap-3 rounded-xl border border-navy-600 bg-navy-800 p-4 shadow-md shadow-black/20"
              >
                <div className="flex items-center gap-2">
                  <BoatBadge boatNumber={row.boat_number} size="lg" />
                  <span className="font-heading font-bold text-ink-100">{row.boat_number}号艇</span>
                </div>
                <label className="flex flex-col gap-1 text-sm text-ink-300">
                  選手名
                  <input
                    required
                    value={row.racer_name}
                    onChange={(e) => updateRow(index, "racer_name", e.target.value)}
                    className={fieldClass(row.boat_number, "racer_name")}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-ink-300">
                  当地勝率
                  <input
                    inputMode="decimal"
                    value={row.local_win_rate}
                    onChange={(e) => updateRow(index, "local_win_rate", e.target.value)}
                    className={fieldClass(row.boat_number, "local_win_rate", true)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-ink-300">
                  全国勝率
                  <input
                    inputMode="decimal"
                    value={row.national_win_rate}
                    onChange={(e) => updateRow(index, "national_win_rate", e.target.value)}
                    className={fieldClass(row.boat_number, "national_win_rate", true)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-ink-300">
                  モーター勝率
                  <input
                    inputMode="decimal"
                    value={row.motor_win_rate}
                    onChange={(e) => updateRow(index, "motor_win_rate", e.target.value)}
                    className={fieldClass(row.boat_number, "motor_win_rate", true)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-ink-300">
                  フラグ（F/L等）
                  <input
                    value={row.flag_status}
                    onChange={(e) => updateRow(index, "flag_status", e.target.value)}
                    className={fieldClass(row.boat_number, "flag_status")}
                  />
                </label>
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {savedMessage && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-green-400">{savedMessage}</p>
              <Link
                to={`/races/${raceIdNum}/pre-race`}
                className="inline-block w-fit rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-white hover:bg-accent-600"
              >
                → 直前情報入力へ
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent-500 px-3 py-2 font-medium text-white shadow-lg shadow-accent-500/20 hover:bg-accent-600 disabled:opacity-50"
          >
            {saving ? "保存中..." : "6艇まとめて保存"}
          </button>
        </form>

        <PredictionPanel raceId={raceIdNum} stage="entry_confirmed" />
      </div>
    </div>
  );
}
