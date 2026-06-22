// 機能②：確定した値引き食材リストを受け取り、メニュー候補3件を提案する。
// 設計・プロンプト: src/prompts/prompt-menu.md

import { GoogleGenAI, Type } from "@google/genai";
import { loadPromptBody } from "@/lib/prompts";
import { generateStructured } from "@/lib/claude";
import type { InputIngredient, MenuFromAI } from "@/lib/types";

// AI応答に時間がかかるため、Vercelの関数タイムアウトを延長（無料プラン上限60秒）
export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const responseSchema = {
  type: Type.ARRAY, // メニュー候補3件の配列
  items: {
    type: Type.OBJECT,
    properties: {
      menuName: { type: Type.STRING },
      ingredients: {
        type: Type.ARRAY, // 使うリスト食材
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING }, // 入力リストの productName と一致
            usageRatio: { type: Type.NUMBER }, // パッケージ全体のうち1食で使う割合(0〜1)
          },
          required: ["name", "usageRatio"],
          propertyOrdering: ["name", "usageRatio"],
        },
      },
      recipe: { type: Type.ARRAY, items: { type: Type.STRING } }, // 調理手順(1ステップ1要素)
      allergens: { type: Type.ARRAY, items: { type: Type.STRING } }, // 28品目から該当
      prepMinutes: { type: Type.INTEGER }, // 食数によらず1回だけの下ごしらえ時間
      cookMinutesPerServing: { type: Type.INTEGER }, // 1食を追加で仕上げる時間
    },
    required: ["menuName", "ingredients", "recipe", "allergens", "prepMinutes", "cookMinutesPerServing"],
    propertyOrdering: ["menuName", "ingredients", "recipe", "allergens", "prepMinutes", "cookMinutesPerServing"],
  },
};

// Claude用スキーマ（標準のJSON Schema）。tool useの都合で、配列を menus キーで包む。
// name は入力食材名の enum に制限する → Claudeが名前を言い換えたり入力外の食材を捏造するのを防ぐ
// （価格計算が food名の完全一致で割引価格を引くため、名前のブレは材料費0円の原因になる）
function buildClaudeSchema(productNames: string[]) {
  return {
    type: "object",
    properties: {
      menus: {
        type: "array",
        items: {
          type: "object",
          properties: {
            menuName: { type: "string" },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    enum: productNames,
                    description:
                      "使うリスト食材の名前。必ず入力リストの productName のいずれかを一字一句そのままコピーすること。リストに無い食材を新たに作り出してはならない。",
                  },
                  usageRatio: { type: "number" },
                },
                required: ["name", "usageRatio"],
              },
            },
            recipe: { type: "array", items: { type: "string" } },
            allergens: { type: "array", items: { type: "string" } },
            prepMinutes: { type: "integer" },
            cookMinutesPerServing: { type: "integer" },
          },
          required: ["menuName", "ingredients", "recipe", "allergens", "prepMinutes", "cookMinutesPerServing"],
        },
      },
    },
    required: ["menus"],
  };
}

export async function POST(req: Request) {
  const { ingredients } = (await req.json()) as { ingredients?: InputIngredient[] };
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return Response.json({ error: "ingredients(食材リスト)が必要です" }, { status: 400 });
  }

  // プロンプト本文の末尾に、実際の食材リスト(JSON)を差し込む
  const promptBody = await loadPromptBody("prompt-menu.md");
  const prompt = `${promptBody}\n\n${JSON.stringify(ingredients, null, 2)}`;

  // AI_PROVIDER=claude のときだけ Claude、それ以外（未設定含む）は従来どおり Gemini
  let menus: MenuFromAI[];
  if (process.env.AI_PROVIDER === "claude") {
    const claudeSchema = buildClaudeSchema(ingredients.map((ing) => ing.productName));
    const out = await generateStructured<{ menus: MenuFromAI[] }>({ prompt, schema: claudeSchema });
    menus = out.menus;
  } else {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", responseSchema },
    });
    menus = JSON.parse(res.text ?? "[]") as MenuFromAI[];
  }

  // 食数・金額はAIに計算させず、ここで算出する（食材名で割引後価格・在庫点数を引く）
  // 食材名は NFC で正規化して照合する（日本語は見た目同じでも NFC/NFD で文字コードが異なり、
  // AIが返した名前と入力名が一致せず材料費0円になることがあるため）。
  const norm = (s: string) => s.normalize("NFC");
  const priceByName = new Map<string, number>();
  const packCountByName = new Map<string, number>();
  for (const ing of ingredients) {
    if (ing.discountedPrice !== null) priceByName.set(norm(ing.productName), ing.discountedPrice);
    packCountByName.set(norm(ing.productName), ing.packCount);
  }

  const result = menus.map((menu) => {
    // 1食ぶんの材料費（割引後価格 × 使用割合）
    const ingredientCost = menu.ingredients.reduce((sum, item) => {
      const unitPrice = priceByName.get(norm(item.name)) ?? 0; // リストに無ければ0扱い
      return sum + Math.round(unitPrice * item.usageRatio);
    }, 0);

    // 在庫全体で何食作れるか（使うリスト食材のボトルネックで決まる）
    const servingsPerIngredient = menu.ingredients
      .filter((item) => item.usageRatio > 0 && packCountByName.has(norm(item.name)))
      .map((item) => Math.floor((packCountByName.get(norm(item.name)) ?? 0) / item.usageRatio));
    const servings =
      servingsPerIngredient.length > 0 ? Math.max(1, Math.min(...servingsPerIngredient)) : 1;

    // 食数を考慮した調理時間（下ごしらえは1回、あとは1食ごと）
    const totalCookingMinutes = menu.prepMinutes + menu.cookMinutesPerServing * servings;
    const perServingMinutes = totalCookingMinutes / servings;

    // 価格は1食あたり（まとめ調理ぶん、1食の人件費は安くなる）
    const laborCost = Math.round((perServingMinutes / 60) * 1000); // 時給1,000円・1食あたり
    const profit = Math.round((ingredientCost + laborCost) * 0.2); // 利益20%
    const price = ingredientCost + laborCost + profit;
    return { ...menu, servings, totalCookingMinutes, ingredientCost, laborCost, profit, price };
  });

  return Response.json(result);
}
