// 1. 外部の道具箱から、Gemini APIを動かすためのメインの部品を読み込みます
import { GoogleGenAI } from "@google/genai";

// 2. 秘密の鍵（APIキー）を使って、いつでもAIを呼び出せるマシーン「ai」を組み立てます
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// 3. 画面から「メニューを提案して！」という通信（POST）が来たら、ここからの処理をスタートします
export async function POST(req: Request) {

  // 4. 画面（表）から送られてきたデータ（req）の中から、「ingredients（食材リスト）」だけを抜き出して箱に入れます
  const { ingredients } = await req.json();

  // 5. AIへの手紙（プロンプト）を作ります。${...} を使うことで、上の4番で受け取った食材リストを文字として自動で埋め込んでいます
  const prompt = `【ここに現在考えているプロンプトの文面を入れてください】
（例: あなたは平和堂の総菜開発者です。以下の食材リストの中からいくつか、またはすべてを使って、学生向けのメニューを提案してください...など）

▼ 登録された食材リスト:
${JSON.stringify(ingredients, null, 2)}
`;

  // 6. 組み立てたマシーン「ai」に、使う頭脳（モデル）と、作った手紙（プロンプト）を手渡して、AIが考え終わるのを待ちます（await）
  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        { text: prompt } // ここが文字だけになりました！
      ],
    }],
    // 7. AIに対して「普通の雑談じゃなくて、メニュー名や価格が整理されたJSON形式で返事をしてね」と指定します
    config: { responseMimeType: "application/json" },
  });

  // 8. AIから返ってきた返事（res.text）を、プログラムが扱いやすいデータに翻訳（parse）して、画面側に「はい、これがメニューだよ！」と送り返します
  return Response.json(JSON.parse(res.text));
}