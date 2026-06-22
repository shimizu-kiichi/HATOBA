"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { Menu } from "@/lib/types";

// 客側が表示する「公開中の1件」。サーバー(/api/published-menu)から取得する。
type PublishedMenu = Menu & {
  image: string | null; // AI生成 or 実写の base64 データURL。未生成なら null
  isReal: boolean; // false = AI生成イメージ（注意書きを出す）, true = 実写
  remaining: number;
};

export default function CustomerPage() {
  const [menu, setMenu] = useState<PublishedMenu | null>(null);
  const [loading, setLoading] = useState(true);

  // 公開中メニューを取得（店が「公開」するとここに反映される）
  useEffect(() => {
    fetch("/api/published-menu")
      .then((res) => res.json())
      .then((data: PublishedMenu | null) => setMenu(data))
      .catch(() => setMenu(null))
      .finally(() => setLoading(false));
  }, []);

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

        {loading ? (
          // 読み込み中
          <div className="flex-1 flex items-center justify-center text-base-content/50">
            読み込み中…
          </div>
        ) : !menu ? (
          // まだ何も公開されていない
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-lg font-medium text-base-content/70">
              本日のメニューは準備中です
            </p>
            <p className="text-sm text-base-content/50">
              お店がメニューを公開するまでお待ちください。
            </p>
          </div>
        ) : (
          <>
            {/* 料理画像：少し小さめの固定サイズ */}
            <figure className="shrink-0 relative aspect-[4/3] max-h-[40dvh] bg-base-200">
              {menu.image ? (
                // base64 の生成画像/実写。next/image の最適化を通さず素の img で表示。
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={menu.image}
                  alt={menu.menuName}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                // 画像が無い（生成失敗など）ときのプレースホルダー
                <div className="absolute inset-0 flex items-center justify-center text-base-content/40">
                  画像を準備中
                </div>
              )}

              {/* AI生成イメージのときだけ注意書きを出す（実写に差し替わると自動で消える） */}
              {menu.image && !menu.isReal && (
                <span className="absolute bottom-2 right-2 rounded-full bg-base-content/70 px-2.5 py-1 text-xs text-base-100">
                  ※イメージ画像（AI生成）
                </span>
              )}
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
          </>
        )}
      </main>
    </div>
  );
}
