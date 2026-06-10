"use client";

// 【動作確認用・あとで削除】Gemini APIが使えるか試すチャット画面。
import { useState } from "react";

type ChatMessage = { role: "user" | "model"; text: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const next: ChatMessage[] = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "失敗しました");
      setMessages([...next, { role: "model", text: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex h-screen w-full max-w-lg flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-4 py-3">
        <h1 className="font-bold text-neutral-900">Gemini 動作確認チャット</h1>
        <p className="text-xs text-neutral-400">APIが使えるか試すための仮画面</p>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-neutral-400">
            下の入力欄からメッセージを送ってください
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user" ? "flex justify-end" : "flex justify-start"
            }
          >
            <span
              className={
                "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm " +
                (m.role === "user"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-neutral-800 shadow-sm")
              }
            >
              {m.text}
            </span>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <span className="rounded-2xl bg-white px-4 py-2 text-sm text-neutral-400 shadow-sm">
              入力中…
            </span>
          </div>
        )}
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      <div className="flex gap-2 border-t border-neutral-200 bg-white px-4 py-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) send();
          }}
          placeholder="メッセージを入力…"
          className="flex-1 rounded-full border border-neutral-300 px-4 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <button
          onClick={send}
          disabled={loading}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          送信
        </button>
      </div>
    </main>
  );
}
