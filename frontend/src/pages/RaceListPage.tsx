import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listRaces } from "../api/races";
import type { Race } from "../types";
import { useAuth } from "../auth/AuthContext";

export function RaceListPage() {
  const { logout } = useAuth();
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRaces()
      .then(setRaces)
      .catch((err) => setError(err instanceof Error ? err.message : "取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-navy-950">
      <div className="mx-auto max-w-2xl p-4">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-heading text-2xl font-bold text-ink-100">BoatAI</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link to="/summary" className="text-ink-400 underline hover:text-ink-100">
              収支サマリー
            </Link>
            <Link to="/rules" className="text-ink-400 underline hover:text-ink-100">
              ルール管理
            </Link>
            <button onClick={logout} className="text-ink-400 underline hover:text-ink-100">
              ログアウト
            </button>
          </div>
        </div>

        <Link
          to="/races/new"
          className="mb-6 inline-block rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-accent-500/20 hover:bg-accent-600"
        >
          + 新規レース登録
        </Link>

        {loading && <p className="text-ink-400">読み込み中...</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && !error && races.length === 0 && (
          <p className="text-ink-400">まだレースが登録されていません。</p>
        )}

        <ul className="flex flex-col gap-3">
          {races.map((race) => (
            <li
              key={race.id}
              className="rounded-xl border border-navy-600 bg-navy-800 p-4 shadow-md shadow-black/20"
            >
              <Link to={`/races/${race.id}/entries`} className="flex flex-col gap-1">
                <span className="font-heading text-lg font-bold text-ink-100">
                  {race.venue} {race.race_number}R
                </span>
                <span className="font-mono text-sm text-ink-400">
                  {race.race_date} ・ {race.race_type}
                </span>
              </Link>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <Link to={`/races/${race.id}/entries`} className="py-1 text-accent-400 underline">
                  出走表
                </Link>
                <Link to={`/races/${race.id}/pre-race`} className="py-1 text-accent-400 underline">
                  直前情報
                </Link>
                <Link to={`/races/${race.id}/extra-info`} className="py-1 text-accent-400 underline">
                  追加情報
                </Link>
                <Link to={`/races/${race.id}/odds`} className="py-1 text-accent-400 underline">
                  オッズ
                </Link>
                <Link to={`/races/${race.id}/bets`} className="py-1 text-accent-400 underline">
                  買い目
                </Link>
                <Link to={`/races/${race.id}/results`} className="py-1 text-accent-400 underline">
                  結果
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
