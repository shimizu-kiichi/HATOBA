// プロンプト本文は src/prompts/*.md の ```text ... ``` ブロックを正本とし、実行時に読み込む。
// （route.ts に文面を重複させない。md を書き換えれば次のリクエストから反映される）
// デプロイ時にこの md がサーバーへ同梱されるよう、next.config.ts の outputFileTracingIncludes で指定している。

import { readFile } from "node:fs/promises";
import path from "node:path";

const promptsDir = path.join(process.cwd(), "src", "prompts");

// 例: loadPromptBody("prompt-extract.md")
export async function loadPromptBody(fileName: string): Promise<string> {
  const md = await readFile(path.join(promptsDir, fileName), "utf-8");
  // より柔軟な正規表現：開始の後の改行は最大1つ、終了の前の改行は最大1つ
  const match = md.match(/```text\n?([\s\S]*?)\n?```/);
  if (!match) {
    throw new Error(`プロンプト本文(\`\`\`text ブロック)が見つかりません: ${fileName}`);
  }
  return match[1].trim();
}
