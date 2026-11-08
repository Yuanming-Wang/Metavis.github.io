
(() => {
  const config = window.METAVIS_CONFIG || {};
  const apiBase = String(config.apiBase || "").replace(/\/$/, "");
  const setupPanel = document.querySelector("#setup-panel");
  const loginPanel = document.querySelector("#login-panel");
  const editorForm = document.querySelector("#editor-form");
  const editor = document.querySelector("#editor");
  const preview = document.querySelector("#preview");
  const bodyField = document.querySelector("#body");
  const titleField = document.querySelector("#title");
  const slugField = document.querySelector("#slug");
  const dateField = document.querySelector("#date");
  const descriptionField = document.querySelector("#description");
  const tagsField = document.querySelector("#tags");
  const imageFile = document.querySelector("#image-file");
  const loginButtons = [
    document.querySelector("#login-button-secondary")
  ].filter(Boolean);
  const logoutButton = document.querySelector("#logout-button");
  const loginButton = document.querySelector("#login-button");
  const sessionLabel = document.querySelector("#session-label");
  const authMessage = document.querySelector("#auth-message");
  const message = document.querySelector("#form-message");
  const wordCount = document.querySelector("#word-count");
  const readTime = document.querySelector("#read-time");
  const today = new Date().toISOString().slice(0, 10);
  const localDraftKey = "metavis-writing-draft-v2";
  let slugTouched = false;
  let savedRange = null;
  const pendingImages = new Map();

  const sessionKey = "metavis_session";
  const returnedSession = new URLSearchParams(window.location.hash.slice(1)).get("session");
  const hadReturnedSession = Boolean(returnedSession);
  let memorySession = "";

  const readStorage = (storage) => {
    try { return storage.getItem(sessionKey) || ""; } catch { return ""; }
  };

  const writeStorage = (storage, token) => {
    try { storage.setItem(sessionKey, token); } catch {}
  };

  const removeStorage = (storage) => {
    try { storage.removeItem(sessionKey); } catch {}
  };

  const persistSession = (token) => {
    memorySession = token;
    writeStorage(localStorage, token);
    writeStorage(sessionStorage, token);
  };

  const clearSession = () => {
    memorySession = "";
    removeStorage(localStorage);
    removeStorage(sessionStorage);
  };

  const existingSession = readStorage(localStorage) || readStorage(sessionStorage);
  if (existingSession && !readStorage(localStorage)) {
    writeStorage(localStorage, existingSession);
  }

  if (returnedSession) {
    persistSession(returnedSession);
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }

  const sessionToken = () => readStorage(localStorage) || readStorage(sessionStorage) || memorySession;
  const authHeaders = () => {
    const token = sessionToken();
    return token ? {Authorization: "Bearer " + token} : {};
  };

  const setAuthMessage = (text) => {
    if (!authMessage) return;
    authMessage.textContent = text;
    authMessage.hidden = !text;
  };

  dateField.value = today;

  const showLoggedOut = () => {
    loginPanel.hidden = false;
    editorForm.hidden = true;
    if (loginButton) loginButton.hidden = false;
    logoutButton.hidden = true;
    sessionLabel.textContent = "";
  };

  const showLoggedIn = (login) => {
    loginPanel.hidden = true;
    editorForm.hidden = false;
    if (loginButton) loginButton.hidden = true;
    logoutButton.hidden = false;
    sessionLabel.textContent = login ? "已登录：" + login : "已登录";
    updatePreview();
  };

  const login = () => {
    const returnTo = window.location.href.split("#")[0];
    window.location.href = apiBase + "/auth/login?return_to=" + encodeURIComponent(returnTo);
  };

  loginButtons.forEach((button) => button.addEventListener("click", login));

  logoutButton.addEventListener("click", async () => {
    await fetch(apiBase + "/auth/logout", {
      credentials: "include",
      mode: "cors",
      headers: authHeaders()
    });
    clearSession();
    showLoggedOut();
  });

  showLoggedOut();

  if (!apiBase || apiBase.includes("YOUR-METAVIS-WORKER")) {
    setupPanel.hidden = false;
    if (loginButton) loginButton.hidden = true;
  } else {
    fetch(apiBase + "/api/session?ts=" + Date.now(), {
      credentials: "include",
      mode: "cors",
      cache: "no-store",
      headers: authHeaders()
    })
      .then(async (response) => {
        if (response.ok) return response.json();
        const error = new Error("会话验证失败");
        error.status = response.status;
        throw error;
      })
      .then((data) => {
        if (!data || !data.login) {
          const error = new Error("Worker 没有返回登录用户");
          error.status = 401;
          throw error;
        }
        setAuthMessage("");
        showLoggedIn(data.login);
      })
      .catch((error) => {
        clearSession();
        showLoggedOut();
        if (hadReturnedSession) {
          setAuthMessage("登录回调已返回，但写作台没有接受这个会话（" + (error.status || "网络") + "）。请再点一次登录；如果仍失败，刷新页面后重试。");
        }
      });
  }

  const latinSlug = (value) => {
    const slug = String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return slug || "note-" + dateField.value.replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6);
  };

  const syncSlug = () => {
    if (!slugTouched) slugField.value = latinSlug(titleField.value);
  };

  titleField.addEventListener("input", syncSlug);
  dateField.addEventListener("change", syncSlug);
  slugField.addEventListener("input", () => { slugTouched = true; });

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount) savedRange = selection.getRangeAt(0).cloneRange();
  };

  editor.addEventListener("keyup", rememberSelection);
  editor.addEventListener("mouseup", rememberSelection);
  editor.addEventListener("focus", rememberSelection);

  const insertNodeAtCaret = (node) => {
    editor.focus();
    const selection = window.getSelection();
    const range = savedRange || (selection && selection.rangeCount ? selection.getRangeAt(0) : null);
    if (!range) {
      editor.appendChild(node);
      return;
    }
    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRange = range.cloneRange();
  };

  const runCommand = (command, value = null) => {
    editor.focus();
    document.execCommand(command, false, value);
    rememberSelection();
    updatePreview();
    saveLocalDraft();
  };

  document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => runCommand(button.dataset.command, button.dataset.value || null));
  });

  document.querySelector("#link-button").addEventListener("click", () => {
    const url = window.prompt("输入链接地址", "https://");
    if (url) runCommand("createLink", url.trim());
  });

  const insertImageUrl = () => {
    const url = window.prompt("输入图片地址", "https://");
    if (!url) return;
    const alt = window.prompt("图片说明（可选）", "") || "";
    const image = document.createElement("img");
    image.src = url.trim();
    image.alt = alt;
    image.loading = "lazy";
    insertNodeAtCaret(image);
    updatePreview();
    saveLocalDraft();
  };

  const cleanupPendingImages = () => {
    const active = new Set(
      Array.from(editor.querySelectorAll("img[data-pending-image]"))
        .map((image) => image.dataset.pendingImage)
        .filter(Boolean)
    );
    for (const [id, item] of pendingImages) {
      if (!active.has(id)) {
        URL.revokeObjectURL(item.localPreviewUrl);
        pendingImages.delete(id);
      }
    }
  };

  const uploadAsset = async (file) => {
    const formData = new FormData();
    formData.append("file", file, file.name || "image");
    const response = await fetch(apiBase + "/api/assets?ts=" + Date.now(), {
      method: "POST",
      credentials: "include",
      mode: "cors",
      cache: "no-store",
      headers: authHeaders(),
      body: formData
    });
    const contentType = response.headers.get("content-type") || "";
    let data = {};
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      if (text) data.error = text;
    }
    if (!response.ok) {
      throw new Error(data.error || ("图片上传失败（" + response.status + "）"));
    }
    if (!data.url || !data.path || !data.sha) {
      throw new Error("图片上传接口没有返回完整的图片信息。");
    }
    return data;
  };

  const uploadImage = (file, altOverride = null) => {
    if (!apiBase) {
      setMessage("发布接口还没有配置。", "error");
      return false;
    }
    if (!file || !String(file.type || "").startsWith("image/")) {
      setMessage("请选择有效的图片文件。", "error");
      return false;
    }
    if (file.size > 8 * 1024 * 1024) {
      setMessage("图片不能超过 8 MB。", "error");
      return false;
    }

    const id = "pending-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
    const localPreviewUrl = URL.createObjectURL(file);
    pendingImages.set(id, {file, localPreviewUrl});

    const alt = altOverride === null
      ? (window.prompt("图片说明（可选）", "") || "")
      : altOverride;
    const image = document.createElement("img");
    image.src = localPreviewUrl;
    image.dataset.previewSrc = localPreviewUrl;
    image.dataset.pendingImage = id;
    image.alt = alt;
    image.loading = "lazy";
    insertNodeAtCaret(image);
    updatePreview();
    saveLocalDraft();
    setMessage("图片已加入本地预览；点击发布后才会上传到 GitHub。", "success");
    return true;
  };

  const uploadPendingImages = async () => {
    const uploaded = [];
    try {
      for (const image of Array.from(editor.querySelectorAll("img[data-pending-image]"))) {
        const id = image.dataset.pendingImage;
        const item = pendingImages.get(id);
        if (!item) continue;
        setMessage("正在上传图片并发布……");
        const data = await uploadAsset(item.file);
        image.dataset.remoteSrc = data.url;
        uploaded.push({id, image, path: data.path, sha: data.sha});
      }
      return uploaded;
    } catch (error) {
      error.uploadedAssets = uploaded;
      throw error;
    }
  };

  const cleanupUploadedAssets = async (assets) => {
    for (const asset of assets) {
      try {
        const query = "?path=" + encodeURIComponent(asset.path) + "&sha=" + encodeURIComponent(asset.sha);
        await fetch(apiBase + "/api/assets" + query, {
          method: "DELETE",
          credentials: "include",
          mode: "cors",
          cache: "no-store",
          headers: authHeaders()
        });
      } catch {}
      if (asset.image) delete asset.image.dataset.remoteSrc;
    }
  };

  document.querySelector("#image-button").addEventListener("click", () => { rememberSelection(); imageFile?.click(); });
  document.querySelector("#image-url-button").addEventListener("click", insertImageUrl);
  imageFile?.addEventListener("change", async () => {
    const file = imageFile.files && imageFile.files[0];
    if (file) uploadImage(file);
    imageFile.value = "";
  });

  window.addEventListener("pagehide", () => {
    editor.querySelectorAll("img[data-preview-src]").forEach((image) => {
      URL.revokeObjectURL(image.dataset.previewSrc);
    });
    pendingImages.clear();
  });

  const escapeHtml = (value) => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const inlineMarkdown = (value) => {
    let html = escapeHtml(value);
    html = html.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g, '<img src="$2" alt="$1" loading="lazy">');
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    html = html.replace(/_([^_]+)_/g, "<em>$1</em>");
    return html;
  };

  const markdownToHtml = (source) => {
    const lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
    const output = [];
    let paragraph = [];
    let listType = null;
    let listItems = [];
    let codeLines = null;

    const flushParagraph = () => {
      if (!paragraph.length) return;
      output.push("<p>" + paragraph.map(inlineMarkdown).join("<br>") + "</p>");
      paragraph = [];
    };
    const flushList = () => {
      if (!listType) return;
      const tag = listType === "ol" ? "ol" : "ul";
      output.push("<" + tag + ">" + listItems.map((item) => "<li>" + inlineMarkdown(item) + "</li>").join("") + "</" + tag + ">");
      listType = null;
      listItems = [];
    };
    const flushCode = () => {
      if (codeLines === null) return;
      output.push("<pre><code>" + escapeHtml(codeLines.join("\n")) + "</code></pre>");
      codeLines = null;
    };
    const flushBlocks = () => { flushParagraph(); flushList(); };

    for (const line of lines) {
      if (/^\s*```/.test(line)) {
        flushBlocks();
        if (codeLines === null) codeLines = [];
        else flushCode();
        continue;
      }
      if (codeLines !== null) {
        codeLines.push(line);
        continue;
      }
      if (!line.trim()) {
        flushBlocks();
        continue;
      }
      const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        flushBlocks();
        const level = Math.min(heading[1].length, 6);
        output.push("<h" + level + ">" + inlineMarkdown(heading[2]) + "</h" + level + ">");
        continue;
      }
      const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (unordered || ordered) {
        flushParagraph();
        const nextType = ordered ? "ol" : "ul";
        if (listType && listType !== nextType) flushList();
        listType = nextType;
        listItems.push((unordered || ordered)[1]);
        continue;
      }
      const quote = line.match(/^\s*>\s?(.*)$/);
      if (quote) {
        flushBlocks();
        output.push("<blockquote>" + inlineMarkdown(quote[1]) + "</blockquote>");
        continue;
      }
      if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
        flushBlocks();
        output.push("<hr>");
        continue;
      }
      paragraph.push(line);
    }
    flushBlocks();
    flushCode();
    return output.join("");
  };

  const looksLikeMarkdown = (text) => /(^|\n)\s*(#{1,6}\s|[-*+]\s+|\d+[.)]\s+|>\s|```)|!\[[^\]]*\]\(|\[[^\]]+\]\([^)]*\)/m.test(text);

  const insertHtmlAtCaret = (html) => {
    editor.focus();
    const selection = window.getSelection();
    const range = savedRange || (selection && selection.rangeCount ? selection.getRangeAt(0) : null);
    if (!range) {
      editor.insertAdjacentHTML("beforeend", html);
      return;
    }
    range.deleteContents();
    const template = document.createElement("template");
    template.innerHTML = html;
    const fragment = template.content;
    const lastNode = fragment.lastChild;
    range.insertNode(fragment);
    if (lastNode) {
      range.setStartAfter(lastNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      savedRange = range.cloneRange();
    }
  };

  editor.addEventListener("paste", async (event) => {
    const files = Array.from(event.clipboardData?.files || []).filter((file) => String(file.type || "").startsWith("image/"));
    if (files.length) {
      event.preventDefault();
      for (const file of files) await uploadImage(file, file.name.replace(/\.[^.]+$/, ""));
      return;
    }
    const text = event.clipboardData?.getData("text/plain") || "";
    const html = event.clipboardData?.getData("text/html") || "";
    if (text && !html && looksLikeMarkdown(text)) {
      event.preventDefault();
      insertHtmlAtCaret(markdownToHtml(text));
      updatePreview();
      saveLocalDraft();
    }
  });

  editor.addEventListener("dragover", (event) => {
    if (Array.from(event.dataTransfer?.items || []).some((item) => item.kind === "file" && item.type.startsWith("image/"))) {
      event.preventDefault();
      editor.classList.add("drop-ready");
    }
  });
  editor.addEventListener("dragleave", () => editor.classList.remove("drop-ready"));
  editor.addEventListener("drop", async (event) => {
    const files = Array.from(event.dataTransfer?.files || []).filter((file) => String(file.type || "").startsWith("image/"));
    editor.classList.remove("drop-ready");
    if (!files.length) return;
    event.preventDefault();
    for (const file of files) await uploadImage(file, file.name.replace(/\.[^.]+$/, ""));
  });

  const formulaDialog = document.querySelector("#formula-dialog");
  const formulaInput = document.querySelector("#formula-input");
  const formulaPreview = document.querySelector("#formula-preview");

  const renderFormulaPreview = () => {
    const value = formulaInput.value.trim();
    formulaPreview.textContent = value ? "\\[" + value + "\\]" : "公式预览";
    if (window.MathJax && value) window.MathJax.typesetPromise([formulaPreview]).catch(() => {});
  };

  const openFormulaDialog = () => {
    rememberSelection();
    formulaInput.value = "";
    formulaPreview.textContent = "公式预览";
    formulaDialog.hidden = false;
    formulaInput.focus();
  };

  const closeFormulaDialog = () => { formulaDialog.hidden = true; };

  document.querySelector("#formula-button").addEventListener("click", openFormulaDialog);
  document.querySelector("#close-formula").addEventListener("click", closeFormulaDialog);
  formulaDialog.addEventListener("click", (event) => {
    if (event.target === formulaDialog) closeFormulaDialog();
  });
  formulaInput.addEventListener("input", renderFormulaPreview);

  document.querySelectorAll("[data-formula-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const latex = formulaInput.value.trim();
      if (!latex) {
        formulaInput.focus();
        return;
      }
      const display = button.dataset.formulaMode === "block";
      const node = document.createElement(display ? "div" : "span");
      node.className = display ? "formula-block" : "formula-inline";
      node.dataset.latex = latex;
      node.dataset.display = display ? "true" : "false";
      node.textContent = display ? "\\[" + latex + "\\]" : "\\(" + latex + "\\)";
      insertNodeAtCaret(node);
      closeFormulaDialog();
      updatePreview();
      saveLocalDraft();
    });
  });

  const serializeChildren = (node) => Array.from(node.childNodes).map((child) => serializeNode(child)).join("");

  const cleanInline = (value) => value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ");

  const listItemMarkdown = (node) => cleanInline(serializeChildren(node))
    .replace(/\n{2,}/g, "\n")
    .trim()
    .replace(/\n/g, "\n  ");

  const serializeNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.replace(/\u00a0/g, " ");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = node.tagName.toLowerCase();

    if (node.dataset && node.dataset.latex) {
      const latex = node.dataset.latex.trim();
      return node.dataset.display === "true"
        ? "\n\n$$\n" + latex + "\n$$\n\n"
        : "$" + latex + "$";
    }

    if (tag === "br") return "\n";
    if (tag === "p") return cleanInline(serializeChildren(node)).trim() + "\n\n";
    if (tag === "div") return cleanInline(serializeChildren(node)).trim() + "\n\n";
    if (tag === "h2") return "\n## " + cleanInline(serializeChildren(node)).trim() + "\n\n";
    if (tag === "h3") return "\n### " + cleanInline(serializeChildren(node)).trim() + "\n\n";
    if (tag === "strong" || tag === "b") return "**" + serializeChildren(node).trim() + "**";
    if (tag === "em" || tag === "i") return "*" + serializeChildren(node).trim() + "*";
    if (tag === "code") {
      const tick = String.fromCharCode(96);
      return tick + node.textContent.trim() + tick;
    }
    if (tag === "pre") {
      const fence = String.fromCharCode(96).repeat(3);
      return "\n\n" + fence + "\n" + node.textContent.replace(/^\n+|\n+$/g, "") + "\n" + fence + "\n\n";
    }
    if (tag === "blockquote") {
      const value = cleanInline(serializeChildren(node)).trim();
      return "\n\n" + value.split("\n").map((line) => "> " + line).join("\n") + "\n\n";
    }
    if (tag === "ul") {
      return Array.from(node.children).map((item) => "- " + listItemMarkdown(item)).join("\n") + "\n\n";
    }
    if (tag === "ol") {
      return Array.from(node.children).map((item, index) => (index + 1) + ". " + listItemMarkdown(item)).join("\n") + "\n\n";
    }
    if (tag === "li") return listItemMarkdown(node);
    if (tag === "a") {
      const label = cleanInline(serializeChildren(node)).trim() || node.href;
      return "[" + label + "](" + node.href + ")";
    }
    if (tag === "img") {
      const source = node.dataset && node.dataset.remoteSrc ? node.dataset.remoteSrc : node.src;
      return "![" + (node.alt || "") + "](" + source + ")\n\n";
    }
    if (tag === "hr") return "\n\n---\n\n";
    return serializeChildren(node);
  };

  const htmlToMarkdown = () => serializeChildren(editor)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  const updatePreview = () => {
    bodyField.value = htmlToMarkdown();
    const clone = editor.cloneNode(true);
    clone.querySelectorAll("[data-latex]").forEach((node) => {
      const value = node.dataset.latex || "";
      node.textContent = node.dataset.display === "true" ? "\\[" + value + "\\]" : "\\(" + value + "\\)";
    });
    clone.querySelectorAll("img[data-preview-src]").forEach((node) => {
      if (node.dataset.previewSrc) node.src = node.dataset.previewSrc;
    });
    preview.innerHTML = clone.innerHTML.trim()
      ? clone.innerHTML
      : '<p class="preview-empty">正文写到这里后，预览会出现在这边。</p>';
    const count = bodyField.value.replace(/[#*_$\\[\](){}<>]/g, " ").trim().length;
    wordCount.textContent = count + " 字";
    readTime.textContent = "预计 " + Math.max(1, Math.ceil(count / 450)) + " 分钟阅读";
    if (window.MathJax && preview.textContent.trim()) window.MathJax.typesetPromise([preview]).catch(() => {});
  };

  const saveLocalDraft = () => {
    if (editor.querySelector("img[data-pending-image]")) {
      localStorage.removeItem(localDraftKey);
      return;
    }
    if (!editor.innerHTML.trim() && !titleField.value.trim()) return;
    localStorage.setItem(localDraftKey, JSON.stringify({
      title: titleField.value,
      slug: slugField.value,
      date: dateField.value,
      description: descriptionField.value,
      tags: tagsField.value,
      html: editor.innerHTML,
      savedAt: new Date().toISOString()
    }));
    document.querySelector("#clear-draft").hidden = false;
  };

  const loadLocalDraft = () => {
    try { return JSON.parse(localStorage.getItem(localDraftKey) || "null"); } catch { return null; }
  };

  if (loadLocalDraft()) document.querySelector("#restore-draft").hidden = false;

  document.querySelector("#restore-draft").addEventListener("click", () => {
    const draft = loadLocalDraft();
    if (!draft) return;
    titleField.value = draft.title || "";
    slugField.value = draft.slug || "";
    slugTouched = Boolean(draft.slug);
    dateField.value = draft.date || today;
    descriptionField.value = draft.description || "";
    tagsField.value = draft.tags || "";
    editor.innerHTML = draft.html || "";
    editor.querySelectorAll("img[data-remote-src]").forEach((image) => {
      if (!image.src || image.src.startsWith("blob:")) image.src = image.dataset.remoteSrc;
    });
    document.querySelector("#restore-draft").hidden = true;
    updatePreview();
    setMessage("已恢复本地草稿。", "success");
  });

  document.querySelector("#clear-draft").addEventListener("click", () => {
    localStorage.removeItem(localDraftKey);
    document.querySelector("#clear-draft").hidden = true;
    document.querySelector("#restore-draft").hidden = true;
    setMessage("本地草稿已清空。", "");
  });

  editor.addEventListener("input", () => {
    cleanupPendingImages();
    updatePreview();
    window.clearTimeout(editor._draftTimer);
    editor._draftTimer = window.setTimeout(saveLocalDraft, 350);
  });
  [titleField, slugField, dateField, descriptionField, tagsField].forEach((field) => {
    field.addEventListener("input", () => {
      updatePreview();
      window.clearTimeout(field._draftTimer);
      field._draftTimer = window.setTimeout(saveLocalDraft, 350);
    });
  });

  const setMessage = (text, kind = "") => {
    message.textContent = text;
    message.className = "form-message" + (kind ? " " + kind : "");
  };

  const inferResearchTags = (source) => {
    const normalized = String(source || "").toLowerCase();
    const axes = [
      {
        slug: "efficient-inference",
        keywords: ["推理", "attention", "kv cache", "kv-cache", "量化", "稀疏", "模型架构", "inference", "serving"]
      },
      {
        slug: "memory-continual-learning",
        keywords: ["记忆", "持续学习", "test-time", "ttt", "fast weight", "memory", "continual", "记忆库"]
      },
      {
        slug: "interpretability-embodiment",
        keywords: ["可解释", "具身", "身体", "环境反馈", "interpretability", "embodiment", "agent"]
      }
    ];
    return axes
      .filter((axis) => axis.keywords.some((keyword) => normalized.includes(keyword)))
      .map((axis) => axis.slug);
  };

  const savePost = async (draft) => {
    cleanupPendingImages();
    updatePreview();
    const title = titleField.value.trim();
    const initialBody = bodyField.value.trim();
    const pendingCount = editor.querySelectorAll("img[data-pending-image]").length;

    if (!title || !initialBody) {
      setMessage("先填写标题和正文。", "error");
      return;
    }
    if (!apiBase) {
      setMessage("发布接口还没有配置。", "error");
      return;
    }
    if (draft && pendingCount) {
      setMessage("草稿不会上传图片；点击发布后才会保存图片。", "error");
      return;
    }

    let uploadedAssets = [];
    if (!draft && pendingCount) {
      try {
        uploadedAssets = await uploadPendingImages();
      } catch (error) {
        if (error.uploadedAssets && error.uploadedAssets.length) {
          await cleanupUploadedAssets(error.uploadedAssets);
        }
        setMessage(error.message || "图片上传失败，未发布文章。", "error");
        return;
      }
    }

    updatePreview();
    const body = bodyField.value.trim();
    setMessage(draft ? "正在保存草稿……" : "正在发布……");
    const payload = {
      title,
      slug: slugField.value.trim() || latinSlug(title),
      date: dateField.value || today,
      description: descriptionField.value.trim(),
      tags: Array.from(new Set([
        ...tagsField.value.split(",").map((tag) => tag.trim()).filter(Boolean),
        ...inferResearchTags([title, descriptionField.value, tagsField.value, body].join("\n"))
      ])),
      body,
      draft
    };

    try {
      const response = await fetch(apiBase + "/api/posts", {
        method: "POST",
        credentials: "include",
        mode: "cors",
        cache: "no-store",
        headers: {...authHeaders(), "Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "发布失败");

      uploadedAssets.forEach((asset) => {
        pendingImages.delete(asset.id);
        if (asset.image) delete asset.image.dataset.pendingImage;
      });
      setMessage(data.message || (draft ? "草稿已保存。" : "文章已发布。"), "success");
      localStorage.removeItem(localDraftKey);
      document.querySelector("#restore-draft").hidden = true;
      document.querySelector("#clear-draft").hidden = true;
    } catch (error) {
      if (uploadedAssets.length) await cleanupUploadedAssets(uploadedAssets);
      setMessage(error.message, "error");
    }
  };

  document.querySelector("#save-draft").addEventListener("click", () => savePost(true));
  document.querySelector("#publish-button").addEventListener("click", () => savePost(false));
  editorForm.addEventListener("submit", (event) => event.preventDefault());

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "enter" && !editorForm.hidden) {
      event.preventDefault();
      savePost(false);
    }
    if (event.key === "Escape" && !formulaDialog.hidden) closeFormulaDialog();
  });
})();
