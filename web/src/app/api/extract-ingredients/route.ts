// 機能①：値引き商品の写真1枚を受け取り、商品情報を読み取って返す。
// 設計・プロンプト: src/prompts/prompt-extract.md

import { GoogleGenAI, Type } from "@google/genai";
import { loadPromptBody } from "@/lib/prompts";
import { generateStructured } from "@/lib/claude";
import type { ExtractedProduct } from "@/lib/types";

// AI応答に時間がかかるため、Vercelの関数タイムアウトを延長（無料プラン上限60秒）
export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Gemini用スキーマ（@google/genai の Type 形式）
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    productName: { type: Type.STRING },
    originalPrice: { type: Type.INTEGER, nullable: true },
    discountPercent: { type: Type.INTEGER, nullable: true },
    unit: { type: Type.STRING, nullable: true },
    quantity: { type: Type.INTEGER },
    allergens: { type: Type.ARRAY, items: { type: Type.STRING } }, // 28品目から該当（ラベル表示か商品から推測）
  },
  required: ["productName", "originalPrice", "discountPercent", "unit", "quantity", "allergens"],
  propertyOrdering: ["productName", "originalPrice", "discountPercent", "unit", "quantity", "allergens"],
};

// Claude用スキーマ（標準のJSON Schema）。中身は responseSchema と同じ構造。
const claudeSchema = {
  type: "object",
  properties: {
    productName: { type: "string" },
    originalPrice: { type: ["integer", "null"] },
    discountPercent: { type: ["integer", "null"] },
    unit: { type: ["string", "null"] },
    quantity: { type: "integer" },
    allergens: { type: "array", items: { type: "string" } },
  },
  required: ["productName", "originalPrice", "discountPercent", "unit", "quantity", "allergens"],
};

export async function POST(req: Request) {
  const { imageBase64, mimeType } = await req.json();
  if (!imageBase64 || !mimeType) {
    return Response.json({ error: "imageBase64 と mimeType が必要です" }, { status: 400 });
  }

  const prompt = await loadPromptBody("prompt-extract.md");

  // AI_PROVIDER=claude のときだけ Claude、それ以外（未設定含む）は従来どおり Gemini
  let product: ExtractedProduct;
  if (process.env.AI_PROVIDER === "claude") {
    product = await generateStructured<ExtractedProduct>({
      prompt,
      schema: claudeSchema,
      image: { base64: imageBase64, mimeType },
    });
  } else {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }],
        },
      ],
      config: { responseMimeType: "application/json", responseSchema },
    });
    product = JSON.parse(res.text ?? "{}") as ExtractedProduct;
  }

  // 割引後価格はAIに計算させずここで算出する（元値か割引率が不明なら null）
  const discountedPrice =
    product.originalPrice === null || product.discountPercent === null
      ? null
      : Math.round((product.originalPrice * (100 - product.discountPercent)) / 100);

  return Response.json({ ...product, discountedPrice });
}
