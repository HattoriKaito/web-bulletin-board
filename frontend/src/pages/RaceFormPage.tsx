import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createRace } from "../api/races";

const RACE_TYPES = ["一般戦", "G3", "G2", "G1", "SG"];

// 全国24場（ボートレース公式の場コード順）
const VENUES = [
  "桐生", "戸田", "江戸川", "平和島", "多摩川", "浜名湖",
  "蒲郡", "常滑", "津", "三国", "びわこ", "住之江",
  "尼崎", "鳴門", "丸亀", "児島", "宮島", "徳山",
  "下関", "若松", "芦屋", "福岡", "唐津", "大村",
];

const inputClass =
  "rounded-lg border border-navy-500 bg-navy-900 px-3 py-2 text-ink-100 focus:border-accent-400 focus:outline-none";

export function RaceFormPage() {
  const navigate = useNavigate();
  const [venue, setVenue] = useState("");
  const [raceNumber, setRaceNumber] = useState(1);
  const [raceDate, setRaceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [raceType, setRaceType] = useState(RACE_TYPES[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const race = await createRace({
        venue,
        race_number: raceNumber,
        race_date: raceDate,
        race_type: raceType,
      });
      navigate(`/races/${race.id}/entries`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-950">
      <div className="mx-auto max-w-md p-4">
        <Link to="/races" className="text-sm text-ink-400 underline hover:text-ink-100">
          ← レース一覧へ戻る
        </Link>
        <h1 className="mt-2 mb-4 font-heading text-xl font-bold text-ink-100">レース登録</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink-300">
            開催場
            <input
              required
              list="venue-options"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="例：桐生"
              className={inputClass}
            />
            <datalist id="venue-options">
              {VENUES.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-300">
            レース番号
            <input
              type="number"
              min={1}
              max={12}
              required
              value={raceNumber}
              onChange={(e) => setRaceNumber(Number(e.target.value))}
              className={`${inputClass} font-mono`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-300">
            開催日
            <input
              type="date"
              required
              value={raceDate}
              onChange={(e) => setRaceDate(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-300">
            レース種別
            <select value={raceType} onChange={(e) => setRaceType(e.target.value)} className={inputClass}>
              {RACE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-accent-500 px-3 py-2 font-medium text-white shadow-lg shadow-accent-500/20 hover:bg-accent-600 disabled:opacity-50"
          >
            {submitting ? "登録中..." : "登録して出走表入力へ"}
          </button>
        </form>
      </div>
    </div>
  );
}
