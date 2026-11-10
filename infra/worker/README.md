# Metavis 写作接口

这个 Worker 负责三件事：

1. 使用 GitHub OAuth 登录；
2. 只允许 ADMIN_LOGIN 对应的 GitHub 账号发布；
3. 把写作台提交的文章内容写入 content/posts/，触发现有 GitHub Pages 部署。写作台负责所见即所得编辑，并在提交时自动转换为 Markdown；作者不需要手动维护 Markdown 文件。

## 一次性配置

1. 在 GitHub 创建 OAuth App。
   - Homepage URL: https://yuanming-wang.github.io/Metavis.github.io/admin/
   - Authorization callback URL: 部署 Worker 后，将实际 Worker 地址加上 /auth/callback
2. 安装 Wrangler 并登录 Cloudflare。
3. 修改 wrangler.toml 中的 GITHUB_CLIENT_ID（可以先保留占位值，部署后再补上）。
4. 部署 Worker：

   cd infra/worker
   npx wrangler deploy

5. 在 Cloudflare Dashboard 中打开这个 Worker，进入 Settings → Variables and Secrets，新增两个 Secret：
   - GITHUB_CLIENT_SECRET：GitHub OAuth App 的 Client Secret
   - SESSION_SECRET：一串随机长字符串

不要把这两个值提交到 GitHub。
6. 把部署后得到的 Worker 地址写入 static/admin/config.js 的 apiBase，再提交一次。

图片上传

写作台的“上传图片”会把图片写入 `static/uploads/`，文章中使用对应的 `/Metavis.github.io/uploads/...` 地址。`SITE_BASE_PATH` 必须保持为 `/Metavis.github.io`，否则 GitHub Pages 项目站点的图片地址会缺少仓库前缀。

GitHub OAuth 的 client secret 和会话密钥只放在 Worker Secret 中，不能放进静态网页。部署时请使用 HTTPS。

## 登录保持与自动续期

- 会话有效期为 30 天，采用滑动过期策略。
- 写作台每次打开时验证会话；使用期间每 24 小时自动续期一次，并在页面重新获得焦点且续期周期已到时补做验证。
- Worker 返回的是由 `SESSION_SECRET` 加密的会话票据，不是 GitHub Access Token 明文。浏览器会保存该加密票据，以兼容浏览器对跨站 Cookie 的限制；Worker 同时更新 HttpOnly Cookie。
- 用户主动退出会清除浏览器保存的会话票据并清除 Cookie。清理浏览器站点数据、撤销 GitHub OAuth 授权或超过 30 天未访问，仍需要重新登录。
