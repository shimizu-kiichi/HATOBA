import { GoogleGenAI } from "@google/genai";

// 【動作確認用・あとで削除】Geminiと会話するチャットAPI。
// 会話履歴をまるごと渡して、続きの返答を生成させる。
type ChatMessage = { role: "user" | "model"; text: string };

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY が未設定です。web/.env.local を確認してください。" },
      { status: 500 },
    );
  }

  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = body.messages;
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "メッセージがありません。" }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      })),
    });
    return Response.json({ reply: res.text ?? "" });
  } catch (e) {
    console.error("Gemini呼び出しエラー:", e);
    const detail = e instanceof Error ? ` (${e.message})` : "";
    return Response.json(
      { error: `AIの呼び出しに失敗しました。${detail}` },
      { status: 500 },
    );
  }
}
