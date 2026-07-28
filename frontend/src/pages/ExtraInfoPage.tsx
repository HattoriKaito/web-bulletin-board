import { useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import {
  createExtraInfo,
  extractExtraInfoFromImages,
  getRace,
  listExtraInfo,
} from "../api/races";
import type { ExtraInfoCategory, Race, RaceExtraInfo } from "../types";
import { ImageExtractPanel } from "../components/ImageExtractPanel";

interface ExtraInfoFormRow {
  category: ExtraInfoCategory;
  content: string;
}

const CATEGORY_LABELS: Record<ExtraInfoCategory, string> = {
  pit_report: "ピットレポート",
  computer_prediction: "コンピューター予想",
  other: "その他",
};

function emptyRow(): ExtraInfoFormRow {
  return { category: "pit_report", content: "" };
}

const inputClass =
  "rounded-lg border border-navy-500 bg-navy-900 px-2 py-1.5 text-base text-ink-100 placeholder:text-ink-400 focus:border-accent-400 focus:outline-none";

export function ExtraInfoPage() {
  const { raceId } = useParams<{ raceId: string }>();
  const raceIdNum = Number(raceId);

  const [race, setRace] = useState<Race | null>(null);
  const [rows, setRows] = useState<ExtraInfoFormRow[]>(() => [emptyRow()]);
  const [savedInfo, setSavedInfo] = useState<RaceExtraInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getRace(raceIdNum), listExtraInfo(raceIdNum)])
      .then(([raceData, info]) => {
        if (cancelled) return;
        setRace(raceData);
        setSavedInfo(info);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "取得に失敗しました"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [raceIdNum]);

  function updateRow(index: number, field: "category" | "content", value: string) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleExtractImages(files: File[]) {
    // 抽出結果でフォームを丸ごと置き換える（プリフィルのみ、保存はまだしない）。
    const result = await extractExtraInfoFromImages(raceIdNum, files);
    setRows(
      result.items.length > 0
        ? result.items.map((item) => ({ category: item.category, content: item.content }))
        : [emptyRow()],
    );
    setSavedMessage(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);
    setSaving(true);
    try {
      const entries = rows
        .filter((row) => row.content.trim() !== "")
        .map((row) => ({ category: row.category, content: row.content.trim() }));
      if (entries.length === 0) {
        setError("内容を1件以上入力してください");
        return;
      }
      // ODDSと同様、追記のみ（既存の保存済み情報は消さない）
      const created = await createExtraInfo(raceIdNum, entries);
      setSavedInfo((prev) => [...created, ...prev]);
      setRows([emptyRow()]);
      setSavedMessage(`${entries.length}件の追加情報を記録しました。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="min-h-screen bg-navy-950 p-4 text-ink-400">読み込み中...</p>;

  return (
    <div className="min-h-screen bg-navy-950">
      <div className="mx-auto max-w-2xl p-4">
        <Link to="/races" className="text-sm text-ink-400 underline hover:text-ink-100">
          ← レース一覧へ戻る
        </Link>
        <h1 className="mt-2 mb-4 font-heading text-xl font-bold text-ink-100">
          追加情報入力
          {race && (
            <span className="ml-2 font-mono text-base font-normal text-ink-400">
              {race.venue} {race.race_number}R ({race.race_date})
            </span>
          )}
        </h1>

        <ImageExtractPanel
          onExtract={handleExtractImages}
          label="ピットレポート・コンピューター予想を画像から自動入力"
        />

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-lg border border-navy-700 p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={row.category}
                    onChange={(e) => updateRow(index, "category", e.target.value)}
                    className={`${inputClass} w-fit`}
                  >
                    {(Object.keys(CATEGORY_LABELS) as ExtraInfoCategory[]).map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    disabled={rows.length === 1}
                    className="px-2 py-1.5 text-sm text-ink-400 hover:text-ink-100 disabled:opacity-30"
                  >
                    削除
                  </button>
                </div>
                <textarea
                  placeholder="内容（例：1号艇の選手は絶好調とのコメント、モーターの出足が良い 等）"
                  value={row.content}
                  onChange={(e) => updateRow(index, "content", e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
          <button type="button" onClick={addRow} className="w-fit text-sm text-accent-400 underline">
            + 項目を追加
          </button>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {savedMessage && <p className="text-sm text-green-400">{savedMessage}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent-500 px-3 py-2 font-medium text-white shadow-lg shadow-accent-500/20 hover:bg-accent-600 disabled:opacity-50"
          >
            {saving ? "保存中..." : "追加情報を記録"}
          </button>
        </form>

        <h2 className="mt-8 mb-2 font-heading font-bold text-ink-100">保存済みの追加情報</h2>
        {savedInfo.length === 0 ? (
          <p className="text-ink-400">まだ追加情報は記録されていません。</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {savedInfo.map((info) => (
              <li
                key={info.id}
                className="rounded-xl border border-navy-600 bg-navy-800 p-3 shadow-md shadow-black/20"
              >
                <span className="inline-block rounded-full bg-navy-700 px-2 py-0.5 text-xs text-ink-300">
                  {CATEGORY_LABELS[info.category]}
                </span>
                <p className="mt-2 whitespace-pre-wrap text-ink-100">{info.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
