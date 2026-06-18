// ============================================================
//  I18N Errors
// ============================================================
const I18N_ERRORS = {
  zh: {
    size_limit: "无效数据或内容超出大小限制(100KB)",
    invalid_id: "非法请求格式",
    consumed: "该链接已被阅读自毁，或已超过设定的过期期限。",
    rate_limited: "请求过于频繁，请稍后重试。",
    internal_error: "服务器内部故障",
  },
  en: {
    size_limit: "Invalid data or exceeds the size limit (100KB)",
    invalid_id: "Invalid request format",
    consumed: "This link has already been read and destroyed, or has expired.",
    rate_limited: "Too many requests. Please try again later.",
    internal_error: "Internal server error",
  },
};

function getLang(request) {
  const accept = request.headers.get("Accept-Language") || "";
  return accept.startsWith("zh") ? "zh" : "en";
}

function e(request, key) {
  const lang = getLang(request);
  return I18N_ERRORS[lang]?.[key] || I18N_ERRORS["en"][key];
}

// ============================================================
//  CSP Security Headers
// ============================================================
const CSP_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "connect-src 'self'; " +
    "img-src 'self' data:; " +
    "base-uri 'self'; " +
    "form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

function applySecurityHeaders(response) {
  for (const [key, value] of Object.entries(CSP_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

// ============================================================
//  Rate Limiter — Cloudflare Rate Limiting API (官方绑定)
// ============================================================
//
// 使用 wrangler.jsonc 中声明的 ratelimits 绑定，
// 每个 Cloudflare 节点独立计数，低延迟、无网络开销。
//
// key: 按 API 路由路径限流（/api/store 和 /api/get/* 各自独立计数）
//
async function checkRateLimit(env, path) {
  const { success } = await env.API_RATE_LIMITER.limit({ key: path });
  return success;
}

// ============================================================
//  Worker Entrypoint
// ============================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // 结构化请求日志
    console.log(
      JSON.stringify({
        level: "info",
        message: "incoming request",
        method,
        path,
      }),
    );

    // 频率限制 — 使用 Cloudflare Rate Limiting API（官方绑定）
    if (path.startsWith("/api/")) {
      const allowed = await checkRateLimit(env, path);
      if (!allowed) {
        console.warn(
          JSON.stringify({
            level: "warn",
            message: "rate limited",
            path,
          }),
        );
        return applySecurityHeaders(
          new Response(JSON.stringify({ error: e(request, "rate_limited") }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
    }

    // ---- 路由: POST /api/store ----
    if (method === "POST" && path === "/api/store") {
      try {
        const { cipherText, ttl } = await request.json();

        if (!cipherText || cipherText.length > 102400) {
          console.warn(
            JSON.stringify({
              level: "warn",
              message: "payload exceeds size limit",
              size: cipherText?.length ?? 0,
            }),
          );
          return applySecurityHeaders(
            new Response(JSON.stringify({ error: e(request, "size_limit") }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        const buffer = new Uint8Array(12);
        crypto.getRandomValues(buffer);
        const id = btoa(String.fromCharCode(...buffer))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        const expiry = Math.max(300, Math.min(ttl || 300, 604800));
        await env.SECURE_KV.put(id, cipherText, { expirationTtl: expiry });

        console.log(
          JSON.stringify({
            level: "info",
            message: "secret stored",
            id,
            expiry,
          }),
        );

        return applySecurityHeaders(
          new Response(JSON.stringify({ id }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      } catch (err) {
        console.error(
          JSON.stringify({
            level: "error",
            message: "store failed",
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        return applySecurityHeaders(
          new Response(
            JSON.stringify({ error: e(request, "internal_error") }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }
    }

    // ---- 路由: GET /api/get/:id（直接 KV 读取即销毁）----
    //
    // 注意: KV 是最终一致性模型，极低概率下并发读取可能同时读到数据。
    // 但对于剪贴板场景，这种竞态窗口极小，可以接受。
    //
    if (method === "GET" && path.startsWith("/api/get/")) {
      const id = path.split("/").pop();
      if (!id || id.length > 20) {
        console.warn(
          JSON.stringify({ level: "warn", message: "invalid id format", id }),
        );
        return applySecurityHeaders(
          new Response(JSON.stringify({ error: e(request, "invalid_id") }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      try {
        const cipherText = await env.SECURE_KV.get(id);
        if (!cipherText) {
          console.log(
            JSON.stringify({
              level: "info",
              message: "secret already consumed or expired",
              id,
            }),
          );
          return applySecurityHeaders(
            new Response(JSON.stringify({ error: e(request, "consumed") }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        await env.SECURE_KV.delete(id);

        console.log(
          JSON.stringify({
            level: "info",
            message: "secret retrieved and destroyed",
            id,
          }),
        );

        return applySecurityHeaders(
          new Response(JSON.stringify({ cipherText }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      } catch (err) {
        console.error(
          JSON.stringify({
            level: "error",
            message: "retrieve failed",
            id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        return applySecurityHeaders(
          new Response(
            JSON.stringify({ error: e(request, "internal_error") }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }
    }

    // ---- 静态资产: Wrangler Assets 自动处理 ----
    console.log(
      JSON.stringify({
        level: "info",
        message: "unmatched route, falling through to assets",
        path,
      }),
    );
    return new Response("Not Found", { status: 404 });
  },
};
