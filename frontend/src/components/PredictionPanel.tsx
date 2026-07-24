import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  createPrediction,
  listPredictionChat,
  listPredictions,
  sendPredictionChatMessage,
} from "../api/predictions";
import type { Prediction, PredictionChatMessage, Stage } from "../types";
import { BetCombinationBadges } from "./BetCombinationBadges";

const STAGE_LABELS: Record<Stage, string> = {
  entry_confirmed: "出走表確定時点",
  pre_race: "直前情報時点",
  final: "締切直前（最終）",
};

function PredictionChatBox({ predictionId }: { predictionId: number }) {
  const [messages, setMessages] = useState<PredictionChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新しいメッセージが増えるたびに一番下（最新）までスクロールする
  // （max-h付きのスクロール領域なので、無いと新着が見えないまま隠れてしまう）。
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);
    listPredictionChat(predictionId)
      .then((data) => {
        if (!cancelled) setMessages(data);
      })
      .catch(() => {
        // 履歴取得の失敗は致命的ではないため無視し、新規送信自体はできる状態にしておく
      })
      .finally(() => !cancelled && setLoadingHistory(false));
    return () => {
      cancelled = true;
    };
  }, [predictionId]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const messageText = input.trim();
    if (messageText === "") return;
    setError(null);
    setSending(true);
    setInput("");
    try {
      const reply = await sendPredictionChatMessage(predictionId, messageText);
      setMessages((prev) => [...prev, reply.user_message, reply.assistant_message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
      setInput(messageText); // 失敗時は入力内容を復元し、打ち直しを不要にする
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-navy-600 bg-navy-900 p-3">
      <h3 className="text-sm font-medium text-ink-300">この予想について聞く</h3>

      {loadingHistory ? (
        <p className="text-sm text-ink-400">読み込み中...</p>
      ) : (
        <div ref={scrollRef} className="flex max-h-80 flex-col gap-2 overflow-y-auto scroll-smooth">
          {messages.length === 0 && (
            <p className="text-sm text-ink-400">
              気になる点を質問してみましょう（例：「1号艇を本命にした理由は？」）。
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-accent-500 text-white" : "bg-navy-700 text-ink-100"
                }`}
              >
                {m.content}
              </p>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <p className="max-w-[85%] rounded-2xl bg-navy-700 px-3 py-2 text-sm text-ink-400">
                考え中...
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="質問を入力..."
          disabled={sending}
          className="min-w-0 flex-1 rounded-lg border border-navy-500 bg-navy-800 px-3 py-1.5 text-sm text-ink-100 placeholder:text-ink-400 focus:border-accent-400 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending || input.trim() === ""}
          className="flex-shrink-0 rounded-lg bg-accent-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
        >
          {sending ? "送信中..." : "送信"}
        </button>
      </form>
    </div>
  );
}

export function PredictionPanel({ raceId, stage }: { raceId: number; stage: Stage }) {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPredictions(raceId)
      .then((all) => {
        if (cancelled) return;
        const latest = all.find((p) => p.stage === stage);
        if (latest) setPrediction(latest);
      })
      .catch(() => {
        // 履歴取得の失敗は致命的ではないため無視し、生成ボタンは使える状態にしておく
      })
      .finally(() => !cancelled && setLoadingHistory(false));
    return () => {
      cancelled = true;
    };
  }, [raceId, stage]);

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    setShowDetail(false);
    try {
      const result = await createPrediction(raceId, stage);
      setPrediction(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI予想の生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-navy-600 bg-navy-800 p-4 shadow-md shadow-black/20">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-heading font-bold text-ink-100">AI予想（{STAGE_LABELS[stage]}）</h2>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="w-fit flex-shrink-0 rounded-lg bg-accent-500 px-3 py-1.5 text-sm font-medium text-white shadow-md shadow-accent-500/20 hover:bg-accent-600 disabled:opacity-50"
        >
          {generating ? "生成中..." : "AI予想を生成"}
        </button>
      </div>

      {loadingHistory && <p className="text-sm text-ink-400">読み込み中...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {prediction && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {prediction.suggested_bets.map((combo, i) => (
              <div key={combo} className="flex items-center gap-3">
                <span className="w-5 flex-shrink-0 font-mono text-sm text-ink-400">{i + 1}.</span>
                <BetCombinationBadges combination={combo} size={i === 0 ? "lg" : "md"} emphasized={i === 0} />
                {i === 0 && (
                  <span className="rounded-full bg-accent-500/20 px-2 py-0.5 text-xs font-medium text-accent-400">
                    本命
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-ink-300">{prediction.summary_reasoning}</p>
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="w-fit text-sm text-accent-400 underline"
          >
            {showDetail ? "詳細を閉じる" : "もっと詳しく"}
          </button>
          {showDetail && (
            <>
              <p className="whitespace-pre-wrap rounded-lg bg-navy-900 p-3 text-sm text-ink-300">
                {prediction.detailed_reasoning}
              </p>
              <PredictionChatBox predictionId={prediction.id} />
            </>
          )}
        </div>
      )}

      {!loadingHistory && !prediction && !generating && (
        <p className="text-sm text-ink-400">まだAI予想は生成されていません。</p>
      )}
    </div>
  );
}
