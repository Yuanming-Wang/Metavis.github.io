# Metavis 写作接口

这个 Worker 负责三件事：

1. 使用 GitHub OAuth 登录；
2. 只允许 ADMIN_LOGIN 对应的 GitHub 账号发布；
3. 把 Markdown 文章写入 content/posts/，触发现有 GitHub Pages 部署。

## 一次性配置

1. 在 GitHub 创建 OAuth App。
   - Homepage URL: https://yuanming-wang.github.io/Metavis.github.io/admin/
   - Authorization callback URL: https://YOUR-METAVIS-WORKER.workers.dev/auth/callback
2. 安装 Wrangler 并登录 Cloudflare。
3. 修改 wrangler.toml 中的 WORKER_URL 和 GITHUB_CLIENT_ID。
4. 部署 Worker：

   cd infra/worker
   npx wrangler deploy

5. 设置敏感信息：

   npx wrangler secret put GITHUB_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET

SESSION_SECRET 请使用一串随机长字符串，不要提交到 GitHub。
6. 把 Worker 地址写入 static/admin/config.js 的 apiBase，提交后重新部署博客。

GitHub OAuth 的 client secret 和会话密钥只放在 Worker Secret 中，不能放进静态网页。部署时请使用 HTTPS。
