"use client";

import { useState, useRef } from "react";

interface Ingredient {
  id: number;
  name: string;
  count: number;
  unit: string;
  image: string;
  pricePerOne: number;
}

// AIから返ってくるメニューデータの型定義
interface SuggestedMenu {
  menuName: string;
  ingredients: { name: string; usageRatio: number }[];
  recipe: string[];
  allergens: string[];
  prepMinutes: number;
  cookMinutesPerServing: number;
  price?: number; // API側で計算されて付く想定の価格
}

export default function StorePage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isManualInputOpen, setIsManualInputOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  
  // 💡 AI通信中（ローディング）の状態管理
  const [isLoading, setIsLoading] = useState(false);
  // 💡 AIから返ってきたメニューを保存する状態管理
  const [suggestedMenus, setSuggestedMenus] = useState<SuggestedMenu[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const incrementCount = (id: number) => {
    setIngredients(ingredients.map(item => item.id === id ? { ...item, count: item.count < 10 ? item.count + 1 : item.count } : item));
  };

  const decrementCount = (id: number) => {
    setIngredients(ingredients.map(item => item.id === id ? { ...item, count: item.count > 1 ? item.count - 1 : item.count } : item));
  };

  const editIngredientName = (id: number, newName: string) => {
    setIngredients(ingredients.map(item => item.id === id ? { ...item, name: newName } : item));
  };

  const deleteIngredient = (id: number) => {
    setIngredients(ingredients.filter(item => item.id !== id));
  };

  const handleCameraClick = () => {
    setIsMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const testItems = [
        { name: "トマト", unit: "個", image: "🍅" },
        { name: "たまねぎ", unit: "個", image: "🧅" },
        { name: "にんじん", unit: "本", image: "🥕" },
      ];
      const nextItem = testItems[ingredients.length % testItems.length];
      setIngredients([...ingredients, { id: Date.now(), name: nextItem.name, count: 1, unit: nextItem.unit, image: nextItem.image, pricePerOne: 100 }]);
    }
  };

  const addManually = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    setIngredients([...ingredients, { id: Date.now(), name: manualName, count: 1, unit: "個", image: "📦", pricePerOne: 100 }]);
    setManualName("");
    setIsManualInputOpen(false);
  };

  // 💡 【重要】「メニューを作成」ボタンを押したときにAI(route.ts)を呼び出す関数
  const handleCreateMenu = async () => {
    if (ingredients.length === 0) {
      alert("食材を1つ以上登録してください！");
      return;
    }

    setIsLoading(true); // ぐるぐる画面スタート

    try {
      // prompt-menu.md の指定項目（productName, discountedPriceなど）に合わせてデータを整形
      const formattedIngredients = ingredients.map(item => ({
        productName: item.name,
        discountedPrice: item.pricePerOne * item.count, // 簡易的に現在の総原価を渡す
        unit: `${item.count}${item.unit}`,
        quantity: item.count,
        packCount: 1 // デモ用に在庫数は1に固定
      }));

      // 裏側のAIプログラム（/api/suggest-menu）におねだり通信
      const response = await fetch("/api/suggest-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: formattedIngredients }),
      });

      if (!response.ok) throw new Error("APIエラーが発生しました");

      const data = await response.json();
      setSuggestedMenus(data.menus || data); // 返ってきたメニューデータを画面に保存

    } catch (error) {
      console.error(error);
      alert("メニューの作成に失敗しました。APIキーやroute.tsの設定を確認してください。");
    } finally {
      setIsLoading(false); // ぐるぐる画面終了
    }
  };

  // -------------------------------------------------------------
  // 🔄 画面パターン①: AIが考えている最中の「ローディング画面」
  // -------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FCFAF5] flex flex-col items-center justify-center font-sans p-6">
        <div className="w-16 h-16 border-4 border-[#3B803B] border-t-transparent rounded-full animate-spin"></div>
        <h2 className="mt-8 text-xl font-bold text-gray-700 animate-pulse">平和堂のAIシェフが思考中...</h2>
        <p className="mt-2 text-sm text-gray-500 text-center">
          登録された食材から、<br />大学生向けの最適メニューを考案しています。
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 🍳 画面パターン②: AIからメニューが返ってきたあとの「結果画面」
  // -------------------------------------------------------------
  if (suggestedMenus) {
    return (
      <div className="min-h-screen bg-[#FCFAF5] flex flex-col items-center pb-32 font-sans text-gray-800 p-4">
        <h1 className="mt-12 text-2xl font-bold text-center text-[#3B803B]">✨ AIおすすめメニュー ✨</h1>
        <p className="mt-2 text-sm text-gray-600 text-center mb-8">お好みの惣菜開発メニューを選んでください</p>

        <div className="w-full max-w-md flex flex-col gap-6">
          {suggestedMenus.map((menu, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
              {/* メニュー名 */}
              <div className="flex items-center justify-between mb-4">
                <span className="bg-[#F2F6E8] text-[#3B803B] text-xs font-bold px-3 py-1 rounded-full">候補 {index + 1}</span>
                <span className="text-sm font-bold text-gray-500">⏰ {menu.prepMinutes + (menu.cookMinutesPerServing || 0)}分</span>
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-3">{menu.menuName}</h2>
              
              {/* 想定価格（route.tsで計算されていれば表示、なければ仮表示） */}
              <div className="text-lg font-bold text-orange-600 mb-4">
                想定提供価格: {menu.price ? `${menu.price}円` : "計算中"}
              </div>

              {/* 使用する食材リスト */}
              <div className="mb-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">使用する食材</h3>
                <div className="flex flex-wrap gap-2">
                  {menu.ingredients.map((ing, i) => (
                    <span key={i} className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-md font-medium">
                      {ing.name} (量: {ing.usageRatio * 100}%)
                    </span>
                  ))}
                </div>
              </div>

              {/* レシピ手順 */}
              <div className="mb-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">調理工程</h3>
                <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                  {menu.recipe.map((step, i) => (
                    <li key={i} className="leading-relaxed">{step}</li>
                  ))}
                </ol>
              </div>

              {/* アレルゲン */}
              {menu.allergens && menu.allergens.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">⚠️ アレルゲン（28品目中）</h3>
                  <div className="flex flex-wrap gap-1">
                    {menu.allergens.map((all, i) => (
                      <span key={i} className="bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded font-bold">
                        {all}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 戻るボタン */}
        <div className="fixed bottom-8 w-full flex justify-center px-4">
          <button 
            onClick={() => setSuggestedMenus(null)}
            className="w-full max-w-md bg-gray-700 text-white py-4 rounded-full font-bold text-lg shadow-lg hover:bg-gray-800 transition-colors"
          >
            食材一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 🏠 画面パターン③: いつもの「食材一覧画面」（初期状態）
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FCFAF5] flex flex-col items-center pb-32 font-sans text-gray-800 relative">
      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

      {/* --- ヘッダー部分 --- */}
      <h1 className="mt-16 text-2xl font-bold">食材一覧</h1>
      <p className="mt-4 text-sm text-gray-600 text-center leading-relaxed">
        写真から食材を読み取り、<br />一覧に追加できます
      </p>

      {/* --- 食材を追加ボタン --- */}
      <button 
        onClick={() => setIsMenuOpen(true)}
        className="mt-8 w-11/12 max-w-md border-2 border-[#3B803B] text-[#3B803B] bg-white rounded-full py-4 flex items-center justify-center font-bold shadow-sm hover:bg-green-50 active:bg-green-100 transition-colors"
      >
        <span className="text-xl text-green-700">＋ 食材を追加</span>
      </button>

      {/* --- 登録済みの食材リスト --- */}
      <div className="w-11/12 max-w-md mt-12">
        <h2 className="text-md mb-4 text-gray-700">登録済みの食材</h2>

        {ingredients.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="grid grid-cols-[1.2fr_1fr_0.6fr_0.4fr] bg-[#F2F6E8] py-3 px-2 text-sm font-medium text-gray-700">
              <div className="text-center pl-6">食材名（タップで編集）</div>
              <div className="text-center">数量</div>
              <div className="text-center">原価</div>
              <div className="text-center"></div>
            </div>

            <div className="divide-y divide-gray-100">
              {ingredients.map((item) => (
                <div key={item.id} className="grid grid-cols-[1.2fr_1fr_0.6fr_0.4fr] items-center py-4 px-2">
                  <div className="flex items-center gap-2 pl-1">
                    <div className="w-9 h-9 bg-orange-50 border border-gray-100 rounded-lg flex items-center justify-center text-xl shadow-sm overflow-hidden flex-shrink-0">{item.image}</div>
                    <input type="text" value={item.name} onChange={(e) => editIngredientName(item.id, e.target.value)} className="font-bold text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#3B803B] focus:bg-gray-50 px-1 py-0.5 rounded w-full outline-none" />
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => decrementCount(item.id)} className="w-6 h-6 rounded-full border border-gray-300 bg-gray-50 flex items-center justify-center font-bold text-xs text-gray-600 hover:bg-gray-100">ー</button>
                    <span className="w-8 text-center text-sm font-bold text-gray-700">{item.count}{item.unit}</span>
                    <button onClick={() => incrementCount(item.id)} className="w-6 h-6 rounded-full border border-gray-300 bg-gray-50 flex items-center justify-center font-bold text-xs text-gray-600 hover:bg-gray-100">＋</button>
                  </div>
                  <div className="text-center font-bold text-sm text-orange-600">{item.count * item.pricePerOne}円</div>
                  <div className="flex items-center justify-center">
                    <button onClick={() => deleteIngredient(item.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-base text-red-500 hover:bg-red-50">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-white text-gray-400 font-medium">登録された食材はありません</div>
        )}
      </div>

      {/* ポップアップメニュー等（省略せず完全な形で維持） */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-center mb-6">食材の追加方法を選択</h3>
            <div className="flex flex-col gap-3">
              <button onClick={handleCameraClick} className="bg-[#428542] text-white py-4 rounded-xl font-bold hover:bg-[#326b32] transition-colors shadow-md">📸 カメラで撮影する</button>
              <button onClick={() => { setIsMenuOpen(false); setIsManualInputOpen(true); }} className="bg-white border-2 border-gray-200 text-gray-700 py-4 rounded-xl font-bold hover:bg-gray-50">✍️ 手動で入力する</button>
              <button onClick={() => setIsMenuOpen(false)} className="text-gray-400 font-medium mt-2">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {isManualInputOpen && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={addManually} className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-center mb-4">食材の手動入力</h3>
            <input type="text" placeholder="例: キャベツ、豚肉 など" value={manualName} onChange={(e) => setManualName(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-[#3B803B] outline-none mb-6 font-bold" autoFocus />
            <div className="flex gap-3">
              <button type="button" onClick={() => setIsManualInputOpen(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold">戻る</button>
              <button type="submit" className="flex-1 bg-[#428542] text-white py-3 rounded-xl font-bold shadow-md">登録する</button>
            </div>
          </form>
        </div>
      )}

      {/* 背景イラスト */}
      <div className="fixed bottom-0 w-full h-40 bg-gray-200 opacity-50 z-0 flex items-center justify-center pointer-events-none">
        <span className="text-gray-500 font-bold">平和堂の背景イラスト</span>
      </div>

      {/* --- メニューを作成ボタン（API関数を呼び出すように変更） --- */}
      <div className="fixed bottom-8 w-full flex justify-center z-10 px-4">
        <button 
          onClick={handleCreateMenu}
          className="w-full max-w-md bg-[#428542] text-white py-4 rounded-full font-bold text-lg shadow-lg hover:bg-[#326b32] transition-colors"
        >
          メニューを作成
        </button>
      </div>

    </div>
  );
}