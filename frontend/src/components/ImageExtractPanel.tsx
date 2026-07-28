import { useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";

interface ImageExtractPanelProps {
  onExtract: (files: File[]) => Promise<void>;
  label?: string;
}

let pastedFileCounter = 0;

export function ImageExtractPanel({
  onExtract,
  label = "画像から自動入力",
}: ImageExtractPanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFiles(e.target.files ? Array.from(e.target.files) : []);
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    const pastedImages = Array.from(e.clipboardData?.items ?? [])
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)
      .map(
        (file) =>
          new File([file], file.name || `pasted-${Date.now()}-${pastedFileCounter++}.png`, {
            type: file.type,
          }),
      );
    if (pastedImages.length === 0) return;
    e.preventDefault();
    setFiles((prev) => [...prev, ...pastedImages]);
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
    <div
      ref={pasteAreaRef}
      onPaste={handlePaste}
      tabIndex={0}
      className="mb-4 flex flex-col gap-2 rounded-xl border border-dashed border-accent-500/50 bg-navy-800 p-3 focus:outline-none focus:ring-2 focus:ring-accent-400"
    >
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
      <p className="text-xs text-ink-400">
        この枠内をクリックしてから貼り付け（Ctrl+V / Cmd+V）でも画像を追加できます。
      </p>
      {files.length > 0 && (
        <p className="text-xs text-ink-300">
          選択中の画像: {files.length}枚
          <button
            type="button"
            onClick={() => setFiles([])}
            className="ml-2 text-accent-400 underline"
          >
            クリア
          </button>
        </p>
      )}
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
