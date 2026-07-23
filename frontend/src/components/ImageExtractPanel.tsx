import { useState, type ChangeEvent } from "react";

interface ImageExtractPanelProps {
  onExtract: (files: File[]) => Promise<void>;
  label?: string;
}

export function ImageExtractPanel({
  onExtract,
  label = "画像から自動入力",
}: ImageExtractPanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFiles(e.target.files ? Array.from(e.target.files) : []);
  }

  async function handleExtract() {
    if (files.length === 0) return;
    setError(null);
    setExtracting(true);
    try {
      await onExtract(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "画像からの自動入力に失敗しました");
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-dashed border-accent-500/50 bg-navy-800 p-3">
      <label className="flex flex-col gap-1 text-sm text-ink-300">
        画像（複数可）
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="text-sm text-ink-300"
        />
      </label>
      <button
        type="button"
        onClick={handleExtract}
        disabled={files.length === 0 || extracting}
        className="w-fit rounded-lg border border-accent-400 px-3 py-1.5 text-sm font-medium text-accent-400 hover:bg-accent-500/10 disabled:opacity-50"
      >
        {extracting ? "読み取り中..." : label}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="text-xs text-ink-400">
        読み取り結果はフォームに仮入力されるだけです。内容を確認・修正してから保存してください。
        自信が持てなかった項目は
        <span className="text-caution-400">黄色</span>
        で示されます。
      </p>
    </div>
  );
}
