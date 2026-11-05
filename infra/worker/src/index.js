const encoder = new TextEncoder();

function base64UrlEncode(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function base64Encode(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function randomToken(length = 32) {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(length)));
}

async function deriveKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, {name: "AES-GCM"}, false, ["encrypt", "decrypt"]);
}

async function seal(value, secret) {
  const key = await deriveKey(secret);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {name: "AES-GCM", iv: nonce},
    key,
    encoder.encode(value)
  );
  const result = new Uint8Array(nonce.length + ciphertext.byteLength);
  result.set(nonce, 0);
  result.set(new Uint8Array(ciphertext), nonce.length);
  return base64UrlEncode(result);
}

async function open(value, secret) {
  try {
    const bytes = base64UrlDecode(value);
    const key = await deriveKey(secret);
    const plaintext = await crypto.subtle.decrypt(
      {name: "AES-GCM", iv: bytes.slice(0, 12)},
      key,
      bytes.slice(12)
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function cookie(name, value, maxAge) {
  return name + "=" + value + "; Max-Age=" + maxAge + "; Path=/; Secure; HttpOnly; SameSite=None";
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.SITE_ORIGIN,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(data, status, env, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(env),
      ...extra
    }
  });
}

function githubHeaders(token) {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": "Bearer " + token,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Metavis-Blog-Writer"
  };
}

function yamlString(value) {
  return JSON.stringify(String(value || ""));
}

function markdownFrom(payload) {
  const tags = Array.isArray(payload.tags) ? payload.tags : [];
  const tagLines = tags.map((tag) => "  - " + yamlString(tag)).join("\n");
  return [
    "---",
    "title: " + yamlString(payload.title),
    "date: " + payload.date,
    "draft: " + (payload.draft === true ? "true" : "false"),
    "description: " + yamlString(payload.description),
    "tags:",
    tagLines,
    "---",
    "",
    String(payload.body || "").trim(),
    ""
  ].join("\n");
}

function safeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function currentSession(request, env) {
  const raw = getCookie(request, "metavis_session");
  if (!raw) return null;
  const decoded = await open(raw, env.SESSION_SECRET);
  if (!decoded) return null;
  try {
    const session = JSON.parse(decoded);
    if (!session.token || !session.login || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

async function authLogin(request, env) {
  const incoming = new URL(request.url).searchParams.get("return_to");
  const returnTo = incoming && incoming.startsWith(env.SITE_ORIGIN)
    ? incoming
    : env.SITE_ADMIN_URL;
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challengeBytes = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  const oauthState = await seal(
    JSON.stringify({state, verifier, returnTo, exp: Date.now() + 10 * 60 * 1000}),
    env.SESSION_SECRET
  );
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: new URL(request.url).origin + "/auth/callback",
    scope: "public_repo read:user",
    state,
    code_challenge: base64UrlEncode(new Uint8Array(challengeBytes)),
    code_challenge_method: "S256",
    allow_signup: "false"
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: "https://github.com/login/oauth/authorize?" + params.toString(),
      "Set-Cookie": cookie("metavis_oauth", oauthState, 600)
    }
  });
}

async function authCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = getCookie(request, "metavis_oauth");
  const decoded = saved ? await open(saved, env.SESSION_SECRET) : null;
  if (!code || !state || !decoded) return new Response("OAuth state is invalid.", {status: 400});
  const oauthState = JSON.parse(decoded);
  if (oauthState.exp < Date.now() || oauthState.state !== state) {
    return new Response("OAuth state is invalid.", {status: 400});
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {"Accept": "application/json", "Content-Type": "application/json"},
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: new URL(request.url).origin + "/auth/callback",
      code_verifier: oauthState.verifier
    })
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    return new Response("GitHub 登录失败。", {status: 502});
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: githubHeaders(tokenData.access_token)
  });
  const user = await userResponse.json();
  if (!userResponse.ok || user.login !== env.ADMIN_LOGIN) {
    return new Response("这个 GitHub 账号没有写作权限。", {status: 403});
  }

  const session = await seal(
    JSON.stringify({
      token: tokenData.access_token,
      login: user.login,
      exp: Date.now() + 8 * 60 * 60 * 1000
    }),
    env.SESSION_SECRET
  );

  const response = new Response(null, {
    status: 302,
    headers: {Location: oauthState.returnTo}
  });
  response.headers.append("Set-Cookie", cookie("metavis_session", session, 8 * 60 * 60));
  response.headers.append("Set-Cookie", cookie("metavis_oauth", "", 0));
  return response;
}

async function savePost(request, env) {
  const session = await currentSession(request, env);
  if (!session) return json({error: "请先登录 GitHub。"}, 401, env);

  const payload = await request.json();
  const title = String(payload.title || "").trim();
  const slug = safeSlug(payload.slug);
  const date = String(payload.date || "").trim();
  const body = String(payload.body || "").trim();

  if (!title || !slug || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !body) {
    return json({error: "标题、slug、日期和正文不能为空。"}, 400, env);
  }

  const filename = date + "-" + slug + ".md";
  const path = "content/posts/" + filename;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const apiUrl = "https://api.github.com/repos/" + env.REPO_OWNER + "/" + env.REPO_NAME + "/contents/" + encodedPath;
  const headers = {
    ...githubHeaders(session.token),
    "Content-Type": "application/json"
  };

  let existingSha;
  const existing = await fetch(apiUrl, {headers});
  if (existing.ok) {
    const existingData = await existing.json();
    existingSha = existingData.sha;
  } else if (existing.status !== 404) {
    return json({error: "无法检查文章是否已经存在。"}, 502, env);
  }

  const content = base64Encode(encoder.encode(markdownFrom({
    ...payload,
    title,
    slug,
    date,
    body
  })));

  const updateResponse = await fetch(apiUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: (existingSha ? "Update post: " : "Create post: ") + title,
      content,
      branch: env.REPO_BRANCH,
      ...(existingSha ? {sha: existingSha} : {})
    })
  });

  if (!updateResponse.ok) {
    return json({error: "GitHub 写入失败，请检查 Worker 权限和仓库配置。"}, 502, env);
  }

  return json({
    message: payload.draft === true
      ? "草稿已保存。"
      : "文章已发布，GitHub Actions 会自动更新网站。",
    path
  }, 200, env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {status: 204, headers: corsHeaders(env)});
    }

    if (url.pathname === "/auth/login") return authLogin(request, env);
    if (url.pathname === "/auth/callback") return authCallback(request, env);
    if (url.pathname === "/auth/logout") {
      const response = new Response(null, {status: 204, headers: corsHeaders(env)});
      response.headers.append("Set-Cookie", cookie("metavis_session", "", 0));
      return response;
    }

    if (url.pathname === "/api/session" && request.method === "GET") {
      const session = await currentSession(request, env);
      return session
        ? json({login: session.login}, 200, env)
        : json({error: "unauthorized"}, 401, env);
    }

    if (url.pathname === "/api/posts" && request.method === "POST") {
      try {
        return await savePost(request, env);
      } catch {
        return json({error: "请求格式不正确。"}, 400, env);
      }
    }

    return new Response("Not found", {status: 404});
  }
};
