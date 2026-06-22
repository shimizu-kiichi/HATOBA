"use client";

import { useState } from "react";
import type { Ingredient, Menu } from "@/lib/types";

// 画面で編集する食材1行 = 機能①の出力(Ingredient) + 在庫点数(packCount)
type Row = Ingredient & { packCount: number };

// アレルギー表示の28品目（タップで選択するための一覧）
const ALLERGENS_28 = [
  "えび", "かに", "くるみ", "小麦", "そば", "卵", "乳", "落花生",
  "アーモンド", "あわび", "いか", "いくら", "オレンジ", "カシューナッツ",
  "キウイフルーツ", "牛肉", "ごま", "さけ", "さば", "大豆", "鶏肉",
  "バナナ", "豚肉", "まつたけ", "もも", "やまいも", "りんご", "ゼラチン",
];

export default function Home() {
  const [rows, setRows] = useState<Row[]>([]);
  const [analyzing, setAnalyzing] = useState(false); // 写真解析中
  const [suggesting, setSuggesting] = useState(false); // メニュー提案中
  const [menus, setMenus] = useState<Menu[]>([]); // 仮表示用
  const [error, setError] = useState<string | null>(null);
  const [publishingIndex, setPublishingIndex] = useState<number | null>(null); // 公開処理中の候補index
  const [publishedName, setPublishedName] = useState<string | null>(null); // 公開できたメニュー名

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

  // 「メニューを提案」→ 機能②（今は仮で結果を下に出すだけ）
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
      setPublishedName(menu.menuName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setPublishingIndex(null);
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#FCFAF5] text-gray-800">
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <h1 className="pt-2 text-center text-2xl font-bold text-[#3B803B]">食材を登録</h1>

      {/* カメラ/アップロード（capture でスマホは背面カメラが開く） */}
      <label className="flex cursor-pointer items-center justify-center rounded-full border-2 border-[#3B803B] bg-white px-4 py-4 font-bold text-[#3B803B] shadow-sm transition-colors hover:bg-green-50 active:bg-green-100">
        {analyzing ? "読み取り中…" : "＋ 値引き商品を撮影／選択"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhoto}
          disabled={analyzing}
        />
      </label>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {/* 登録済みの食材リスト */}
      <ul className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <li key={i} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 font-bold outline-none focus:border-[#3B803B] focus:bg-gray-50"
                value={row.productName}
                onChange={(e) => updateRow(i, { productName: e.target.value })}
              />
              <button
                className="shrink-0 rounded-lg px-2 py-1 text-sm text-red-500 hover:bg-red-50"
                onClick={() => removeRow(i)}
              >
                削除
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-1">
                価格
                <input
                  type="number"
                  className="w-20 rounded-lg border border-gray-200 px-2 py-1 outline-none focus:border-[#3B803B]"
                  value={row.discountedPrice ?? ""}
                  onChange={(e) =>
                    updateRow(i, {
                      discountedPrice: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
                円
              </label>

              {/* 在庫点数 packCount のステッパー */}
              <div className="flex items-center gap-1">
                在庫
                <button
                  className="h-7 w-7 rounded-full border border-gray-300 bg-gray-50 font-bold text-gray-600 hover:bg-gray-100"
                  onClick={() => updateRow(i, { packCount: Math.max(1, row.packCount - 1) })}
                >
                  −
                </button>
                <span className="w-8 text-center font-bold text-gray-700">{row.packCount}</span>
                <button
                  className="h-7 w-7 rounded-full border border-gray-300 bg-gray-50 font-bold text-gray-600 hover:bg-gray-100"
                  onClick={() => updateRow(i, { packCount: row.packCount + 1 })}
                >
                  ＋
                </button>
              </div>
            </div>

            {/* アレルギー（タップで選択／解除） */}
            <div className="mt-2">
              <p className="text-xs text-zinc-500">アレルギー（タップで選択）</p>
              <div className="mt-1 flex flex-wrap gap-1">
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
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        on ? "bg-[#3B803B] text-white" : "bg-zinc-100 text-zinc-600"
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

      {/* メニュー提案ボタン（食材0件のときは押せない） */}
      <button
        className="rounded-full bg-[#428542] px-4 py-4 text-lg font-bold text-white shadow-lg transition-colors hover:bg-[#326b32] disabled:opacity-40"
        disabled={rows.length === 0 || suggesting}
        onClick={suggest}
      >
        {suggesting ? "提案中…" : "メニューを提案する"}
      </button>

      {/* ▼ 仮の結果表示（次回ちゃんとした結果画面に置き換える） */}
      {menus.length > 0 && (
        <ul className="mt-2 flex flex-col gap-4 border-t pt-4">
          {menus.map((m, i) => (
            <li key={i} className="rounded-2xl border border-gray-100 bg-white p-5 text-sm shadow-md">
              {/* 料理名と価格 */}
              <div className="flex items-baseline justify-between gap-2">
                <b className="text-lg text-gray-800">{m.menuName}</b>
                <span className="shrink-0 font-bold text-orange-600">{m.price}円</span>
              </div>

              {/* 食数・調理時間・内訳 */}
              <p className="mt-1 text-xs text-zinc-500">
                残り{m.servings}食 / 調理{m.totalCookingMinutes}分（下ごしらえ{m.prepMinutes}分＋1食{m.cookMinutesPerServing}分）
              </p>
              <p className="text-xs text-zinc-500">
                材料費{m.ingredientCost}円・人件費{m.laborCost}円・利益{m.profit}円
              </p>

              {/* アレルギー */}
              <p className="mt-2 text-xs">
                <span className="text-zinc-500">アレルギー：</span>
                {m.allergens.length > 0 ? m.allergens.join("・") : "なし"}
              </p>

              {/* 使う食材 */}
              <p className="text-xs">
                <span className="text-zinc-500">使う食材：</span>
                {m.ingredients.map((ing) => ing.name).join("・")}
              </p>

              {/* レシピ */}
              <div className="mt-2">
                <p className="text-xs text-zinc-500">作り方</p>
                <ol className="mt-1 list-decimal pl-5 text-xs leading-relaxed">
                  {m.recipe.map((step, j) => (
                    <li key={j}>{step}</li>
                  ))}
                </ol>
              </div>

              {/* このメニューに決定 → 客側画面に公開（公開後はボタンを消す） */}
              {!publishedName && (
                <button
                  className="mt-4 w-full rounded-full bg-[#428542] px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#326b32] disabled:opacity-40"
                  disabled={publishingIndex !== null}
                  onClick={() => publish(m, i)}
                >
                  {publishingIndex === i ? "公開中…（画像を生成しています）" : "このメニューに決定して公開"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 公開後の状態：通知＋「公開メニューを変更」ボタン（押すと選び直せる） */}
      {publishedName && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#3B803B]/30 bg-green-50 p-4 shadow-sm">
          <p className="text-sm font-bold text-[#3B803B]">
            「{publishedName}」を客側画面に公開しました。
          </p>
          <button
            className="w-full rounded-full border-2 border-[#3B803B] bg-white px-4 py-3 text-sm font-bold text-[#3B803B] transition-colors hover:bg-green-50"
            onClick={() => setPublishedName(null)}
          >
            公開メニューを変更
          </button>
        </div>
      )}
    </main>
    </div>
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
