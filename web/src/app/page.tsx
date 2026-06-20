"use client";

import { useState, useRef } from "react";

// API側（route.ts）の戻り値と完全に一致させた型定義
export interface Ingredient {
  id: string;
  productName: string;
  discountedPrice: number | null;
  unit: string;
  quantity: number;
  allergens: string[];
}

// 機能②（suggest-menu）のAPI仕様に合わせた正しいメニュー型定義
export interface Menu {
  menuName: string;
  ingredients: { name: string; usageRatio: number }[];
  recipe: string[];
  allergens: string[];
  prepMinutes: number;
  cookMinutesPerServing: number;
  price: number;
}

type Row = Ingredient & { packCount: number };

// 💡 画面を切り替えるための型
type ScreenState = "list" | "menu-result";

const ALLERGENS_28 = [
  "えび", "かに", "くるみ", "小麦", "そば", "卵", "乳", "落花生",
  "アーモンド", "あわび", "いか", "いくら", "オレンジ", "カシューナッツ",
  "キウイフルーツ", "牛肉", "ごま", "さけ", "さば", "大豆", "鶏肉",
  "バナナ", "豚肉", "まつたけ", "もも", "やまいも", "りんご", "ゼラチン",
];

export default function Home() {
  const [rows, setRows] = useState<Row[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // 💡 現在どちらの画面を表示しているかを管理する状態 ("list" = 食材一覧, "menu-result" = メニュー提案画面)
  const [screen, setScreen] = useState<ScreenState>("list");

  // 🌟 追加状態: 提案メニューの中で選択されているインデックス（未選択はnull）
  const [selectedMenuIndex, setSelectedMenuIndex] = useState<number | null>(null);
  
  // 🌟 追加状態: 確定した「本日のメニュー」のデータ
  const [todayMenu, setTodayMenu] = useState<Menu | null>(null);

  // 🌟 追加状態: 過去に確定したメニューの履歴リスト
  const [history, setHistory] = useState<Menu[]>([]);
  
  // 🌟 追加状態: 履歴ポップアップ（モーダル）の開閉管理
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // カメラ用のインプット
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ① 写真解析の処理
  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じ画像を連続で選んでも反応するようにリセット
    if (!file) return;

    // 写真選択直後にポップアップを閉じます
    setIsMenuOpen(false);
    setAnalyzing(true);
    setError(null);
    try {
      const { base64, mimeType } = await resizeAndCompressImage(file, 1024, 1024, 0.7);
      
      const res = await fetch("/api/extract-ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      
      if (!res.ok) {
        throw new Error("APIキーが未反映か、解析に失敗しました。この後に行う再デプロイが成功すれば解消します。");
      }
      
      const data = await res.json();
      
      setRows((prev) => [
        ...prev, 
        { 
          id: `ing-${Date.now()}`,
          productName: data.productName || "不明な食材",
          discountedPrice: data.discountedPrice || 100,
          unit: data.unit || "個",
          quantity: data.quantity || 1,
          allergens: data.allergens || [], 
          packCount: data.quantity || 1 
        }
      ]);
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

  // ② メニュー提案の処理（移動＆APIリクエスト）
  async function suggest() {
    // 💡 処理開始と同時に、メニュー提案結果画面（読み込み状態）へ移動させます！
    setScreen("menu-result");
    setSelectedMenuIndex(null); // 選択状態をリセット
    setSuggesting(true);
    setError(null);
    try {
      const ingredients = rows.map((r) => ({
        productName: r.productName,
        discountedPrice: r.discountedPrice,
        unit: r.unit,
        quantity: r.quantity,
        packCount: r.packCount,
        allergens: r.allergens || [],
      }));

      const res = await fetch("/api/suggest-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients }),
      });
      
      if (!res.ok) throw new Error("メニュー提案に失敗しました");
      const data = await res.json();
      
      if (data && Array.isArray(data.menus)) {
        setMenus(data.menus);
      } else if (Array.isArray(data)) {
        setMenus(data);
      } else {
        throw new Error("返却されたデータの形式が不正です");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      // エラーが起きた場合は、食材一覧に戻す
      setScreen("list");
    } finally {
      setSuggesting(false);
    }
  }

  // 🌟 追加処理: 選択したメニューを「本日のメニュー」に確定する処理
  function handleConfirmMenu() {
    if (selectedMenuIndex === null) return;
    const selected = menus[selectedMenuIndex];
    
    // 1. 本日のメニューにセット
    setTodayMenu(selected);
    // 2. 履歴に追加
    setHistory((prev) => [selected, ...prev]);
    // 3. 食材リストを綺麗に消去する
    setRows([]);
    // 4. 食材一覧画面に戻る
    setScreen("list");
  }

  function getEmoji(name: string) {
    if (name.includes("トマト")) return "🍅";
    if (name.includes("たまねぎ") || name.includes("玉ねぎ")) return "🧅";
    if (name.includes("にんじん") || name.includes("人参")) return "🥕";
    if (name.includes("肉")) return "🥩";
    if (name.includes("キャベツ")) return "🥬";
    if (name.includes("卵") || name.includes("たまご")) return "🥚";
    if (name.includes("豆腐")) return "⬜";
    return "📦";
  }

  return (
    <div className="fixed inset-0 bg-[#FCFAF5] flex flex-col items-center font-sans text-gray-800 overflow-hidden">
      {/* カメラ起動用 */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        className="hidden"
        onChange={handlePhoto}
        disabled={analyzing}
      />

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
        .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      {/* 背景のドット模様 */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(#000_1px,transparent_1px),linear-gradient(90deg,#000_1px,transparent_1px)] bg-[size:20px_20px]"></div>

      {/* 🌟 画面右上固定の登録履歴確認ボタン */}
      <button 
        onClick={() => setIsHistoryOpen(true)}
        className="absolute top-4 right-4 w-10 h-10 bg-white border border-gray-200 shadow-xs rounded-full flex items-center justify-center text-xl z-40 hover:bg-gray-50 active:scale-95 transition-all"
        title="登録履歴"
      >
        📋
      </button>

      {/* カメラ写真のAI解析中ぐるぐる */}
      {analyzing && (
        <div className="fixed inset-0 bg-[#FCFAF5] flex flex-col items-center justify-center p-6 z-50 overflow-hidden animate-fade-in">
          <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <h2 className="mt-8 text-xl font-bold text-gray-700 animate-pulse">写真をAIで解析中...</h2>
          <p className="mt-2 text-sm text-gray-500 text-center leading-relaxed">
            少し時間がかかる場合があります。<br />このまま少々お待ちください。
          </p>
        </div>
      )}

      {/* ==================== 1. 食材一覧画面 ==================== */}
      {screen === "list" && (
        <>
          <div className="w-full flex flex-col items-center pt-12 flex-shrink-0 z-10">
            <h1 className="text-2xl font-bold text-gray-800 tracking-wider">食材一覧</h1>
            <p className="mt-2 text-sm text-gray-600 text-center leading-relaxed">
              写真や手動入力から食材を読み取り、<br />一覧に追加できます
            </p>

            <button
              onClick={() => setIsMenuOpen(true)}
              className="mt-6 w-11/12 max-w-md border-2 border-teal-600 text-teal-700 bg-white rounded-full py-4 flex items-center justify-center font-bold shadow-sm hover:bg-teal-50 active:bg-teal-100 transition-colors"
            >
              <span className="text-xl">＋ 食材を追加</span>
            </button>

            {/* 🌟 確定した「本日のメニュー」の表示エリア */}
            {todayMenu && (
              <div className="w-11/12 max-w-md mt-5 p-5 bg-white border border-emerald-100 rounded-2xl shadow-xs animate-slide-up">
                <div className="flex items-center justify-between mb-2 border-b border-gray-100 pb-2">
                  <span className="text-sm font-bold text-emerald-700 flex items-center gap-1">
                    🍳 本日の確定メニュー
                  </span>
                  <span className="text-xs text-gray-400">
                    ⏱️ 調理: {(todayMenu.prepMinutes || 0) + (todayMenu.cookMinutesPerServing || 0)}分
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">{todayMenu.menuName}</h3>
                <p className="text-sm font-bold text-orange-600 mb-3">想定価格: {todayMenu.price ? `${todayMenu.price}円` : "ー"}</p>
                
                <div className="mb-3">
                  <p className="text-xs font-bold text-gray-500 mb-1">👩‍🍳 作り方の手順</p>
                  <ol className="text-xs text-gray-600 list-decimal pl-4 space-y-1">
                    {todayMenu.recipe && todayMenu.recipe.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>

                {todayMenu.allergens && todayMenu.allergens.length > 0 && (
                  <div className="flex flex-wrap gap-1 border-t border-gray-50 pt-2">
                    {todayMenu.allergens.map((a, idx) => (
                      <span key={idx} className="bg-red-50 text-red-600 text-[9px] px-1.5 py-0.5 rounded-full font-medium">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="w-11/12 max-w-md mt-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium z-10">
              ⚠️ {error}
            </div>
          )}

          <div className="w-11/12 max-w-md mt-6 mb-32 flex-1 overflow-y-auto pb-4 pr-1 z-10">
            <h2 className="text-md mb-3 text-gray-700 font-bold sticky top-0 bg-[#FCFAF5] py-1 z-10 border-b border-gray-200/40">
              登録済みの食材
            </h2>

            {rows.length > 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm mb-6">
                <div className="grid grid-cols-[1.2fr_1fr_0.6fr_0.4fr] bg-[#F2F6E8] py-3 px-2 text-sm font-medium text-gray-700 sticky top-0 z-10">
                  <div className="text-center pl-6">食材名</div>
                  <div className="text-center">数量</div>
                  <div className="text-center">価格</div>
                  <div className="text-center"></div>
                </div>

                <div className="divide-y divide-gray-100">
                  {rows.map((row, i) => (
                    <div key={i} className="flex flex-col p-2 animate-fade-in">
                      <div className="grid grid-cols-[1.2fr_1fr_0.6fr_0.4fr] items-center py-2">
                        <div className="flex items-center gap-2 pl-1">
                          <div className="w-9 h-9 bg-orange-50 border border-gray-100 rounded-lg flex items-center justify-center text-xl shadow-sm overflow-hidden flex-shrink-0">
                            {getEmoji(row.productName || "")}
                          </div>
                          <input
                            type="text"
                            value={row.productName || ""}
                            onChange={(e) => updateRow(i, { productName: e.target.value })}
                            className="font-bold text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-teal-600 focus:bg-gray-50 px-1 py-0.5 rounded w-full outline-none transition-all"
                          />
                        </div>

                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => updateRow(i, { packCount: Math.max(1, row.packCount - 1) })}
                            className="w-6 h-6 rounded-full border border-gray-300 bg-gray-50 flex items-center justify-center font-bold text-xs text-gray-600 hover:bg-gray-100"
                          >
                            ー
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-gray-700">
                            {row.packCount}{row.unit || "個"}
                          </span>
                          <button
                            onClick={() => updateRow(i, { packCount: row.packCount + 1 })}
                            className="w-6 h-6 rounded-full border border-gray-300 bg-gray-50 flex items-center justify-center font-bold text-xs text-gray-600 hover:bg-gray-100"
                          >
                            ＋
                          </button>
                        </div>

                        <div className="flex items-center justify-center font-bold text-sm text-orange-600 gap-0.5">
                          <input
                            type="number"
                            className="w-12 text-right bg-transparent border-b border-dashed border-gray-300 focus:border-orange-500 outline-none pr-0.5 font-bold"
                            value={row.discountedPrice ?? ""}
                            onChange={(e) =>
                              updateRow(i, {
                                discountedPrice: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                          />
                          <span>円</span>
                        </div>

                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => removeRow(i)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-base text-red-500 hover:bg-red-50 transition-colors"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div className="mt-1 px-2 pb-2 pt-1 border-t border-gray-50">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          アレルギー（タップして選択）
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1 max-h-16 overflow-y-auto p-1 bg-gray-50/50 rounded-lg">
                          {ALLERGENS_28.map((a) => {
                            const on = (row.allergens || []).includes(a);
                            return (
                              <button
                                key={a}
                                onClick={() =>
                                  updateRow(i, {
                                    allergens: on
                                      ? (row.allergens || []).filter((x) => x !== a)
                                      : [...(row.allergens || []), a],
                                  })
                                }
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${
                                  on
                                    ? "bg-teal-600 text-white shadow-xs"
                                    : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-100"
                                }`}
                              >
                                {a}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-white text-gray-400 font-medium mb-6">
                登録された食材はありません
              </div>
            )}
          </div>

          <div className="fixed bottom-8 w-full flex justify-center z-30 px-4">
            <button
              onClick={suggest}
              disabled={rows.length === 0 || analyzing}
              className="w-full max-w-md bg-teal-600 text-white py-4 rounded-full font-bold text-lg shadow-lg hover:bg-teal-700 disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-[0.99]"
            >
              メニューを作成
            </button>
          </div>
        </>
      )}

      {/* ==================== 2. メニュー提案・結果画面 ==================== */}
      {screen === "menu-result" && (
        <div className="w-full h-full flex flex-col items-center p-4 overflow-hidden z-10">
          
          {/* AIが思考中のローディング画面 */}
          {suggesting ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-4 border-teal-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h2 className="mt-8 text-xl font-bold text-gray-700 animate-pulse">平和堂のAIシェフが思考中...</h2>
              <p className="mt-3 text-sm text-gray-500 text-center leading-relaxed">
                登録された食材と価格をもとに、<br />
                最適なおすすめメニューを3つ作成しています。
              </p>
            </div>
          ) : (
            // AIのメニュー提案結果画面
            <>
              <div className="w-full flex flex-col items-center pt-8 flex-shrink-0">
                <h1 className="text-2xl font-bold text-teal-800 tracking-wider">✨ AIおすすめメニュー ✨</h1>
                <p className="mt-1 text-xs text-gray-500">使いたいメニューを1つタップして選んでください</p>
              </div>

              <div className="w-11/12 max-w-md mt-4 mb-36 flex-1 overflow-y-auto pb-4 pr-1">
                <div className="flex flex-col gap-4">
                  {menus.map((m, i) => {
                    const isSelected = selectedMenuIndex === i;
                    return (
                      <div 
                        key={i} 
                        onClick={() => setSelectedMenuIndex(i)}
                        className={`bg-white rounded-2xl p-5 shadow-sm border-2 cursor-pointer transition-all duration-200 animate-slide-up ${
                          isSelected 
                            ? "border-teal-600 ring-4 ring-teal-600/10 scale-[1.01]" 
                            : "border-gray-100 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                            isSelected ? "bg-teal-600 text-white" : "bg-[#F2F6E8] text-teal-700"
                          }`}>
                            {isSelected ? "選択中" : `提案メニュー ${i + 1}`}
                          </span>
                          <span className="text-xs font-bold text-gray-500">
                            ⏰ 準備: {m.prepMinutes || 0}分 / 調理: {m.cookMinutesPerServing || 0}分
                          </span>
                        </div>
                        <h2 className="text-lg font-bold text-gray-800 mb-1">{m.menuName}</h2>
                        <div className="text-md font-bold text-orange-600 mb-3">
                          想定価格: {m.price ? `${m.price}円` : "計算中"}
                        </div>
                        
                        <div className="mb-3 bg-gray-50/50 p-2.5 rounded-xl border border-gray-100">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">使用する食材比率</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {m.ingredients && m.ingredients.map((ing, idx) => (
                              <span key={idx} className="text-xs font-medium text-gray-600">
                                ・{ing.name} ({(ing.usageRatio * 100).toFixed(0)}%)
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="mb-2">
                          <p className="text-xs font-bold text-teal-700 uppercase tracking-wider mb-1">👨‍🍳 作り方手順</p>
                          <ol className="text-xs text-gray-600 list-decimal pl-4 space-y-1.5 leading-relaxed">
                            {m.recipe && m.recipe.map((step, idx) => (
                              <li key={idx} className="pl-0.5">{step}</li>
                            ))}
                          </ol>
                        </div>

                        {m.allergens && m.allergens.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-gray-100">
                            <p className="text-[10px] font-bold text-red-400 tracking-wider">⚠️ 含まれるアレルゲン</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {m.allergens.map((a, idx) => (
                                <span key={idx} className="bg-red-50 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-medium">
                                  {a}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 🌟 画面下部の操作用ボタンコンテナ */}
              <div className="fixed bottom-6 w-full max-w-md flex flex-col gap-2 z-30 px-4">
                <button
                  onClick={handleConfirmMenu}
                  disabled={selectedMenuIndex === null}
                  className="w-full bg-teal-600 text-white py-3.5 rounded-full font-bold text-md shadow-lg hover:bg-teal-700 disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-[0.99] text-center"
                >
                  このメニューにする 🍳
                </button>
                <button
                  onClick={() => setScreen("list")}
                  className="w-full bg-white border border-gray-300 text-gray-600 py-2 rounded-full font-bold text-xs shadow-xs hover:bg-gray-50 transition-all text-center"
                >
                  ⬅ 食材一覧に戻る
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 食材追加ポップアップモーダル */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-end justify-center z-50 p-4 animate-fade-in"
          onClick={() => setIsMenuOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-t-3xl rounded-b-xl p-6 shadow-2xl border border-gray-100 animate-slide-up mb-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-5"></div>
            
            <h3 className="text-lg font-bold text-center mb-6 text-gray-800 tracking-wide">食材の追加方法を選択</h3>
            <div className="flex flex-col gap-3.5">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="bg-teal-600 text-white py-4 rounded-xl font-bold text-center cursor-pointer hover:bg-teal-700 transition-all shadow-md block text-md active:scale-[0.98]"
              >
                📸 カメラを起動して撮影
              </button>

              <button
                onClick={() => {
                  setRows((prev) => [
                    ...prev,
                    {
                      id: `ing-${Date.now()}`,
                      productName: "新しい食材",
                      discountedPrice: 100,
                      unit: "個",
                      quantity: 1,
                      packCount: 1,
                      allergens: [],
                    }
                  ]);
                  setIsMenuOpen(false);
                }}
                className="bg-white border-2 border-gray-200 text-gray-700 py-4 rounded-xl font-bold hover:bg-gray-50 transition-all text-md active:scale-[0.98]"
              >
                ✍️ 手動で枠を追加する
              </button>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="text-gray-400 font-medium mt-3 hover:text-gray-600 transition-colors text-sm text-center w-full"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 登録履歴ポップアップモーダル */}
      {isHistoryOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setIsHistoryOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-md max-h-[80vh] rounded-2xl p-6 shadow-2xl flex flex-col overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-lg font-bold text-gray-800">📋 これまでのメニュー履歴</h3>
              <button 
                onClick={() => setIsHistoryOpen(false)} 
                className="text-gray-400 hover:text-gray-600 font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {history.length > 0 ? (
                history.map((h, idx) => (
                  <div key={idx} className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/60">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md font-bold">
                        履歴 #{history.length - idx}
                      </span>
                      <span className="text-xs text-gray-400">⏱️ {h.cookMinutesPerServing}分</span>
                    </div>
                    <h4 className="font-bold text-sm text-gray-800 mb-1">{h.menuName}</h4>
                    <p className="text-xs font-bold text-orange-600 mb-2">{h.price}円</p>
                    <div className="text-[11px] text-gray-500 line-clamp-2">
                      {h.recipe && h.recipe.join(" → ")}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-400 text-sm font-medium">
                  確定されたメニュー履歴はまだありません
                </div>
              )}
            </div>

            <button
              onClick={() => setIsHistoryOpen(false)}
              className="mt-4 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-bold text-sm transition-colors text-center"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function resizeAndCompressImage(file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.7): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context error"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const cleanBase64 = dataUrl.split(",")[1];
        
        resolve({ base64: cleanBase64, mimeType: "image/jpeg" });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}