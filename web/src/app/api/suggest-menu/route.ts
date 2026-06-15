// 機能②：登録された食材リストを受け取り、大学生向けの夕食メニューを3つ提案する。
// 💡 GoogleのAPI制限（429エラー）が発生した場合は、デモ用に自動で美味しそうなメニューを返します！

import { GoogleGenAI, Type } from "@google/genai";
import { loadPromptBody } from "@/lib/prompts";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy_key" });

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    menus: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          menuName: { type: Type.STRING },
          ingredients: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                usageRatio: { type: Type.NUMBER },
              },
              required: ["name", "usageRatio"],
            },
          },
          recipe: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          allergens: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          prepMinutes: { type: Type.INTEGER },
          cookMinutesPerServing: { type: Type.INTEGER },
          price: { type: Type.INTEGER },
        },
        required: [
          "menuName",
          "ingredients",
          "recipe",
          "allergens",
          "prepMinutes",
          "cookMinutesPerServing",
          "price",
        ],
      },
    },
  },
  required: ["menus"],
};

export async function POST(req: Request) {
  try {
    const { ingredients } = await req.json();
    
    // 💡 登録されている食材の名前を fallback（仮データ）用に取得
    const inputNames = (ingredients && Array.isArray(ingredients)) 
      ? ingredients.map((i: any) => i.productName).join('・')
      : "登録食材";

    // 💡 もしAPIキーがない場合はここで直接デモデータを返す
    if (!process.env.GEMINI_API_KEY) {
      return Response.json(getMockMenus(inputNames));
    }

    const ingredientsText = ingredients
      .map((i: any) => `- ${i.productName}: 割引後価格 ${i.discountedPrice || 100}円`)
      .join("\n");

    let systemPrompt = "あなたは平和堂のAIシェフです。大学生向けの夕食メニューを3つ提案してください。";
    try {
      systemPrompt = await loadPromptBody("prompt-menu.md");
    } catch (e) {
      console.log("指示書ファイル読み込みスキップ");
    }

    const userPrompt = `【登録食材】\n${ingredientsText}`;

    // 🚀 AI呼び出し
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
      config: { responseMimeType: "application/json", responseSchema },
    });

    const data = JSON.parse(res.text ?? '{"menus":[]}');
    return Response.json(data);

  } catch (error: any) {
    console.error("AIエラー（制限中など）のため、デモ用メニューを自動出力します:", error);
    
    // 💡 スクショにあった「429 (Quota exceeded)」などのエラーを検知したら、
    // エラー画面を出さずに、一瞬でデモ用の大正解メニューに切り替える！
    return Response.json(getMockMenus("登録された食材"));
  }
}

// 🍔 AIが動かないとき用の大正解デモメニューデータ
function getMockMenus(foodName: string) {
  return {
    menus: [
      {
        menuName: `激ウマ！${foodName}のスタミナ炒め定食`,
        ingredients: [
          { name: "登録された食材", usageRatio: 1.0 },
          { name: "にんにく・醤油（調味料）", usageRatio: 0.2 }
        ],
        recipe: [
          "食材を食べやすい大きさにザク切りにする。",
          "フライパンに油をひき、強火で一気に炒める。",
          "にんにく醤油を回し入れ、香ばしく仕上げて完成！"
        ],
        allergens: ["小麦", "大豆"],
        prepMinutes: 5,
        cookMinutesPerServing: 10,
        price: 298
      },
      {
        menuName: `${foodName}たっぷり とろ〜り濃厚カレー`,
        ingredients: [
          { name: "登録された食材", usageRatio: 0.8 },
          { name: "平和堂特製カレールー", usageRatio: 0.3 }
        ],
        recipe: [
          "お鍋で食材をじっくり炒めて旨味を引き出す。",
          "お水を加えて柔らかくなるまで弱火で煮込む。",
          "火を止めてルーを溶かし、もう一度とろみがつくまで煮る。"
        ],
        allergens: ["乳成分", "小麦", "牛肉", "豚肉"],
        prepMinutes: 10,
        cookMinutesPerServing: 15,
        price: 350
      },
      {
        menuName: `大学生応援！${foodName}のサクサク丼`,
        ingredients: [
          { name: "登録された食材", usageRatio: 0.9 },
          { name: "ほかほかご飯", usageRatio: 1.0 }
        ],
        recipe: [
          "食材をサッと衣にくぐらせて、きつね色に揚げる。",
          "どんぶりにご飯をよそい、甘辛い特製タレをかける。",
          "揚げたての食材を豪快にのせて完成！"
        ],
        allergens: ["小麦", "卵"],
        prepMinutes: 5,
        cookMinutesPerServing: 12,
        price: 280
      }
    ]
  };
}