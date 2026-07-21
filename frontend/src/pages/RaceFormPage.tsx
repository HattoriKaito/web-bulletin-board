import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createRace } from "../api/races";

const RACE_TYPES = ["一般戦", "G3", "G2", "G1", "SG"];

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
    <div className="mx-auto max-w-md p-4">
      <Link to="/races" className="text-sm text-gray-500 underline">
        ← レース一覧へ戻る
      </Link>
      <h1 className="mt-2 mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
        レース登録
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          開催場
          <input
            required
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="例：桐生"
            className="rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          レース番号
          <input
            type="number"
            min={1}
            max={12}
            required
            value={raceNumber}
            onChange={(e) => setRaceNumber(Number(e.target.value))}
            className="rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          開催日
          <input
            type="date"
            required
            value={raceDate}
            onChange={(e) => setRaceDate(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          レース種別
          <select
            value={raceType}
            onChange={(e) => setRaceType(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          >
            {RACE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {submitting ? "登録中..." : "登録して出走表入力へ"}
        </button>
      </form>
    </div>
  );
}
