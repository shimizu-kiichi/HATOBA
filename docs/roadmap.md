# HATOBA 開発ロードマップ（Next.js + Gemini）

> 方針: **平和堂店内でのデモ動画撮影までに「写真 → 食材抽出 → AIメニュー提案」の一連が実機スマホで動く**ことを最優先。
> AIコアを先に動かし、モック画面は後から被せる。
> （アーキテクチャ・設計方針の概要は [`../README.md`](../README.md) を参照。ここでは進め方を管理する）

## サービスの流れ（全体像）

```
[スマホ：Vercelの公開URLを開く]
  店員が値引き商品を1点ずつ撮影
        │ 画像(base64)
        ▼
[/api/extract-ingredients]  ← サーバー側でGeminiを呼ぶ（機能①）
        │ AI出力: { productName, originalPrice(税込), discountPercent, unit, quantity, allergens }
        │ route.ts が discountedPrice(割引後価格) を計算して付与
        ▼
[確認画面] 店員が価格・在庫点数(packCount)・アレルギーなどを手で修正 → 食材リスト確定
        │ 食材リスト(JSON)
        ▼
[/api/suggest-menu]  ← サーバー側でGeminiを呼ぶ（機能②）
        │ AI出力: メニュー候補3件
        │   { menuName, ingredients[{name, usageRatio}], recipe, allergens, prepMinutes, cookMinutesPerServing }
        │ route.ts が 何食作れるか(servings)・調理時間・材料費・人件費・利益・price を計算して付与
        ▼
[結果画面] 候補3件を表示 → 店が1つ選んで「公開」
```

- **APIキーは必ずサーバー側（API Route）でだけ使う。** クライアントに書くと漏れる。`web/.env.local` の `GEMINI_API_KEY`。
- **金額・食数の計算はAIにさせず route.ts で行う**（AIは「何をどれだけ使うか」などの判断のみ。算術はコード）。
- **AIとやり取りする型は `web/src/lib/types.ts` に集約**し、サーバー（route.ts）と画面で共有する。

## 技術構成

