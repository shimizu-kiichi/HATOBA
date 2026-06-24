// 公開中メニューの保存先。モックなのでサーバーのメモリに「現在の1件」だけを持つ。
// （DB・ファイル・KVは使わない。設計: docs/customer-menu-image.md）
// globalThis に持たせて、開発時の HMR（ホットリロード）でも値が消えないようにする。

import type { Menu } from "@/lib/types";

// 公開中の1件。メニュー本体＋画像(base64)＋実写フラグ＋残数。
export type PublishedMenu = Menu & {
  image: string | null; // 画像の base64 データURL（"data:image/png;base64,..."）。未生成なら null
  isReal: boolean; // false = AI生成イメージ, true = 店の実写
  remaining: number; // 残数（＝作れる食数）
  publishedAt: number; // 公開時刻（ミリ秒）
};

// HMR をまたいで生き残らせるため globalThis に1スロットだけ確保する。
const store = globalThis as unknown as { __hatobaCurrentMenu?: PublishedMenu | null };

// 現在公開中の1件を取得（無ければ null）。
export function getCurrentMenu(): PublishedMenu | null {
  return store.__hatobaCurrentMenu ?? null;
}

// 現在の1件を丸ごと上書き（新規公開）。
export function setCurrentMenu(menu: PublishedMenu): void {
  store.__hatobaCurrentMenu = menu;
}

// 現在の1件の画像を実写に差し替え、isReal=true にする（料理完成後）。
// 公開中の1件が無ければ false を返す。
export function replacePhoto(image: string): boolean {
  const current = store.__hatobaCurrentMenu;
  if (!current) return false;
  current.image = image;
  current.isReal = true;
  return true;
}
