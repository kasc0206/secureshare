# 🔒 SecureShare

[![Live Demo](https://img.shields.io/badge/Live-Demo-teal?style=flat-square)](https://secureshare.kasc0206.workers.dev)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers_2026-F38020?logo=cloudflare&logoColor=white&style=flat-square)](https://workers.cloudflare.com/)
[![Workers Assets](https://img.shields.io/badge/Workers-Assets-3b82f6?style=flat-square)](https://developers.cloudflare.com/workers/static-assets/)
[![MIT License](https://img.shields.io/badge/license-MIT-teal?style=flat-square)](./LICENSE)

**Zero-Knowledge End-to-End Encrypted Clipboard** · *Burn-after-reading · AES-GCM-256 · PBKDF2 · Cloudflare Workers*

---

**SecureShare** is an open-source, zero-knowledge, end-to-end encrypted (E2EE) clipboard with automatic burn-after-reading. Designed for securely sharing secrets, tokens, passwords, and private messages.

🔗 **Live Demo:** [secureshare.kasc0206.workers.dev](https://secureshare.kasc0206.workers.dev)

---

**SecureShare** 是一个开源、零信任、端到端加密（E2EE）的阅后即焚剪贴板。专为安全分享机密信息、Token、密码和私密消息而设计。

---

## 🌟 核心功能 / Core Features

### 🔐 Zero-Knowledge Encryption · 零知识加密

> **Keys are NEVER sent to the server.** The decryption key is embedded in the URL hash (`#key=...`). Per the HTTP specification, hash fragments are never transmitted to servers — guaranteed by the browser itself.
>
> **密钥绝不沾云。** 解密密钥存放在 URL Hash（`#key=...`）中。根据 HTTP 协议规范，浏览器**绝对不会**将 Hash 内容发送给服务器——这是浏览器层面的硬性保证。

| Layer | Algorithm | Key Length | Purpose |
|-------|-----------|:----------:|---------|
| **1st — URL Key** | AES-GCM-256 | 256-bit | Primary encryption, unique per secret |
| **2nd — Passphrase** | PBKDF2-SHA256 → AES-GCM-256 | 256-bit | Optional double-layer defense |
| **Key Derivation** | PBKDF2 (80,000 iterations) | — | Passphrase strengthening |

---

### 🔥 Atomic Burn-after-Reading · 原子阅后即焚

```text
User clicks link
       │
       ▼
┌─────────────────────┐
│  GET /api/get/:id   │
│  ┌───────────────┐  │
│  │ KV.get(id)    │  │  ← Read ciphertext
│  └───────┬───────┘  │
│          ▼          │
│  ┌───────────────┐  │
│  │ KV.delete(id) │  │  ← INSTANTLY destroy — same tick
│  └───────┬───────┘  │
│          ▼          │
│  Return ciphertext  │  ← Response sent AFTER deletion
└─────────────────────┘
       │
       ▼
  Second visit → 404
  "Already destroyed"
```

The ciphertext is deleted from the edge **before** the response is sent. A second request to the same ID returns `404` — the secret has physically vanished.

密文在返回响应**之前**就已从边缘节点删除。再次访问同一链接返回 `404` —— 秘密已物理级消失。

---

### 🛡️ Double-Layer Passphrase Lock · 双层暗号锁

Even if someone intercepts the link, they still need the **extra passphrase** you agreed upon with the recipient.

即使链接被中间人拦截，攻击者仍然需要你和接收方**口头约定的独立暗号**。

```text
Link: https://example.com/?id=XXX#key=AAA&p=1
                                          └── passphrase enabled
                                                    │
                          ┌─────────────────────────┘
                          ▼
              ┌─────────────────────┐
              │  Prompt for         │
              │  passphrase         │
              └──────────┬──────────┘
                         ▼
              ┌─────────────────────┐
              │  PBKDF2 derive key  │  ← 80,000 iterations
              │  AES-GCM decrypt    │
              └──────────┬──────────┘
                         ▼
              ┌─────────────────────┐
              │  Wrong? → Retry     │  ← Ciphertext already destroyed
              │  Correct? → Show    │     on server, retry locally
              └─────────────────────┘
```

---

### ⚡ Fully Local Encryption · 纯本地加密

All encryption and decryption happens **in your browser** using the native [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API). The server only ever sees **already-encrypted ciphertext** — it has zero ability to read your data.

所有加密和解密操作都在**你的浏览器本地**完成，使用浏览器原生 [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)。服务器只能看到**已经加密的密文**，完全没有能力读取你的数据。

```text
Browser                          Server (Cloudflare)
  │                                    │
  │  AES-GCM-256 Encrypt               │
  │  (Optional) PBKDF2 Encrypt         │
  │                                    │
  │  ─── ciphertext ──────────────────►│  KV.put(id, ciphertext)
  │                                    │
  │  ◄── { id } ──────────────────────│
  │                                    │
  │  Build URL with #key=...           │
  │  (hash NEVER sent to server)       │
  │                                    │
```

---

### ⚡ Auto-Provisioned Infrastructure · 自动预配基础设施

| Resource | How it's provisioned |
|----------|---------------------|
| **KV Namespace** | Auto-created by `wrangler deploy` — no manual setup |
| **Rate Limiting** | Configured via `ratelimits` binding in `wrangler.jsonc` |
| **Static Assets** | Workers Assets — served at edge, zero Worker cost |
| **Security Headers** | Applied automatically to every API response |

---

### 🎯 Feature Summary / 功能一览

| 功能 | 说明 |
|------|------|
| **端到端加密** | AES-GCM-256 本地加密，密钥 Hash 内传输绝不上云 |
| **阅后即焚** | 读取即删除，二次访问 404，不留痕迹 |
| **暗号锁** | 可选独立暗号，PBKDF2 强派生，双层防拦截 |
| **一键部署** | 点击 Deploy Button 即可部署到 Cloudflare |
| **无需注册** | 无需账号、无需登录，打开即用 |
| **免费无限** | 基于 Cloudflare 免费计划，静态资产不消耗配额 |
| **双语界面** | 中 / English 一键切换 |
| **频率限制** | Cloudflare 官方 Rate Limiting API，20次/60秒 |
| **安全头** | CSP、X-Frame-Options、X-Content-Type-Options |
| **开源 MIT** | 自由使用、修改、分发 |

## 🚀 One-Click Deploy / 一键部署

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kasc0206/secureshare)

Click the button above — Cloudflare automatically forks the repo, creates the KV namespace, and deploys the Worker. Zero configuration required.

> **Note:** Cloudflare Deploy Button reads `package.json` → `cloudflare.bindings` to auto-provision the KV namespace.

点击上方按钮 — Cloudflare 自动 Fork 仓库、创建 KV 命名空间并部署 Worker。无需任何配置。

---

## 🖥️ Local Development / 本地开发

```bash
# 1. Clone / 克隆
git clone https://github.com/kasc0206/secureshare.git
cd secureshare

# 2. Install dependencies / 安装依赖
npm install

# 3. Login to Cloudflare (first time only) / 登录 Cloudflare（首次使用）
npx wrangler login

# 4. Build CSS + start local dev server / 构建 CSS 并启动本地开发
npm run dev
# → http://localhost:8787

# 5. Deploy to production / 部署到生产
npm run deploy
```

### Scripts / 脚本说明

| Command | Description |
|---------|-------------|
| `npm run dev` | Build CSS + start `wrangler dev` (local KV simulation) |
| `npm run build` | Build Tailwind CSS → `public/style.css` |
| `npm run deploy` | Build CSS + deploy to Cloudflare Workers |
| `npm run setup` | (Optional) Manually create KV namespace |
| `npm run types` | Generate TypeScript type definitions |

---

## 🏗️ Architecture / 架构

```text
User Browser                    Cloudflare Edge                   Cloudflare
     │                               │                              │
     │  ┌─────── Static Assets ──────┤                              │
     │  │  (index.html, style.css)   │  Workers Assets              │
     │  │  Served directly by edge   │  (free, unlimited)           │
     │  │                            │                              │
     │  └── /api/store ──────────────┤                              │
     │      /api/get/:id             │  Worker (ES Module)          │
     │                               │     │                        │
     │                               │  ┌──┴──┐                     │
     │                               │  │Rate │ ← Rate Limiting API │
     │                               │  │Limit│   20 req/60s        │
     │                               │  └──┬──┘                     │
     │                               │     │                        │
     │                               │  ┌──┴──────────┐             │
     │                               │  │  KV (read/  │─────────────│── SECURE_KV
     │                               │  │  write/     │             │   Namespace
     │                               │  │  delete)    │             │
     │                               │  └─────────────┘             │
     │                               │                              │
     │  ←── Response ────────────────┤                              │
     │      + CSP Security Headers   │                              │
```

### Key Design Decisions / 关键设计

| Decision / 决策 | Rationale / 理由 |
|----------------|------------------|
| **Keys in URL hash** | `#key=` is never sent to servers per HTTP spec — true zero-knowledge |
| **AES-GCM-256 + PBKDF2** | Double layer: even if KV is breached, ciphertext is useless without both keys |
| **KV read-then-delete** | No background cleanup needed; atomic for practical purposes |
| **Workers Assets** | Static files served at edge — free, fast, no Worker invocation cost |
| **Rate Limiting API binding** | Official CF binding, zero-latency, per-location counting |
| **Local Tailwind CSS** | No CDN dependency, works offline, CSP-compliant |

---

## 🛡️ Security Details / 安全详情

### Encryption Flow / 加密流程

```text
                    ┌──────────────┐
                    │  Plain Text  │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │  AES-GCM-256 Encrypt    │ ← URL Key (random 256-bit)
              │  with 96-bit random IV  │
              └────────────┬────────────┘
                           │
              ┌────────────┴────────────┐
              │  (Optional) PBKDF2      │ ← Passphrase (user-defined)
              │  SHA-256 × 80,000 iter  │
              │  AES-GCM-256 Encrypt    │
              └────────────┬────────────┘
                           │
                    ┌──────┴──────┐
                    │  Ciphertext │ ──→ POST /api/store → KV
                    └─────────────┘
```

### Decryption Flow / 解密流程

```text
Browser loads: /?id=XXX#key=YYYY&p=1
                          │
              ┌───────────┴───────────┐
              │  GET /api/get/:id     │
              │  → KV read + delete   │ ← Atomic burn-after-reading
              │  → Returns ciphertext  │
              └───────────┬───────────┘
                          │
              ┌───────────┴───────────┐
              │  (If p=1) Prompt for  │
              │  passphrase → PBKDF2  │
              │  → AES-GCM-256 Decrypt│
              └───────────┬───────────┘
                          │
              ┌───────────┴───────────┐
              │  AES-GCM-256 Decrypt  │ ← URL Key from hash
              │  → Plain Text         │
              └───────────────────────┘
```

### Security Headers / 安全头

Every API response includes:

- `Content-Security-Policy`: Restricts script/style/connect sources to `'self'`
- `X-Content-Type-Options: nosniff`: Prevents MIME type sniffing
- `X-Frame-Options: DENY`: Prevents clickjacking
- `Referrer-Policy: no-referrer`: Prevents referrer leakage

---

## 📂 Project Structure / 项目结构

```text
secureshare/
├── public/
│   ├── index.html        # Frontend: UI + Web Crypto API (AES-GCM, PBKDF2)
│   └── style.css          # Tailwind CSS (built, not CDN)
├── src/
│   ├── index.js           # Backend: API routes (store / retrieve)
│   └── input.css          # Tailwind source (build dependency)
├── scripts/
│   └── setup-kv.mjs       # (Optional) Manual KV namespace creation
├── wrangler.jsonc         # Cloudflare Workers configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── package.json           # NPM dependencies + Deploy Button metadata
├── .gitignore
├── LICENSE                # MIT
└── README.md              # This file
```

---

## ☁️ Cloudflare Free Plan Resource Usage / 免费计划资源消耗

| Resource / 资源 | Free Plan Limit / 免费限额 | SecureShare Usage / 本项目的消耗 |
|----------------|:-------------------------:|:-------------------------------:|
| **Worker Requests** | 100,000/day | **Only API calls** (static assets are free) |
| **CPU Time** | 10ms/request | ~2-5ms per API call |
| **KV Reads** | 100,000/day | 1 per secret retrieval |
| **KV Writes** | 1,000/day | 1 per secret creation |
| **KV Deletes** | 1,000/day | 1 per secret retrieval |
| **KV Storage** | 1 GB | Negligible (text only) |
| **Workers Logs** | 200,000/day | 100% sampling (configurable) |
| **Rate Limiting API** | Included | 20 req/60s per route |

> 💡 Static assets (`index.html`, `style.css`) are served by Cloudflare's edge cache via **Workers Assets** — they do **not** consume any Worker request quota and are **free and unlimited**.

---

## 📜 License / 许可

MIT — see [LICENSE](./LICENSE).

---

Built with ❤️ using [Cloudflare Workers](https://workers.cloudflare.com/), [Tailwind CSS](https://tailwindcss.com/) & [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
