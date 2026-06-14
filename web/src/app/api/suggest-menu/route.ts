// 機能②：確定した値引き食材リストを受け取り、メニュー候補3件を提案する。
// 設計・プロンプト: src/prompts/prompt-menu.md

import { GoogleGenAI, Type } from "@google/genai";
import { loadPromptBody } from "@/lib/prompts";

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

// 画面から受け取る食材リストの1件（機能①の出力を店員が確認・修正したもの）
type InputIngredient = {
  productName: string;
  discountedPrice: number | null;
  unit: string | null;
  quantity: number;
  packCount: number; // 在庫点数（店がこの商品を何パック持っているか）
};

// AIが返すメニュー1件
type MenuFromAI = {
  menuName: string;
  ingredients: { name: string; usageRatio: number }[];
  recipe: string[];
  allergens: string[];
  prepMinutes: number; // 食数によらず1回だけの下ごしらえ時間
  cookMinutesPerServing: number; // 1食を追加で仕上げる時間
};

export async function POST(req: Request) {
  try {
    const { ingredients } = (await req.json()) as { ingredients?: InputIngredient[] };
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return Response.json({ error: "ingredients(食材リスト)が必要です" }, { status: 400 });
    }

    // プロンプト本文の末尾に、実際の食材リスト(JSON)を差し込む
    const promptBody = await loadPromptBody("prompt-menu.md");
    const prompt = `${promptBody}\n\n${JSON.stringify(ingredients, null, 2)}`;

    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", responseSchema },
    });

    // デバッグ出力
    console.log("Gemini response text:", res.text);

    if (!res.text) {
      return Response.json(
        { error: "Gemini からの応答が空です。APIキーやクォータを確認してください。" },
        { status: 500 }
      );
    }

    let menus: MenuFromAI[];
    try {
      menus = JSON.parse(res.text) as MenuFromAI[];
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "Response:", res.text);
      return Response.json(
        { error: `Gemini の応答が JSON ではありません: ${res.text.substring(0, 200)}` },
        { status: 500 }
      );
    }

  // 食数・金額はAIに計算させず、ここで算出する（食材名で割引後価格・在庫点数を引く）
  const priceByName = new Map<string, number>();
  const packCountByName = new Map<string, number>();
  for (const ing of ingredients) {
    if (ing.discountedPrice !== null) priceByName.set(ing.productName, ing.discountedPrice);
    packCountByName.set(ing.productName, ing.packCount);
  }

  const result = menus.map((menu) => {
    // 1食ぶんの材料費（割引後価格 × 使用割合）
    const ingredientCost = menu.ingredients.reduce((sum, item) => {
      const unitPrice = priceByName.get(item.name) ?? 0; // リストに無ければ0扱い
      return sum + Math.round(unitPrice * item.usageRatio);
    }, 0);

    // 在庫全体で何食作れるか（使うリスト食材のボトルネックで決まる）
    const servingsPerIngredient = menu.ingredients
      .filter((item) => item.usageRatio > 0 && packCountByName.has(item.name))
      .map((item) => Math.floor((packCountByName.get(item.name) ?? 0) / item.usageRatio));
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
  } catch (err) {
    console.error("API error:", err);
    return Response.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
