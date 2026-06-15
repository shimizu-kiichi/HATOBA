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

interface SuggestedMenu {
  menuName: string;
  ingredients: { name: string; usageRatio: number }[];
  recipe: string[];
  allergens: string[];
  prepMinutes: number;
  cookMinutesPerServing: number;
  price?: number;
}

export default function StorePage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isManualInputOpen, setIsManualInputOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
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

  const handlePhotoClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsMenuOpen(false); 
    const file = e.target.files[0];

    setLoadingText("写真をAIで解析中...");
    setIsLoading(true);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const justData = base64String.split(",")[1];
          resolve(justData);
        };
      });
      reader.readAsDataURL(file);
      const imageBase64 = await base64Promise;

      const response = await fetch("/api/extract-ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imageBase64,
          mimeType: file.type
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || "画像解析に失敗しました");
      }
      
      const productName = data.productName || "不明な食材";
      const quantity = data.quantity || 1;
      const unit = data.unit || "個";
      const finalPrice = data.discountedPrice || 100;

      let emoji = "📦";
      if (productName.includes("トマト")) emoji = "🍅";
      else if (productName.includes("たまねぎ") || productName.includes("玉ねぎ")) emoji = "🧅";
      else if (productName.includes("にんじん") || productName.includes("人参")) emoji = "🥕";
      else if (productName.includes("肉")) emoji = "🥩";
      else if (productName.includes("キャベツ")) emoji = "🥬";

      setIngredients(prev => [
        ...prev,
        {
          id: Date.now(),
          name: productName,
          count: quantity,
          unit: unit,
          image: emoji,
          pricePerOne: Math.round(finalPrice / quantity)
        }
      ]);

    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "AIの食材認識でエラーが起きました。");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addManually = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    setIngredients([...ingredients, { id: Date.now(), name: manualName, count: 1, unit: "個", image: "✍️", pricePerOne: 100 }]);
    setManualName("");
    setIsManualInputOpen(false);
  };

  // 💡 最も安全にデータを整えてAIに送信する処理
  const handleCreateMenu = async () => {
    if (ingredients.length === 0) {
      alert("食材を1つ以上登録してください！");
      return;
    }

    setLoadingText("平和堂のAIシェフが思考中...");
    setIsLoading(true);

    try {
      // 念のため不完全なデータが入らないようにお掃除して変換
      const formattedIngredients = ingredients.map(item => ({
        productName: item.name || "不明な食材",
        discountedPrice: (item.pricePerOne || 100) * (item.count || 1),
        unit: `${item.count || 1}${item.unit || "個"}`,
        quantity: item.count || 1,
        packCount: 1
      }));

      const response = await fetch("/api/suggest-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: formattedIngredients }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || "メニューの作成に失敗しました");
      }

      setSuggestedMenus(data.menus || data);

    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "メニューの作成に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#FCFAF5] flex flex-col items-center justify-center font-sans p-6 overflow-hidden">
        <div className="w-16 h-16 border-4 border-[#3B803B] border-t-transparent rounded-full animate-spin"></div>
        <h2 className="mt-8 text-xl font-bold text-gray-700 animate-pulse">{loadingText}</h2>
        <p className="mt-2 text-sm text-gray-500 text-center">
          少し時間がかかる場合があります。<br />このまま少々お待ちください。
        </p>
      </div>
    );
  }

  if (suggestedMenus) {
    return (
      <div className="fixed inset-0 bg-[#FCFAF5] flex flex-col items-center font-sans text-gray-800 overflow-hidden">
        <div className="w-full flex flex-col items-center pt-12 flex-shrink-0">
          <h1 className="text-2xl font-bold text-center text-[#3B803B]">✨ AIおすすめメニュー ✨</h1>
          <p className="mt-2 text-sm text-gray-600 text-center mb-4">お好みの惣菜開発メニューを選んでください</p>
        </div>

        <div className="w-full max-w-md flex-1 overflow-y-auto px-4 pb-32 flex flex-col gap-6">
          {suggestedMenus.map((menu, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <span className="bg-[#F2F6E8] text-[#3B803B] text-xs font-bold px-3 py-1 rounded-full">候補 {index + 1}</span>
                <span className="text-sm font-bold text-gray-500">⏰ {menu.prepMinutes + (menu.cookMinutesPerServing || 0)}分</span>
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-3">{menu.menuName}</h2>
              
              <div className="text-lg font-bold text-orange-600 mb-4">
                想定提供価格: {menu.price ? `${menu.price}円` : "計算中"}
              </div>

              <div className="mb-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">使用する食材</h3>
                <div className="flex flex-wrap gap-2">
                  {menu.ingredients.map((ing, i) => (
                    <span key={i} className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-md font-medium">
                      {ing.name} (量: {Math.round(ing.usageRatio * 100)}%)
                    </span>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">調理工程</h3>
                <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                  {menu.recipe.map((step, i) => (
                    <li key={i} className="leading-relaxed">{step}</li>
                  ))}
                </ol>
              </div>

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

        <div className="fixed bottom-8 w-full flex justify-center z-30 px-4">
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

  return (
    <div className="fixed inset-0 bg-[#FCFAF5] flex flex-col items-center font-sans text-gray-800 overflow-hidden">
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      <div className="w-full flex flex-col items-center pt-12 flex-shrink-0">
        <h1 className="text-2xl font-bold">食材一覧</h1>
        <p className="mt-2 text-sm text-gray-600 text-center leading-relaxed">
          写真や手動入力から食材を読み取り、<br />一覧に追加できます
        </p>

        <button 
          onClick={() => setIsMenuOpen(true)}
          className="mt-6 w-11/12 max-w-md border-2 border-[#3B803B] text-[#3B803B] bg-white rounded-full py-4 flex items-center justify-center font-bold shadow-sm hover:bg-green-50 active:bg-green-100 transition-colors"
        >
          <span className="text-xl text-green-700">＋ 食材を追加</span>
        </button>
      </div>

      <div className="w-11/12 max-w-md mt-6 mb-32 flex-1 overflow-y-auto pb-4 pr-1">
        <h2 className="text-md mb-3 text-gray-700 font-bold sticky top-0 bg-[#FCFAF5] py-1 z-10">登録済みの食材</h2>

        {ingredients.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="grid grid-cols-[1.2fr_1fr_0.6fr_0.4fr] bg-[#F2F6E8] py-3 px-2 text-sm font-medium text-gray-700 sticky top-0 z-10">
              <div className="text-center pl-6">食材名</div>
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

      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-center mb-6">食材の追加方法を選択</h3>
            <div className="flex flex-col gap-3">
              <button onClick={handlePhotoClick} className="bg-[#428542] text-white py-4 rounded-xl font-bold hover:bg-[#326b32] transition-colors shadow-md">📸 写真から読み込む</button>
              <button onClick={() => { setIsMenuOpen(false); setIsManualInputOpen(true); }} className="bg-white border-2 border-gray-200 text-gray-700 py-4 rounded-xl font-bold hover:bg-gray-50">✍️ 手動で入力する</button>
              <button onClick={() => setIsMenuOpen(false)} className="text-gray-400 font-medium mt-2">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {isManualInputOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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

      <div className="fixed bottom-8 w-full flex justify-center z-30 px-4">
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