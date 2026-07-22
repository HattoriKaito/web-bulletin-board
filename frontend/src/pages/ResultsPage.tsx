import { useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { getResult, upsertResult } from "../api/results";
import { getRace } from "../api/races";
import type { BetHitInfo, Race, RaceResult } from "../types";

function HitList({ title, items }: { title: string; items: BetHitInfo[] }) {
  return (
    <div>
      <h2 className="mb-2 font-medium text-gray-900 dark:text-gray-100">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">記録がありません。</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {items.map((b) => (
            <li
              key={b.bet_id}
              className={`flex items-center justify-between rounded border px-3 py-1 ${
                b.is_hit
                  ? "border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <span className="font-mono">{b.combination}</span>
              <span>{b.amount}円</span>
              <span>{b.is_hit ? "🎯 的中" : "-"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ResultsPage() {
  const { raceId } = useParams<{ raceId: string }>();
  const raceIdNum = Number(raceId);

  const [race, setRace] = useState<Race | null>(null);
  const [finishingOrder, setFinishingOrder] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [result, setResult] = useState<RaceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getRace(raceIdNum), getResult(raceIdNum)])
      .then(([raceData, resultData]) => {
        if (cancelled) return;
        setRace(raceData);
        if (resultData) {
          setResult(resultData);
          setFinishingOrder(resultData.finishing_order);
          setPayoutAmount(String(resultData.payout_amount));
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "取得に失敗しました"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [raceIdNum]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const saved = await upsertResult(raceIdNum, finishingOrder, Number(payoutAmount));
      setResult(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="p-4 text-gray-500">読み込み中...</p>;

  const actualHits = result?.bet_results.filter((b) => !b.is_ai_suggested) ?? [];
  const aiHits = result?.bet_results.filter((b) => b.is_ai_suggested) ?? [];

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Link to="/races" className="text-sm text-gray-500 underline">
        ← レース一覧へ戻る
      </Link>
      <h1 className="mt-2 mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
        結果入力
        {race && ` — ${race.venue} ${race.race_number}R (${race.race_date})`}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          着順（1着-2着-3着）
          <input
            required
            placeholder="例：3-1-2"
            value={finishingOrder}
            onChange={(e) => setFinishingOrder(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          払戻金（円）
          <input
            required
            type="number"
            min={0}
            value={payoutAmount}
            onChange={(e) => setPayoutAmount(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {saving ? "保存中..." : result ? "結果を修正する" : "結果を記録する"}
        </button>
      </form>

      {result && (
        <div className="mt-6 flex flex-col gap-4">
          <HitList title="実際の買い目" items={actualHits} />
          <HitList title="AI提案の買い目" items={aiHits} />
        </div>
      )}
    </div>
  );
}
