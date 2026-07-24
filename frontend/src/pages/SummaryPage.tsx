import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSummary, getSummaryByRaceType } from "../api/summary";
import type { BetGroupSummary, OverallSummary, RaceTypeStats } from "../types";

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

function TotalCard({ title, summary }: { title: string; summary: BetGroupSummary }) {
  return (
    <div className="rounded-xl border border-navy-600 bg-navy-800 p-4 shadow-md shadow-black/20">
      <h2 className="mb-2 text-sm font-medium text-ink-400">{title}</h2>
      <div className="flex flex-col gap-1 text-sm text-ink-100">
        <div className="flex justify-between">
          <span>投資額</span>
          <span className="font-mono">{summary.total_bet_amount.toLocaleString()}円</span>
        </div>
        <div className="flex justify-between">
          <span>払戻額</span>
          <span className="font-mono">{summary.total_winnings.toLocaleString()}円</span>
        </div>
        <div className="flex justify-between border-t border-navy-600 pt-1">
          <span>収支</span>
          <NetAmount value={summary.net_profit} />
        </div>
      </div>
    </div>
  );
}

function RaceTypeStatsCard({ stats }: { stats: RaceTypeStats[] }) {
  if (stats.length === 0) return null;
  return (
    <div className="mb-6 rounded-xl border border-navy-600 bg-navy-800 p-4 shadow-md shadow-black/20">
      <h2 className="mb-3 font-heading font-bold text-ink-100">レース種別ごとのAI的中率</h2>
      <ul className="flex flex-col gap-2">
        {stats.map((s) => (
          <li key={s.race_type} className="flex items-center gap-3 text-sm">
            <span className="w-16 flex-shrink-0 text-ink-100">{s.race_type}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-700">
              <div
                className="h-full rounded-full bg-accent-500"
                style={{ width: `${Math.round(s.hit_rate * 100)}%` }}
              />
            </div>
            <span className="w-32 flex-shrink-0 text-right font-mono text-ink-300">
              {s.hit_count}/{s.total_races}件（{Math.round(s.hit_rate * 100)}%）
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SummaryPage() {
  const [summary, setSummary] = useState<OverallSummary | null>(null);
  const [raceTypeStats, setRaceTypeStats] = useState<RaceTypeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSummary(), getSummaryByRaceType()])
      .then(([summaryData, raceTypeData]) => {
        setSummary(summaryData);
        setRaceTypeStats(raceTypeData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-navy-950">
      <div className="mx-auto max-w-2xl p-4">
        <Link to="/races" className="text-sm text-ink-400 underline hover:text-ink-100">
          ← レース一覧へ戻る
        </Link>
        <h1 className="mt-2 mb-4 font-heading text-xl font-bold text-ink-100">収支サマリー</h1>

        {loading && <p className="text-ink-400">読み込み中...</p>}
        {error && <p className="text-red-400">{error}</p>}

        {summary && (
          <>
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TotalCard title="実際の買い目（累計）" summary={summary.actual_total} />
              <TotalCard title="AI提案通りに買った場合（累計）" summary={summary.ai_suggested_total} />
            </div>

            <RaceTypeStatsCard stats={raceTypeStats} />

            {summary.races.length === 0 ? (
              <p className="text-ink-400">結果が記録されているレースがまだありません。</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {summary.races.map((item) => (
                  <li
                    key={item.race_id}
                    className="rounded-xl border border-navy-600 bg-navy-800 p-4 shadow-md shadow-black/20"
                  >
                    <Link
                      to={`/races/${item.race_id}/results`}
                      className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-heading font-bold text-ink-100">
                        {item.venue} {item.race_number}R
                      </span>
                      <span className="font-mono text-sm text-ink-400">{item.race_date}</span>
                    </Link>
                    <div className="mt-2 flex flex-col gap-1 text-sm sm:flex-row sm:justify-between">
                      <span className="text-ink-400">
                        実際: <NetAmount value={item.actual_summary.net_profit} />
                      </span>
                      <span className="text-ink-400">
                        AI提案: <NetAmount value={item.ai_suggested_summary.net_profit} />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
