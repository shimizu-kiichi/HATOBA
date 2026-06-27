"use client";

import Image from "next/image";
import { useState } from "react";
import type { Ingredient, Menu } from "@/lib/types";

// 画面で編集する食材1行 = 機能①の出力(Ingredient) + 在庫点数(packCount)
type Row = Ingredient & { packCount: number };

// 店舗フローの3ステップ。ヘッダーのステッパーと表示中の画面を切り替える。
type View = "register" | "menus" | "published";

// アレルギー表示の28品目（タップで選択するための一覧）
const ALLERGENS_28 = [
  "えび", "かに", "くるみ", "小麦", "そば", "卵", "乳", "落花生",
  "アーモンド", "あわび", "いか", "いくら", "オレンジ", "カシューナッツ",
  "キウイフルーツ", "牛肉", "ごま", "さけ", "さば", "大豆", "鶏肉",
  "バナナ", "豚肉", "まつたけ", "もも", "やまいも", "りんご", "ゼラチン",
];

const STEPS: { key: View; label: string }[] = [
  { key: "register", label: "食材登録" },
  { key: "menus", label: "メニュー選定" },
  { key: "published", label: "公開" },
];

export default function StorePage() {
  const [view, setView] = useState<View>("register");
  const [rows, setRows] = useState<Row[]>([]);
  const [analyzing, setAnalyzing] = useState(false); // 写真解析中
  const [suggesting, setSuggesting] = useState(false); // メニュー提案中
  const [menus, setMenus] = useState<Menu[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [publishingIndex, setPublishingIndex] = useState<number | null>(null); // 公開処理中の候補index
  const [publishedName, setPublishedName] = useState<string | null>(null); // 公開できたメニュー名
  const [publishedMenu, setPublishedMenu] = useState<Menu | null>(null); // 公開中のメニュー本体（再生成に使う）
  const [publishedImage, setPublishedImage] = useState<string | null>(null); // 公開中の画像（プレビュー用）
  const [regenerating, setRegenerating] = useState(false); // 画像の再生成中
  const [uploadingPhoto, setUploadingPhoto] = useState(false); // 実写アップロード中
  const [photoReplaced, setPhotoReplaced] = useState(false); // 実写に差し替え済み

  // 写真を選ぶ → base64化 → 機能① → 行を追加
  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じ写真でも再度選べるようにクリア
    if (!file) return;

    setAnalyzing(true);
    setError(null);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const res = await fetch("/api/extract-ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      if (!res.ok) throw new Error("写真の読み取りに失敗しました");
      const ing: Ingredient = await res.json();
      setRows((prev) => [...prev, { ...ing, packCount: 1 }]); // packCountは初期値1
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  // 「メニューを提案」→ 機能② → メニュー選定画面へ
  async function suggest() {
    setSuggesting(true);
    setError(null);
    try {
      const ingredients = rows.map((r) => ({
        productName: r.productName,
        discountedPrice: r.discountedPrice,
        unit: r.unit,
        quantity: r.quantity,
        packCount: r.packCount,
        allergens: r.allergens,
      }));
      const res = await fetch("/api/suggest-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients }),
      });
      if (!res.ok) throw new Error("メニュー提案に失敗しました");
      setMenus((await res.json()) as Menu[]);
      setView("menus");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSuggesting(false);
    }
  }

  // 候補から1つを選んで「公開」→ サーバーで画像生成＆メモリ保存。客側画面に反映される。
  async function publish(menu: Menu, index: number) {
    setPublishingIndex(index);
    setError(null);
    try {
      const res = await fetch("/api/published-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu }),
      });
      if (!res.ok) throw new Error("メニューの公開に失敗しました");
      const published = (await res.json()) as { image: string | null };
      setPublishedName(menu.menuName);
      setPublishedMenu(menu);
      setPublishedImage(published.image);
      setPhotoReplaced(false); // 新規公開はAI画像から始まる
      setView("published");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setPublishingIndex(null);
    }
  }

  // 公開中メニューの画像だけを別構図で生成し直す（seedを毎回ランダムに振る）。客側にも反映される。
  async function regenerateImage() {
    if (!publishedMenu) return;
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/published-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu: publishedMenu, seed: Math.floor(Math.random() * 1_000_000) }),
      });
      if (!res.ok) throw new Error("画像の再生成に失敗しました");
      const published = (await res.json()) as { image: string | null };
      setPublishedImage(published.image);
      setPhotoReplaced(false); // 生成画像に戻るのでイメージ画像扱い
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setRegenerating(false);
    }
  }

  // 料理完成後：実写の写真を選ぶ → data URL化 → PATCHで差し替え（客側の「※イメージ画像」が消える）
  async function replacePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じ写真でも再度選べるようにクリア
    if (!file) return;

    setUploadingPhoto(true);
    setError(null);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const dataUrl = `data:${mimeType};base64,${base64}`;
      const res = await fetch("/api/published-menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!res.ok) throw new Error("写真の差し替えに失敗しました");
      setPublishedImage(dataUrl); // 店舗側プレビューも実写に更新
      setPhotoReplaced(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setUploadingPhoto(false);
    }
  }

  // 次の営業に向けて最初から（公開済みメニューはサーバー側にそのまま残る＝客側は表示継続）
  function resetFlow() {
    setRows([]);
    setMenus([]);
    setPublishedName(null);
    setPublishedMenu(null);
    setPublishedImage(null);
    setPhotoReplaced(false);
    setError(null);
    setView("register");
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === view);

  return (
    <div className="min-h-dvh bg-base-200 flex justify-center">
      <div className="w-full max-w-md bg-base-100 min-h-dvh flex flex-col shadow-sm">
        {/* ブランドヘッダー：HATOBA ロゴ＋「店舗用」＋3ステップのステッパー */}
        <header className="sticky top-0 z-10 shrink-0 border-b border-base-300 bg-base-100/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 pt-3">
            <Image
              src="/brand/hatoba-logo-transparent.png"
              alt="HATOBA"
              width={120}
              height={85}
              priority
              className="h-9 w-auto object-contain"
            />
            <span className="rounded-full border border-base-300 px-2.5 py-0.5 text-xs tracking-widest text-base-content/60">
              店舗用
            </span>
          </div>

          {/* ステッパー */}
          <ol className="flex items-center gap-1.5 px-4 py-3">
            {STEPS.map((s, i) => {
              const done = i < currentStepIndex;
              const active = i === currentStepIndex;
              return (
                <li key={s.key} className="flex flex-1 items-center gap-1.5">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                      active
                        ? "bg-primary text-primary-content"
                        : done
                          ? "bg-secondary text-secondary-content"
                          : "bg-base-200 text-base-content/40"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span
                    className={`whitespace-nowrap text-xs ${
                      active ? "font-semibold text-base-content" : "text-base-content/45"
                    }`}
                  >
                    {s.label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className="h-px flex-1 bg-base-300" />
                  )}
                </li>
              );
            })}
          </ol>
        </header>

        {error && (
          <p className="mx-4 mt-3 rounded-field bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}

        {/* ===== ① 食材登録 ===== */}
        {view === "register" && (
          <>
            <main className="flex flex-1 flex-col gap-4 p-4">
              <div>
                <h1 className="text-xl font-semibold text-base-content">食材を登録</h1>
                <p className="mt-0.5 text-sm text-base-content/55">
                  値引き商品を1点ずつ撮影すると、AIが商品情報を読み取ります。
                </p>
              </div>

              {/* カメラ/アップロード（capture でスマホは背面カメラが開く） */}
              <label className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-box border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-8 text-center transition-colors hover:border-primary hover:bg-primary/10">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {analyzing ? (
                    <span className="loading loading-spinner loading-md" />
                  ) : (
                    <CameraIcon className="h-6 w-6" />
                  )}
                </span>
                <span className="font-semibold text-primary">
                  {analyzing ? "読み取り中…" : "値引き商品を撮影／選択"}
                </span>
                <span className="text-xs text-base-content/45">タップしてカメラを起動</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhoto}
                  disabled={analyzing}
                />
              </label>

              {/* 登録済みの食材リスト */}
              {rows.length === 0 ? (
                <p className="rounded-box border border-dashed border-base-300 px-4 py-6 text-center text-sm text-base-content/40">
                  まだ食材がありません
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {rows.map((row, i) => (
                    <li
                      key={i}
                      className="rounded-box border border-base-300 bg-base-100 p-4"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          className="min-w-0 flex-1 rounded-field border border-base-300 bg-base-100 px-3 py-2 font-semibold outline-none focus:border-primary focus:bg-base-200/40"
                          value={row.productName}
                          onChange={(e) => updateRow(i, { productName: e.target.value })}
                        />
                        <button
                          className="shrink-0 rounded-field px-2 py-1 text-sm text-error hover:bg-error/10"
                          onClick={() => removeRow(i)}
                        >
                          削除
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                        <label className="flex items-center gap-1.5 text-base-content/70">
                          価格
                          <input
                            type="number"
                            className="w-20 rounded-field border border-base-300 bg-base-100 px-2 py-1 text-right outline-none focus:border-primary"
                            value={row.discountedPrice ?? ""}
                            onChange={(e) =>
                              updateRow(i, {
                                discountedPrice:
                                  e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                          />
                          円
                        </label>

                        {/* 在庫点数 packCount のステッパー */}
                        <div className="flex items-center gap-1.5 text-base-content/70">
                          在庫
                          <button
                            className="h-7 w-7 rounded-full border border-base-300 bg-base-200 font-bold text-base-content/70 hover:bg-base-300"
                            onClick={() =>
                              updateRow(i, { packCount: Math.max(1, row.packCount - 1) })
                            }
                          >
                            −
                          </button>
                          <span className="w-8 text-center font-bold">{row.packCount}</span>
                          <button
                            className="h-7 w-7 rounded-full border border-base-300 bg-base-200 font-bold text-base-content/70 hover:bg-base-300"
                            onClick={() => updateRow(i, { packCount: row.packCount + 1 })}
                          >
                            ＋
                          </button>
                        </div>
                      </div>

                      {/* アレルギー（タップで選択／解除） */}
                      <div className="mt-3">
                        <p className="text-xs text-base-content/50">
                          アレルギー（タップで選択）
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {ALLERGENS_28.map((a) => {
                            const on = row.allergens.includes(a);
                            return (
                              <button
                                key={a}
                                onClick={() =>
                                  updateRow(i, {
                                    allergens: on
                                      ? row.allergens.filter((x) => x !== a)
                                      : [...row.allergens, a],
                                  })
                                }
                                className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                                  on
                                    ? "bg-primary text-primary-content"
                                    : "bg-base-200 text-base-content/55 hover:bg-base-300"
                                }`}
                              >
                                {a}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </main>

            {/* 下部固定の提案ボタン（食材0件のときは押せない） */}
            <div className="sticky bottom-0 shrink-0 border-t border-base-300 bg-base-100/95 px-4 py-3 backdrop-blur">
              <button
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-4 text-lg font-medium text-primary-content shadow-md transition-all duration-200 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
                disabled={rows.length === 0 || suggesting}
                onClick={suggest}
              >
                {suggesting ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    AIが提案中…
                  </>
                ) : (
                  <>
                    メニューを提案する
                    {rows.length > 0 && (
                      <span className="rounded-full bg-primary-content/20 px-2 py-0.5 text-sm">
                        {rows.length}品
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* ===== ② メニュー選定 ===== */}
        {view === "menus" && (
          <main className="flex flex-1 flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-base-content">メニュー候補</h1>
                <p className="mt-0.5 text-sm text-base-content/55">
                  AIが {rows.length}品 から提案しました。1つ選んで公開します。
                </p>
              </div>
              <button
                className="shrink-0 text-sm text-primary hover:underline"
                onClick={() => setView("register")}
              >
                ← 食材を編集
              </button>
            </div>

            <ul className="flex flex-col gap-4">
              {menus.map((m, i) => (
                <li
                  key={i}
                  className="overflow-hidden rounded-box border border-base-300 bg-base-100"
                >
                  <div className="p-5">
                    {/* 料理名と価格 */}
                    <div className="flex items-start justify-between gap-3">
                      <b className="text-lg font-semibold text-base-content">{m.menuName}</b>
                      <span className="shrink-0 text-xl font-semibold text-accent">
                        ¥{m.price}
                      </span>
                    </div>

                    {/* 食数・調理時間 */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {m.servings}食 提供可
                      </span>
                      <span className="rounded-full bg-base-200 px-2.5 py-0.5 text-xs text-base-content/60">
                        調理 {m.totalCookingMinutes}分
                      </span>
                    </div>

                    {/* 内訳 */}
                    <p className="mt-2 text-xs text-base-content/50">
                      材料費 {m.ingredientCost}円・人件費 {m.laborCost}円・利益 {m.profit}円
                    </p>

                    {/* 使う食材 */}
                    <p className="mt-3 text-sm">
                      <span className="text-base-content/50">使う食材：</span>
                      {m.ingredients.map((ing) => ing.name).join("・")}
                    </p>

                    {/* アレルギー */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                      <span className="text-base-content/50">アレルゲン：</span>
                      {m.allergens.length > 0 ? (
                        m.allergens.map((a) => (
                          <span
                            key={a}
                            className="rounded-full border border-base-300 px-2 py-0.5 text-xs text-base-content/70"
                          >
                            {a}
                          </span>
                        ))
                      ) : (
                        <span className="text-base-content/60">なし</span>
                      )}
                    </div>

                    {/* レシピ（候補比較用：折りたたみ。公開後は調理画面で大きく表示する） */}
                    <details className="group mt-3 rounded-field bg-base-200/50 px-3 py-2">
                      <summary className="flex cursor-pointer items-center gap-1 text-sm font-medium text-primary marker:content-none">
                        <span className="transition-transform group-open:rotate-90">▸</span>
                        作り方を見る（{m.recipe.length}手順）
                      </summary>
                      <div className="mt-2">
                        <RecipeSteps steps={m.recipe} size="sm" />
                      </div>
                    </details>
                  </div>

                  {/* このメニューに決定 → 客側画面に公開 */}
                  <button
                    className="flex w-full items-center justify-center gap-2 border-t border-base-300 bg-primary px-4 py-3.5 text-sm font-medium text-primary-content transition-colors hover:bg-primary/90 disabled:opacity-40"
                    disabled={publishingIndex !== null}
                    onClick={() => publish(m, i)}
                  >
                    {publishingIndex === i ? (
                      <>
                        <span className="loading loading-spinner loading-sm" />
                        公開中…（画像を生成しています）
                      </>
                    ) : (
                      <>
                        <DoveBadge />
                        このメニューを公開する
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </main>
        )}

        {/* ===== ③ 公開済み ===== */}
        {view === "published" && (
          <main className="flex flex-1 flex-col gap-5 p-4">
            <div className="flex flex-col items-center gap-3 rounded-box border border-primary/30 bg-primary/5 px-6 py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-content">
                ✓
              </span>
              <div>
                <p className="text-sm text-base-content/55">本日のメニューを公開しました</p>
                <p className="mt-1 text-xl font-semibold text-base-content">
                  {publishedName}
                </p>
              </div>
              <p className="text-xs text-base-content/50">
                アプリに表示されています。
              </p>
            </div>

            {/* ▼ 店員が調理に使う「調理指示」。一番大事なので大きく・常時表示する。 */}
            {publishedMenu && (
              <section className="overflow-hidden rounded-box border border-base-300 bg-base-100">
                <div className="flex items-center justify-between gap-2 border-b border-base-300 bg-base-200/60 px-4 py-3">
                  <h2 className="text-base font-semibold text-base-content">調理手順</h2>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {publishedMenu.servings}食分
                    </span>
                    <span className="rounded-full bg-base-200 px-2.5 py-0.5 text-xs text-base-content/70">
                      調理 約{publishedMenu.totalCookingMinutes}分
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-5 p-4">
                  {/* 使う食材 */}
                  <div>
                    <p className="mb-1.5 text-xs font-medium tracking-wide text-base-content/50">
                      使う食材
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {publishedMenu.ingredients.map((ing) => (
                        <span
                          key={ing.name}
                          className="rounded-full border border-base-300 bg-base-100 px-3 py-1 text-sm text-base-content"
                        >
                          {ing.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 手順（番号バッジ付き・大きめ） */}
                  <div>
                    <p className="mb-2 text-xs font-medium tracking-wide text-base-content/50">
                      作り方
                    </p>
                    <RecipeSteps steps={publishedMenu.recipe} />
                  </div>

                  {/* アレルゲン（提供時の確認用） */}
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-base-200 pt-4 text-sm">
                    <span className="font-medium text-base-content/50">アレルゲン</span>
                    {publishedMenu.allergens.length > 0 ? (
                      publishedMenu.allergens.map((a) => (
                        <span
                          key={a}
                          className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning-content"
                        >
                          {a}
                        </span>
                      ))
                    ) : (
                      <span className="text-base-content/60">なし</span>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* 公開中の画像プレビュー＋AIイメージの引き直し（無料枠で別構図を生成） */}
            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <p className="text-sm font-semibold text-base-content">公開中の画像</p>
              <div className="relative mt-2 aspect-[4/3] overflow-hidden rounded-field bg-base-200">
                {publishedImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={publishedImage}
                    alt={publishedName ?? ""}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-base-content/40">
                    画像を準備中
                  </div>
                )}
                {regenerating && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-base-100/70 text-sm text-base-content/70 backdrop-blur-sm">
                    <span className="loading loading-spinner loading-sm" />
                    生成中…
                  </div>
                )}
                {publishedImage && !photoReplaced && (
                  <span className="absolute bottom-2 right-2 rounded-full bg-base-content/70 px-2.5 py-1 text-xs text-base-100">
                    ※イメージ画像（AI生成）
                  </span>
                )}
              </div>

              {/* 実写に差し替える前は、気に入らなければ別構図を引き直せる */}
              {!photoReplaced && (
                <button
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-base-300 px-4 py-2.5 text-sm font-medium text-base-content/80 transition-colors hover:bg-base-200 disabled:opacity-40"
                  onClick={regenerateImage}
                  disabled={regenerating}
                >
                  {regenerating ? "生成中…" : "↻ 別の画像で再生成"}
                </button>
              )}
            </div>

            {/* 料理完成後：実写を撮影/選択して差し替え。差し替えると客側のAI注意書きが消える。 */}
            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <p className="text-sm font-semibold text-base-content">料理写真の差し替え</p>
              <p className="mt-0.5 text-xs text-base-content/55">
                公開直後はAI生成のイメージ画像です。完成後に実写へ差し替えると、客側の「イメージ画像」表示が消えます。
              </p>

              {photoReplaced ? (
                <p className="mt-3 flex items-center gap-2 rounded-field bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary">
                  <span>✓</span>
                  料理写真に差し替えました
                </p>
              ) : (
                <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-content transition-colors hover:bg-primary/90">
                  {uploadingPhoto ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      アップロード中…
                    </>
                  ) : (
                    <>
                      <CameraIcon className="h-4 w-4" />
                      料理が完成したら写真を差し替える
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={replacePhoto}
                    disabled={uploadingPhoto}
                  />
                </label>
              )}
            </div>

            <button
              className="rounded-full border border-base-300 px-4 py-3 text-sm font-medium text-base-content/70 transition-colors hover:bg-base-200"
              onClick={resetFlow}
            >
              新しい食材で最初から
            </button>
          </main>
        )}
      </div>
    </div>
  );
}

// レシピ手順を「番号バッジ＋1手順1行」で読みやすく表示する共通部品。
// size="base"（公開＝調理用、大きめ）／"sm"（候補比較用、やや小さめ）。
function RecipeSteps({ steps, size = "base" }: { steps: string[]; size?: "sm" | "base" }) {
  const isBase = size === "base";
  return (
    <ol className="flex flex-col">
      {steps.map((step, j) => (
        <li
          key={j}
          className="flex gap-3 border-t border-base-200 py-3 first:border-t-0 first:pt-0 last:pb-0"
        >
          <span
            className={`flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-content ${
              isBase ? "h-7 w-7 text-sm" : "h-6 w-6 text-xs"
            }`}
          >
            {j + 1}
          </span>
          <p
            className={`leading-relaxed text-base-content ${
              isBase ? "text-base" : "text-sm"
            }`}
          >
            {step}
          </p>
        </li>
      ))}
    </ol>
  );
}

// 公開ボタン用の鳩アイコン（客側の注文ボタンと世界観を合わせる）
function DoveBadge() {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-content/15 p-0.5">
      <Image
        src="/brand/heiwado-doves.png"
        alt=""
        width={20}
        height={16}
        className="h-auto w-4 object-contain"
      />
    </span>
  );
}

// シンプルなカメラの線画アイコン（ブランドの線画トーンに合わせる）
function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2l1.2-1.8A1 1 0 0 1 8.5 4.8h7a1 1 0 0 1 .8.4L17.5 7h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

// File → base64（"data:image/png;base64," のプレフィックスを除いた本体を返す）
function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({ base64: dataUrl.split(",")[1], mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
