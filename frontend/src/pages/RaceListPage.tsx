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
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">レース一覧</h1>
        <button onClick={logout} className="text-sm text-gray-500 underline">
          ログアウト
        </button>
      </div>

      <Link
        to="/races/new"
        className="mb-4 inline-block rounded bg-indigo-600 px-3 py-2 text-sm text-white"
      >
        + 新規レース登録
      </Link>

      {loading && <p className="text-gray-500">読み込み中...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && races.length === 0 && (
        <p className="text-gray-500">まだレースが登録されていません。</p>
      )}

      <ul className="flex flex-col gap-2">
        {races.map((race) => (
          <li
            key={race.id}
            className="rounded border border-gray-200 p-3 dark:border-gray-700"
          >
            <Link to={`/races/${race.id}/entries`} className="flex flex-col gap-1">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {race.venue} {race.race_number}R
              </span>
              <span className="text-sm text-gray-500">
                {race.race_date} ・ {race.race_type}
              </span>
            </Link>
            <div className="mt-2 flex gap-3 text-xs">
              <Link to={`/races/${race.id}/entries`} className="text-indigo-600 underline">
                出走表
              </Link>
              <Link to={`/races/${race.id}/pre-race`} className="text-indigo-600 underline">
                直前情報
              </Link>
              <Link to={`/races/${race.id}/odds`} className="text-indigo-600 underline">
                オッズ
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
