// 公開メニュー：店が選んだ1メニューを受け取り、完成予想の画像をAI生成してメモリに保存する。
// 設計: docs/customer-menu-image.md
//  POST … メニュー受領 → 画像生成(Pollinations.ai) → メモリに「現在の1件」を上書き保存
//  GET  … メモリの「現在の1件」を返す（客側が表示に使う）

import type { Menu } from "@/lib/types";
import {
  getCurrentMenu,
  setCurrentMenu,
  replacePhoto,
  type PublishedMenu,
} from "@/lib/menuStore";

// 画像生成(Pollinations)に最大60秒待つため、関数の実行時間上限を延長（無料プラン上限60秒）。
// これが効かない環境ではPOSTがタイムアウトし得るので、画像生成のタイムアウト(60s)と揃える。
export const maxDuration = 60;

// 画風を毎回そろえるための共通スタイル指定（全メニュー共通で末尾に付ける）。
// 構図は固定し過ぎず、料理に応じて盛り付け・器が変わる余地を残す（似た画像ばかりになるのを防ぐ）。
const STYLE_SUFFIX =
  "Professional food photography, freshly served and steaming hot, garnished, vivid appetizing colors, " +
  "soft natural window light, shallow depth of field, 50mm lens, photorealistic textures, high resolution, " +
  "no text, no watermark, no hands, no utensils in frame.";

// 料理名・主な食材・調理法から、写真風の画像生成プロンプトを組み立てる。
function buildImagePrompt(menu: Menu): string {
  const ingredients = menu.ingredients.map((i) => i.name).join(", ");
  const steps = menu.recipe.slice(0, 2).join(" ");
  return [
    `An appetizing, photorealistic photograph of a Japanese home-style dish called "${menu.menuName}",`,
    `served in tableware that suits the dish, plated for a casual eatery.`,
    `Main ingredients visible: ${ingredients}.`,
    steps ? `How it is prepared: ${steps}` : "",
    STYLE_SUFFIX,
  ]
    .filter(Boolean)
    .join(" ");
}

// 料理名から安定した整数seedを作る（同じメニューは毎回同じ画像になる）。
function seedFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// 画像を1枚生成し、data URL（base64）で返す。失敗時は null。
// 生成は Pollinations.ai（リンク型・キー登録も課金も不要の無料サービス）。匿名枠の sana を使う。
// enhance=true でプロンプトをLLMが具体化し、質と多様性を上げる（無料・追加コストなし）。
// seedOverride を渡すと別構図を引き直せる（店舗側の「別の画像で再生成」用）。
// URL を叩くと画像が直接返るので、サーバー側で fetch して base64 に変換する。
async function generateImage(menu: Menu, seedOverride?: number): Promise<string | null> {
  try {
    const prompt = buildImagePrompt(menu);
    const seed = seedOverride ?? seedFromName(menu.menuName);
    const url =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
      `?width=1024&height=768&nologo=true&enhance=true&model=sana&seed=${seed}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`Pollinations ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${mimeType};base64,${buf.toString("base64")}`;
  } catch (err) {
    // タイムアウト・サービス障害等。画像は null にして公開自体は成功させる。
    console.error("画像生成に失敗しました:", err);
    return null;
  }
}

export async function POST(req: Request) {
  const { menu, seed } = (await req.json()) as { menu?: Menu; seed?: number };
  if (!menu || !menu.menuName) {
    return Response.json({ error: "menu（公開するメニュー）が必要です" }, { status: 400 });
  }

  // 完成予想の画像を生成。seed が来たら別構図を引き直す（店舗側の「別の画像で再生成」）。
  const image = await generateImage(menu, typeof seed === "number" ? seed : undefined);

  // メモリの「現在の1件」を丸ごと上書き。
  const published: PublishedMenu = {
    ...menu,
    image, // 失敗時は null（客側はプレースホルダー表示）
    isReal: false, // AI生成イメージ
    remaining: menu.servings, // 作れる食数を残数の初期値に
    publishedAt: Date.now(),
  };
  setCurrentMenu(published);

  return Response.json(published);
}

// 料理完成後の実写差し替え。店から画像(base64データURL)を受け取り、
// 現在公開中の1件の画像を上書きして isReal=true にする（客側の「※イメージ画像」が消える）。
export async function PATCH(req: Request) {
  const { image } = (await req.json()) as { image?: string };
  if (!image || !image.startsWith("data:image/")) {
    return Response.json(
      { error: "image（実写の画像データURL）が必要です" },
      { status: 400 },
    );
  }

  const ok = replacePhoto(image);
  if (!ok) {
    return Response.json(
      { error: "公開中のメニューがありません。先に公開してください" },
      { status: 409 },
    );
  }

  return Response.json(getCurrentMenu());
}

export async function GET() {
  return Response.json(getCurrentMenu());
}
