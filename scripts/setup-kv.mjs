/**
 * SecureShare — KV 命名空间设置脚本
 *
 * Wrangler 4+ 支持自动资源预配（Beta），kv_namespaces 无需配置 id。
 * 大多数用户只需运行 `npx wrangler deploy` 即可自动创建 KV。
 * 此脚本仅适用于需要手动预创建 KV 并指定 ID 的场景。
 *
 * 用法: node scripts/setup-kv.mjs
 */

import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// 优先使用 JSONC，兼容旧版 TOML
const configPath = existsSync(resolve(root, "wrangler.jsonc"))
  ? resolve(root, "wrangler.jsonc")
  : resolve(root, "wrangler.toml");

const isJsonc = configPath.endsWith(".jsonc");

function randomNamespaceName() {
  const suffix = randomBytes(6).toString("hex");
  return `secureshare-kv-${suffix}`;
}

/** 检查 KV 是否已有有效 id（无 id = 自动预配模式） */
function hasKvId(config) {
  if (isJsonc) {
    try {
      const parsed = JSON.parse(config);
      const bindings = parsed.kv_namespaces;
      if (!bindings || bindings.length === 0) return true; // 自动预配
      return bindings.some(
        (b) => b.id && b.id !== "PLACEHOLDER" && b.id !== "",
      );
    } catch {
      return true;
    }
  }
  const match = config.match(/^id\s*=\s*"([^"]*)"/m);
  if (!match) return true;
  const id = match[1];
  return id && id !== "PLACEHOLDER" && id.trim() !== "";
}

/** 在配置中写入 KV id */
function setKvId(config, newId) {
  if (isJsonc) {
    const parsed = JSON.parse(config);
    if (!parsed.kv_namespaces || parsed.kv_namespaces.length === 0) {
      parsed.kv_namespaces = [{ binding: "SECURE_KV", id: newId }];
    } else {
      parsed.kv_namespaces = parsed.kv_namespaces.map((ns) => ({
        ...ns,
        id: newId,
      }));
    }
    return JSON.stringify(parsed, null, 2) + "\n";
  }
  return config.replace(/^id\s*=\s*"[^"]*"/m, `id = "${newId}"`);
}

async function main() {
  let config = readFileSync(configPath, "utf-8");

  if (hasKvId(config)) {
    console.log(`ℹ️  KV 命名空间已配置或已启用自动预配，无需手动创建。`);
    console.log(`   Tip: 运行 \`npx wrangler deploy\` 自动创建 KV。`);
    return;
  }

  const nsName = randomNamespaceName();
  console.log(`🔨 正在创建 KV 命名空间: ${nsName} ...`);

  try {
    const output = execSync(`npx wrangler kv namespace create "${nsName}"`, {
      cwd: root,
      encoding: "utf-8",
    });

    const idMatch = output.match(/id\s*=\s*"([^"]+)"/);
    if (!idMatch) {
      throw new Error("无法从 wrangler 输出中解析 KV namespace id");
    }
    const newId = idMatch[1];

    config = setKvId(config, newId);
    writeFileSync(configPath, config, "utf-8");

    console.log(`✅  KV 命名空间创建成功！`);
    console.log(`   名称: ${nsName}`);
    console.log(`   ID:   ${newId}`);
    console.log(`   已写入 ${configPath}`);
  } catch (err) {
    console.error(`❌ 创建失败: ${err.message}`);
    console.error(
      "\n提示: 请先运行 `npx wrangler login` 登录 Cloudflare 账号。",
    );
    process.exit(1);
  }
}

main();
