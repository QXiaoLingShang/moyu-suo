// 构建后把 pagefind 索引拷回 public/，供下次构建与开发预览使用（跨平台替代原主题的 cp -r）
import { cpSync } from "node:fs";

cpSync("dist/pagefind", "public/pagefind", { recursive: true, force: true });
