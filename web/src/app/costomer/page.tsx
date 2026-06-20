"use client";

import Image from "next/image";
import type { Menu } from "@/lib/types";

// --- モック用のダミーデータ ---------------------------------------------
// 最終的には「職員画面で3案から選ばれた1メニュー」がここに入る想定。
// いまは固定値。画像はまだ無いので空欄（プレースホルダー）にしておく。
const menu: Menu & { remaining: number; foodLossGrams: number } = {
  menuName: "Menu Name",
  ingredients: [
    { name: "豚こま肉", usageRatio: 0.4 },
    { name: "玉ねぎ", usageRatio: 0.3 },
    { name: "にんじん", usageRatio: 0.3 },
  ],
  recipe: ["材料を切る", "炒める", "煮込む", "盛り付け"],
  allergens: ["小麦", "乳", "豚肉"],
  prepMinutes: 15,
  cookMinutesPerServing: 5,
  servings: 8,
  totalCookingMinutes: 55,
  ingredientCost: 600,
  laborCost: 400,
  profit: 2000,
  price: 500,
  // 画面表示用（型外の補足。後でバックエンド側に持たせる）
  remaining: 3,
  foodLossGrams: 250,
};

export default function CustomerPage() {
  return (
    <div className="min-h-screen bg-base-200 flex justify-center">
      <main className="w-full max-w-sm bg-base-100 min-h-screen pb-24">
        {/* ブランドヘッダー：HATOBA ロゴ（左上） */}
        <header className="flex justify-start bg-base-100 border-b border-base-300 px-4 py-3">
          <Image
            src="/brand/hatoba-logo-transparent.png"
            alt="HATOBA"
            width={120}
            height={85}
            priority
            className="h-12 w-auto object-contain"
          />
        </header>

        {/* 料理画像：まだ無いので空欄プレースホルダー */}
        <figure className="aspect-[4/3] bg-base-200 flex items-center justify-center text-base-content/35">
          <span className="text-xs tracking-widest">PHOTO COMING SOON</span>
        </figure>

        <div className="p-5 flex flex-col gap-5">
          <div>
            <p className="text-[11px] tracking-[0.3em] text-primary/70 mb-1">
              本日のごはん
            </p>
            <h1 className="text-2xl font-medium text-base-content">
              {menu.menuName}
            </h1>
          </div>

          {/* 価格・残数 */}
          <div className="flex items-stretch border border-base-300 rounded-box overflow-hidden">
            <div className="flex-1 flex flex-col items-center justify-center py-3">
              <span className="text-[11px] tracking-widest text-base-content/50">
                価格
              </span>
              <span className="text-2xl font-medium">¥{menu.price}</span>
            </div>
            <div className="w-px bg-base-300" />
            <div className="flex-1 flex flex-col items-center justify-center py-3">
              <span className="text-[11px] tracking-widest text-base-content/50">
                残り
              </span>
              <span className="text-2xl font-medium text-primary">
                {menu.remaining}
                <span className="text-base font-normal">食</span>
              </span>
            </div>
          </div>

          {/* アレルゲン */}
          <div>
            <p className="text-[11px] tracking-widest text-base-content/50 mb-2">
              アレルゲン
            </p>
            <div className="flex flex-wrap gap-1.5">
              {menu.allergens.map((a) => (
                <span
                  key={a}
                  className="badge badge-outline badge-sm border-base-300 text-base-content/80"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* 画面下固定の注文ボタン（鳩の線画・HATOBAのシンボル） */}
      <div className="fixed bottom-0 inset-x-0 flex justify-center bg-gradient-to-t from-base-100 via-base-100/90 to-transparent pt-10 pb-5">
        <button
          type="button"
          aria-label="注文する"
          className="group transition-transform duration-200 hover:-translate-y-0.5 active:scale-95"
        >
          <Image
            src="/brand/heiwado-doves.png"
            alt="注文する"
            width={92}
            height={70}
            className="w-20 h-auto object-contain rounded-xl shadow-sm"
          />
        </button>
      </div>
    </div>
  );
}
