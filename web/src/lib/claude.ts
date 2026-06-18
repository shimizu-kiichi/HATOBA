// Claude(Anthropic)で構造化JSONを得る共通ヘルパー。
// tool use（input_schema）で、スキーマに準拠したJSONをClaudeに強制的に返させる。
// Gemini の responseSchema と同じ役割を果たす。

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Claudeの画像入力で許可される MIME タイプ
type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

type StructuredOptions = {
  prompt: string; // 指示文（プロンプト本文＋データ）
  schema: Record<string, unknown>; // 出力のJSON Schema（type: "object"）
  image?: { base64: string; mimeType: string }; // 任意：画像を添付する場合
  model?: string; // 任意：モデル上書き
};

// スキーマ準拠の構造化オブジェクトを返す。
export async function generateStructured<T>(opts: StructuredOptions): Promise<T> {
  const content: Anthropic.ContentBlockParam[] = [];

  if (opts.image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: opts.image.mimeType as ImageMediaType,
        data: opts.image.base64,
      },
    });
  }
  content.push({ type: "text", text: opts.prompt });

  const msg = await anthropic.messages.create({
    model: opts.model ?? "claude-sonnet-4-6",
    max_tokens: 8192,
    // submit ツールだけを定義し、tool_choice で必ず呼ばせる → 出力がスキーマ準拠になる
    tools: [
      {
        name: "submit",
        description: "指示に従って作成した結果を、このスキーマで提出する。",
        input_schema: opts.schema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "submit" },
    messages: [{ role: "user", content }],
  });

  const toolUse = msg.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claudeが構造化出力(tool_use)を返しませんでした");
  }
  return toolUse.input as T;
}
