import { useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { getResult, upsertResult } from "../api/results";
import { getRace } from "../api/races";
import type { BetGroupSummary, BetHitInfo, Race, RaceResult } from "../types";
import { BetCombinationBadges } from "../components/BetCombinationBadges";

function NetAmount({ value }: { value: number }) {
  const sign = value > 0 ? "+" : "";
  const color = value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-ink-400";
  return (
    <span className={`font-mono font-semibold ${color}`}>
      {sign}
      {value.toLocaleString()}円
    </span>
  );
}

function HitList({
  title,
  items,
  summary,
}: {
  title: string;
  items: BetHitInfo[];
  summary: BetGroupSummary;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-heading font-bold text-ink-100">{title}</h2>
        <span className="text-sm text-ink-400">
          収支: <NetAmount value={summary.net_profit} />
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-400">記録がありません。</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {items.map((b) => (
            <li
              key={b.bet_id}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                b.is_hit ? "border-green-500 bg-green-500/10" : "border-navy-600 bg-navy-800"
              }`}
            >
              <BetCombinationBadges combination={b.combination} size="sm" />
              <span className="font-mono text-ink-100">{b.amount}円</span>
              <span className="font-mono text-green-400">
                {b.is_hit ? `🎯 +${b.winnings.toLocaleString()}円` : <span className="text-ink-400">-</span>}
              </span>
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

  if (loading) return <p className="min-h-screen bg-navy-950 p-4 text-ink-400">読み込み中...</p>;

  const actualHits = result?.bet_results.filter((b) => !b.is_ai_suggested) ?? [];
  const aiHits = result?.bet_results.filter((b) => b.is_ai_suggested) ?? [];

  return (
    <div className="min-h-screen bg-navy-950">
      <div className="mx-auto max-w-2xl p-4">
        <Link to="/races" className="text-sm text-ink-400 underline hover:text-ink-100">
          ← レース一覧へ戻る
        </Link>
        <h1 className="mt-2 mb-4 font-heading text-xl font-bold text-ink-100">
          結果入力
          {race && (
            <span className="ml-2 font-mono text-base font-normal text-ink-400">
              {race.venue} {race.race_number}R ({race.race_date})
            </span>
          )}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink-300">
            着順（1着-2着-3着）
            <input
              required
              placeholder="例：3-1-2"
              value={finishingOrder}
              onChange={(e) => setFinishingOrder(e.target.value)}
              className="rounded-lg border border-navy-500 bg-navy-900 px-3 py-2 font-mono text-ink-100 placeholder:text-ink-400 focus:border-accent-400 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-300">
            払戻金（円）
            <input
              required
              type="number"
              min={0}
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              className="rounded-lg border border-navy-500 bg-navy-900 px-3 py-2 font-mono text-ink-100 focus:border-accent-400 focus:outline-none"
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent-500 px-3 py-2 font-medium text-white shadow-lg shadow-accent-500/20 hover:bg-accent-600 disabled:opacity-50"
          >
            {saving ? "保存中..." : result ? "結果を修正する" : "結果を記録する"}
          </button>
        </form>

        {result && (
          <div className="mt-6 flex flex-col gap-4">
            <HitList title="実際の買い目" items={actualHits} summary={result.actual_summary} />
            <HitList title="AI提案の買い目" items={aiHits} summary={result.ai_suggested_summary} />
          </div>
        )}
      </div>
    </div>
  );
}