- フロント/サーバー: **Next.js 16（App Router, TypeScript, Tailwind, `src/` 構成）**。`HATOBA/web/` の中。
- 生成AI: **Google Gemini（`gemini-2.5-flash`）/ `@google/genai`**。出力の形は各 route.ts の `responseSchema`（`Type` enum）で固定する。
- プロンプト本文は **`web/src/prompts/*.md` の ` ```text ` ブロックを正本**とし、`src/lib/prompts.ts` の `loadPromptBody()` で実行時に読み込む（route.ts に文面を重複させない。md を書き換えれば次のリクエストから反映）。
- **動かし方・デモ: 実機スマホでアプリを操作する様子を実写撮影するのが必須。** Wi-Fi は使えない前提なので **Vercel にデプロイし、スマホはモバイル回線で公開URLを開く**（HTTPSなのでカメラもそのまま動く）。`next.config.ts` の `outputFileTracingIncludes` でプロンプト md を同梱済み。

## 「本物 / モック」の切り分け

- **本物にする = AIコアの2機能（機能① 写真→食材、機能② 食材→メニュー）。** ここだけ実際にGeminiを動かす。
- それ以外（決済・席バーコード注文・残数表示など）はモック（固定データ＋ボタン遷移）でOK。動画で動いて見えれば十分。
- アレルギー表示・価格はAIコアの出力をそのまま使う（副次的だが本物のデータが出る）。

## フォルダ構成の前提

- Next.js アプリは `HATOBA/web/` の中（フォルダ名「HATOBA」は npm 名に使えないため小文字の `web` サブフォルダ）。`npm` 系コマンドは `cd web` してから実行。
- 設計ドキュメント（このロードマップ・絵コンテ）は `HATOBA/docs/`。
- **プロンプト本文は `HATOBA/web/src/prompts/`**（アプリと一緒にデプロイされる場所）。

---

## Phase 0: 環境（済）

- Node.js（LTS）/ `create-next-app` で `web/` 作成 / Gemini APIキー取得 → `web/.env.local` の `GEMINI_API_KEY` / `npm install @google/genai`。
- `cd web && npm run dev` で起動確認。

## Phase 1: AIコア2機能（済）

> 「画像→食材JSON」と「食材リスト→メニューJSON」をGeminiで動かす部分。

- [x] プロンプト本文を `web/src/prompts/prompt-extract.md` / `prompt-menu.md` に整備。
- [x] プロンプト読み込みヘルパー `src/lib/prompts.ts`（`loadPromptBody`）。
- [x] 共有型を `web/src/lib/types.ts` に集約（サーバー・画面で共通利用）。
- [x] 機能① `web/src/app/api/extract-ingredients/route.ts`：写真(base64)→商品情報JSON（税込価格・アレルギー含む）。`discountedPrice` は route.ts で算出。
- [x] 機能② `web/src/app/api/suggest-menu/route.ts`：食材リスト→メニュー候補3件。在庫点数(packCount)から `servings`(何食作れるか)・調理時間・材料費・人件費・利益・`price` を route.ts で算出。
- [x] 動作確認: 食材写真で機能①がJSONを返すこと／ダミー食材リストで機能②がメニュー3件（レシピ・アレルギー合算・食数・価格つき）を返すことを確認。

**残り（＝デモ動画撮影までの合格ライン）**: スマホ実機で、値引き商品を撮影 → 食材が出る →（店員が確認）→ AIがメニュー候補3件を返して画面に出る、までを **UIで通す**（→ Phase 2・3 で対応）。

## Phase 2: 画面の本実装（進行中）

AIコア以外は固定データ＋ボタン遷移で「動いて見える」画面を作る。絵コンテに対応。

- [~] 店舗側: 食材の登録画面（撮影/アップロード→機能①→食材リスト）。**現状は動作確認用の仮UI（`web/src/app/page.tsx`）があり、本実装で置き換える。**
- [~] 店舗側: 食材の確認・修正画面（価格・在庫点数(packCount)・アレルギーを編集して食材リストを確定 → 機能②へ）。仮UIに編集機能あり。本実装で整える。
- [ ] 店舗側: メニュー候補の表示・公開画面（候補3件から1つ選んで「公開」）。
- [ ] 学生側: 今日のメニュー・残数一覧
- [ ] 学生側: 席バーコードスキャン → 注文確認
- [ ] 学生側: HOP風決済完了
- ダミーデータは `web/src/data/*.ts` 等にまとめ、相手が中身を差し替える担当。

## Phase 3: 仕上げ・動画（最終発表日 7/4 に向けて）

- [ ] Vercel デプロイ（Root Directory を `web/` に設定、`GEMINI_API_KEY` を環境変数に）。
- [ ] スマホ実機で公開URLを開き、操作する様子を実写撮影。
- [ ] スマホ幅のレイアウト・配色・ロゴ（HATOBA＝鳩＋波止場の世界観）。
- [ ] 具体シナリオのダミーデータ確定 → 実写と画面を編集して2分のデモ動画に。
- [ ] プレゼン資料に動画を組み込む。

---

## 役割分担

| | あなた（経験者） | 相手（未経験） |
|--|--|--|
| Phase 0 | 主導 | 同じ手順を自分の環境でも踏む |
| Phase 1 | AIコア2機能の実装 | テスト用の食材写真を集める／プロンプト文言を一緒に考える（`web/src/prompts/` を編集） |
| Phase 2 | 画面の実装 | ダミーデータ・画面テキストの作成と差し替え |
| Phase 3 | デプロイ・技術的な仕上げ | **撮影・動画編集・プレゼン資料（主担当）** |

## 次の一歩

1. 店舗側の本実装（登録 → 確認・修正 → メニュー候補の表示・公開）を仮UIから作り込む。
2. 学生側のモック画面（今日のメニュー・残数 → 席バーコード注文 → HOP風決済）。
3. Vercel にデプロイしてスマホ実機で疎通確認 → 実写撮影。
