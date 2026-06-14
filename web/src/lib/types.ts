// AIコア2機能で受け渡しする型。route.ts（サーバー）と画面（クライアント）で共有する。

// 機能①：AIが写真から読み取る項目（route.ts が discountedPrice を付与する前）
export type ExtractedProduct = {
    productName: string;
    originalPrice: number | null; // 税込価格
    discountPercent: number | null;
    unit: string | null;
    quantity: number; // パッケージ内の個数
};

// 機能①の最終出力（route.ts が割引後価格を付与）。
// 注: packCount は含まない（写真からは分からないので、登録画面で初期値1を付ける）。
export type Ingredient = ExtractedProduct & {
    discountedPrice: number | null;
};

// 機能②へ渡す食材1件（店員が確認・修正し packCount を付けたもの）
export type InputIngredient = {
    productName: string;
    discountedPrice: number | null;
    unit: string | null;
    quantity: number;
    packCount: number; // 在庫点数
};

// 機能②：AIが返すメニュー1件（route.ts が食数・金額を付与する前）
export type MenuFromAI = {
    menuName: string;
    ingredients: { name: string; usageRatio: number }[];
    recipe: string[];
    allergens: string[];
    prepMinutes: number;
    cookMinutesPerServing: number;
};

// 機能②の最終出力（route.ts が食数・材料費・人件費・利益・価格を付与）
export type Menu = MenuFromAI & {
    servings: number;
    totalCookingMinutes: number;
    ingredientCost: number;
    laborCost: number;
    profit: number;
    price: number;
};