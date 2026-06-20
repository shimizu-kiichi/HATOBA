"use client";

import Image from "next/image";
import type { Menu } from "@/lib/types";

// --- モック用のダミーデータ ---------------------------------------------
// 最終的には「職員画面で3案から選ばれた1メニュー」がここに入る想定。
// いまは固定値。画像はまだ無いので空欄（プレースホルダー）にしておく。
const menu: Menu & { remaining: number; foodLossGrams: number } = {
  menuName: "鶏むね肉となめこの和風あんかけ丼風炒め",
  ingredients: [
    { name: "鶏むね肉", usageRatio: 0.5 },
    { name: "なめこ", usageRatio: 0.3 },
    { name: "水菜", usageRatio: 0.2 },
  ],
  recipe: [
    "鶏むね肉約150gを一口大のそぎ切りにし、塩少々と片栗粉をまぶす。",
    "なめこ半パックはさっと水で洗い、水菜半束は4cm長さに切る。",
    "フライパンに油をひき、鶏むね肉を中火で両面しっかり焼く。",
    "だし150ml・醤油大さじ1・みりん大さじ1を加え、なめこを入れて煮立てる。",
    "水溶き片栗粉でとろみをつけ、最後に水菜を加えてさっと火を通す。",
    "器に盛り、好みで七味唐辛子をふって仕上げる。",
  ],
  allergens: ["鶏肉", "小麦", "大豆"],
  prepMinutes: 12,
  cookMinutesPerServing: 9,
  servings: 12,
  totalCookingMinutes: 120,
  ingredientCost: 154,
  laborCost: 167,
  profit: 64,
  price: 385,
  // 画面表示用（型外の補足。後でバックエンド側に持たせる）
  remaining: 12,
  foodLossGrams: 250,
};

export default function CustomerPage() {
  return (
    <div className="h-dvh bg-base-200 flex justify-center">
      {/* 画面1枚に収める縦フレックス（スクロールなし） */}
      <main className="w-full max-w-sm bg-base-100 h-full flex flex-col">
        {/* ブランドヘッダー：HATOBA ロゴ（左上） */}
        <header className="shrink-0 flex justify-start bg-base-100 border-b border-base-300 px-4 py-3">
          <Image
            src="/brand/hatoba-logo-transparent.png"
            alt="HATOBA"
            width={120}
            height={85}
            priority
            className="h-11 w-auto object-contain"
          />
        </header>

        {/* 料理画像：少し小さめの固定サイズ */}
        <figure className="shrink-0 relative aspect-[4/3] max-h-[40dvh] bg-base-200">
          <Image
            src="/menu/ankakedon.png"
            alt={menu.menuName}
            fill
            priority
            sizes="(max-width: 384px) 100vw, 384px"
            className="object-cover"
          />
        </figure>

        {/* メニュー情報（文字大きめ） */}
        <div className="shrink-0 px-5 pt-5 pb-3 flex flex-col gap-4">
          <h1 className="text-3xl font-semibold text-base-content">
            {menu.menuName}
          </h1>

          {/* 価格・残数 */}
          <div className="flex items-stretch border border-base-300 rounded-box overflow-hidden">
            <div className="flex-1 flex flex-col items-center justify-center py-3">
              <span className="text-xs tracking-widest text-base-content/50">
                価格
              </span>
              <span className="text-3xl font-semibold">¥{menu.price}</span>
            </div>
            <div className="w-px bg-base-300" />
            <div className="flex-1 flex flex-col items-center justify-center py-3">
              <span className="text-xs tracking-widest text-base-content/50">
                残り
              </span>
              <span className="text-3xl font-semibold text-primary">
                {menu.remaining}
                <span className="text-lg font-normal">食</span>
              </span>
            </div>
          </div>

          {/* アレルゲン */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm tracking-widest text-base-content/50">
              アレルゲン
            </span>
            <div className="flex flex-wrap gap-1.5">
              {menu.allergens.map((a) => (
                <span
                  key={a}
                  className="badge badge-outline badge-md border-base-300 text-base-content/80"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 余白を吸収してボタンを最下段に固定（スクロールなし） */}
        <div className="flex-1 min-h-0" />

        {/* 注文ボタン（鳩アイコン＋ラベル＋価格） */}
        <div className="shrink-0 px-4 pb-5 pt-1">
          <button
            type="button"
            className="group flex w-full items-center gap-3 rounded-full bg-primary px-5 py-4 text-primary-content shadow-md transition-all duration-200 hover:bg-primary/90 active:scale-[0.98]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-base-100 p-1">
              <Image
                src="/brand/heiwado-doves.png"
                alt=""
                width={32}
                height={24}
                className="h-auto w-7 object-contain"
              />
            </span>
            <span className="text-lg font-medium tracking-wide">注文する</span>
            <span className="ms-auto text-lg font-semibold">¥{menu.price}</span>
          </button>
        </div>
      </main>
    </div>
  );
}
