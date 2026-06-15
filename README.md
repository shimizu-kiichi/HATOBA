# HATOBA

スマートライフハッカソン（平和堂 × ソフトバンク）の提案プロジェクト（最終成果物は発表用デモ動画）。

平和堂のイートインスペースを、賞味期限間近の食品を活用した
大学生向けの「夕食食堂」に変えるスマートフォンアプリ。

## コンセプト

値引きされた食材を店員がスマホで撮影すると、AIがその食材を使った
大学生向けの格安メニューを提案。学生はアプリで当日メニューを見て、席のバーコードから
注文・決済し、イートインで食べる——という一連の流れを提供する。

## 解決する課題

- 大学生の孤独・つながりの希薄化
- 大学生の食費負担
- 平和堂のフードロスと、40歳未満の客層の少なさ

これらを同時に解決することを目指す。

## アーキテクチャ（AIコア）

サービスの中核は、Geminiを使った **2つのAI機能**。

```
[店員] 値引き商品を1点ずつ撮影
        │ 画像(base64)
        ▼
① /api/extract-ingredients  ── Gemini ──▶ 商品情報JSON
        │   { productName, originalPrice(税込), discountPercent, unit, quantity, allergens }
        │   route.ts が discountedPrice(割引後価格) を計算して付与
        ▼
[確認画面] 店員が個数・価格・在庫点数(packCount)などを修正 → 食材リスト確定
        │ 食材リスト(JSON)
        ▼
② /api/suggest-menu  ── Gemini ──▶ メニュー候補3件
        │   { menuName, ingredients[{name, usageRatio}], recipe, allergens, prepMinutes, cookMinutesPerServing }
        │   route.ts が「何食作れるか(servings)・材料費・人件費・利益・販売価格」を計算して付与
        ▼
[結果画面] 候補3件を表示 → 店が1つ選んで「公開」
```

### 設計方針

- **APIキーはサーバー側（API Route）でのみ使用**。画像・食材リストは Next.js の `route.ts` を経由して
  Gemini に渡し、キーをクライアントに出さない（`web/.env.local` の `GEMINI_API_KEY`）。
- **金額・食数などの計算はAIにさせず、コード側（route.ts）で計算**する。AIには「何をどれだけ使うか」等の
  *判断* だけを任せ、割引後価格・材料費・人件費・利益・販売価格・何食作れるかは全てサーバーで算術する（数値のブレ防止）。
- **AIの出力フォーマットは `responseSchema`（`Type` enum）で固定**し、常に決まった形のJSONで返るようにする。
- **プロンプト本文は Markdown ファイルに分離**（`web/src/prompts/*.md`）。文言を直すだけで挙動を調整でき、
  コードに散らばらない。実行時に `src/lib/prompts.ts` の `loadPromptBody()` で読み込む。

## 技術スタック

- **Next.js 16**（App Router / TypeScript / Tailwind CSS / `src/` 構成）— `web/` 配下
- **Google Gemini（`gemini-2.5-flash`）/ `@google/genai`**
- デプロイ先は **Vercel**（予定）

## ディレクトリ構成

```
HATOBA/
├── web/                  # Next.js アプリ本体（npm系コマンドは web/ で実行）
│   ├── src/app/          # 画面 & API Route（/api/extract-ingredients, /api/suggest-menu）
│   ├── src/prompts/      # Geminiへのプロンプト本文（.md）
│   └── src/lib/          # 共有型(types.ts)・プロンプト読み込み(prompts.ts)
└── docs/                 # 設計ドキュメント
    ├── roadmap.md        # 開発ロードマップ
    └── demo-storyboard.md# デモ動画の絵コンテ
```

## ローカルで動かす

Gemini APIキーが必要（[Google AI Studio](https://aistudio.google.com/) で発行）。

```bash
cd web
echo "GEMINI_API_KEY=<APIキー>" > .env.local   # キーは絶対にコミットしない
npm install
npm run dev
```

`http://localhost:3000` を開く。

## 開発ステータス

- **AIコア2機能（① 写真→食材、② 食材→メニュー）実装済み**。実際に Gemini で動作。
- **フロントは本実装中**。現状の画面はAIコアの動作確認用の仮UI。
  撮影→確認・修正→メニュー表示の店舗側画面、続いて学生側のモック画面を作っていく。

詳細は [`docs/roadmap.md`](docs/roadmap.md) を参照。
