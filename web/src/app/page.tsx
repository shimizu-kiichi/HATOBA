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

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">食材を登録</h1>

      {/* カメラ/アップロード（capture でスマホは背面カメラが開く） */}
      <label className="flex cursor-pointer items-center justify-center rounded-xl bg-teal-600 px-4 py-3 font-semibold text-white">
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* 登録済みの食材リスト */}
      <ul className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <li key={i} className="rounded-xl border border-zinc-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <input
                className="min-w-0 flex-1 rounded border px-2 py-1 font-medium"
                value={row.productName}
                onChange={(e) => updateRow(i, { productName: e.target.value })}
              />
              <button
                className="shrink-0 text-sm text-red-500"
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
                  className="w-20 rounded border px-2 py-1"
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
                  className="h-7 w-7 rounded border"
                  onClick={() => updateRow(i, { packCount: Math.max(1, row.packCount - 1) })}
                >
                  −
                </button>
                <span className="w-6 text-center">{row.packCount}</span>
                <button
                  className="h-7 w-7 rounded border"
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
                        on ? "bg-teal-600 text-white" : "bg-zinc-100 text-zinc-600"
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
        className="rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-40"
        disabled={rows.length === 0 || suggesting}
        onClick={suggest}
      >
        {suggesting ? "提案中…" : "メニューを提案する"}
      </button>

      {/* ▼ 仮の結果表示（次回ちゃんとした結果画面に置き換える） */}
      {menus.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2 border-t pt-2">
          {menus.map((m, i) => (
            <li key={i} className="rounded border p-2 text-sm">
              <b>{m.menuName}</b> — {m.price}円 / 残り{m.servings}食 / {m.totalCookingMinutes}分
            </li>
          ))}
        </ul>
      )}
    </main>
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
