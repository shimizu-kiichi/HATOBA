# HATOBA 開発ロードマップ（Next.js + Gemini 無料枠）

> 方針: **6/20 までに「シーン2＝食材写真→AIメニュー提案」を動かす**ことを最優先。
> AIコアを先に単体で動かし、モック画面は後から被せる。

## 技術構成（全体像）

```
[ブラウザ(スマホ表示)]
   食材写真をアップロード
        │
        ▼
[Next.js API Route /api/suggest-menu]  ← サーバー側。ここでGeminiを呼ぶ
        │  画像(base64) + プロンプト
        ▼
[Gemini API (gemini-2.5-flash, 無料枠)]
        │  メニュー候補をJSONで返す
        ▼
[結果画面] メニュー名・材料・アレルギー・価格を表示
```

- **APIキーは必ずサーバー側（API Route）でだけ使う。** クライアント(ブラウザ)のコードに書くと漏れる。
- 画面はモバイル幅で作り、ブラウザのスマホ表示で画面録画する。

---

## Phase 0: 環境とAPIキー（所要 半日 / 担当: あなた、相手は横で同じ手順を踏む）

1. **Node.js をインストール**（LTS版, 20以上）: https://nodejs.org
   確認: `node -v` / `npm -v`
2. **Next.jsプロジェクト作成**（このHATOBAフォルダ内に作る）:
   ```powershell
   npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --no-import-alias
   ```
3. **Gemini APIキーを取得**:
   - https://aistudio.google.com にGoogleアカウントでログイン
   - 「Get API key」→ APIキーを発行（無料枠・クレカ不要）
4. **キーを環境変数に置く**（`.env.local` を作成。Gitに上げない＝.gitignoreに既に入る）:
   ```
   GEMINI_API_KEY=ここに発行したキー
   ```
5. **Gemini SDK を入れる**:
   ```powershell
   npm install @google/genai
   ```
6. 起動確認: `npm run dev` → http://localhost:3000 が開けばOK。

**完了の定義**: ローカルでNext.jsが起動し、APIキーが`.env.local`にある。

---

## Phase 1: AIコア単体（最優先・6/20の目標 / 担当: あなた＋AI支援）

> UIを作る前に、まず「画像→メニューJSON」だけを動かす。

1. **プロンプトを設計**（`docs/prompt.md` に文面を置く）:
   - 入力: 食材の写真
   - 出力: メニュー候補3件（メニュー名 / 主な材料 / アレルギー / 想定価格）をJSONで
2. **API Route を作る**: `src/app/api/suggest-menu/route.ts`
   - 画像(base64)を受け取り → Geminiに渡す → JSONを返す（下に骨組み）
3. **UIなしで動作確認**: テスト用の食材写真1枚を用意し、簡単なテストページかcurlで叩いて、JSONが返るのを確認。
4. **最小の撮影/アップロード画面**を作る: `src/app/store/page.tsx`
   - `<input type="file" accept="image/*" capture="environment">`（スマホだとカメラが開く）
   - アップロード → /api/suggest-menu を呼ぶ → 結果を画面に表示

**完了の定義（＝6/20の合格ライン）**: スマホ表示の画面で食材写真を選ぶと、AIがメニュー候補3件を返して画面に出る。

### API Route の骨組み（叩き台）
```ts
// src/app/api/suggest-menu/route.ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(req: Request) {
  const { imageBase64, mimeType } = await req.json();

  const prompt = `あなたは平和堂の総菜開発者です。写真の食材（期限が近い）を主役に、
学生向けの格安夕食メニュー候補を3つ提案してください。各候補に
menuName(料理名), ingredients(主な材料の配列), allergens(アレルギー成分の配列),
price(想定価格 円, 300〜500) を含めてください。`;

  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash", // 無料枠で使えるvision対応モデル（要確認）
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data: imageBase64 } },
      ],
    }],
    config: { responseMimeType: "application/json" },
  });

  return Response.json(JSON.parse(res.text));
}
```
> 注: `@google/genai` のAPIは更新されることがあるので、動かないときは公式サンプルで呼び出し形を確認する。モデル名も無料枠で使えるものを最新で確認。

---

## Phase 2: モック画面を肉付け（6/20以降 / 担当: 画面=あなた、データ/文言=相手）

AIは絡めず、固定データ＋ボタン遷移で「動いて見える」画面を作る。絵コンテのシーン3〜6に対応。

- [ ] 店舗側: メニュー公開画面（候補から1つ選んで「公開」） `src/app/store/publish`
- [ ] 学生側: 今日のメニュー・残数一覧 `src/app/student/menu`
- [ ] 学生側: 席バーコードスキャン→注文確認 `src/app/student/order`
- [ ] 学生側: HOP風決済完了 `src/app/student/pay`
- データは `src/data/*.ts` にダミーで持つ（相手が中身を差し替える担当）

---

## Phase 3: 仕上げ・動画録画（7/4に向けて / 担当: 相手主導）

- [ ] スマホ幅でのレイアウト微調整・ロゴ・配色（HATOBA=鳩＋波止場の世界観）
- [ ] 具体シナリオのダミーデータ確定（鶏もも肉→味噌だれ丼 など）
- [ ] 実写シーン（食材撮影・受け取り）の撮影
- [ ] 画面録画＋実写を編集して2分のデモ動画に
- [ ] プレゼン資料に動画を組み込む

---

## 役割分担まとめ
| | あなた（経験者） | 相手（未経験） |
|--|--|--|
| Phase 0 | 主導 | 同じ手順を自分の環境でも踏む（環境構築の練習） |
| Phase 1 | AIコア実装 | テスト用の食材写真を集める／プロンプト文言を一緒に考える |
| Phase 2 | 画面の実装 | ダミーデータ・画面テキストの作成と差し替え |
| Phase 3 | 技術的な仕上げ | **撮影・動画編集・プレゼン資料（主担当）** |

## 次の一歩
1. Phase 0 を二人で実施（Node導入→create-next-app→Geminiキー取得）
2. 出来たら Phase 1 のAPI Routeを一緒に動かす
