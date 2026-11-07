
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
  const researchAreaField = document.querySelector("#research-area");
  const loginButtons = [
    document.querySelector("#login-button"),
    document.querySelector("#login-button-secondary")
  ].filter(Boolean);
  const logoutButton = document.querySelector("#logout-button");
  const loginButton = document.querySelector("#login-button");
  const sessionLabel = document.querySelector("#session-label");
  const message = document.querySelector("#form-message");
  const wordCount = document.querySelector("#word-count");
  const readTime = document.querySelector("#read-time");
  const today = new Date().toISOString().slice(0, 10);
  const localDraftKey = "metavis-writing-draft-v2";
  let slugTouched = false;
  let savedRange = null;

  const sessionKey = "metavis_session";
  const returnedSession = new URLSearchParams(window.location.hash.slice(1)).get("session");

  const persistSession = (token) => {
    localStorage.setItem(sessionKey, token);
    sessionStorage.setItem(sessionKey, token);
  };

  const clearSession = () => {
    localStorage.removeItem(sessionKey);
    sessionStorage.removeItem(sessionKey);
  };

  const existingSession = localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey);
  if (existingSession && !localStorage.getItem(sessionKey)) {
    localStorage.setItem(sessionKey, existingSession);
  }

  if (returnedSession) {
    persistSession(returnedSession);
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }

  const sessionToken = () => localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey) || "";
  const authHeaders = () => {
    const token = sessionToken();
    return token ? {Authorization: "Bearer " + token} : {};
  };

  const topicFromUrl = new URLSearchParams(window.location.search).get("topic");
  if (topicFromUrl && researchAreaField && Array.from(researchAreaField.options).some((option) => option.value === topicFromUrl)) {
    researchAreaField.value = topicFromUrl;
  }

  dateField.value = today;

  const showLoggedOut = () => {
    loginPanel.hidden = false;
    editorForm.hidden = true;
    loginButton.hidden = false;
    logoutButton.hidden = true;
    sessionLabel.textContent = "";
  };

  const showLoggedIn = (login) => {
    loginPanel.hidden = true;
    editorForm.hidden = false;
    loginButton.hidden = true;
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

  if (!apiBase || apiBase.includes("YOUR-METAVIS-WORKER")) {
    setupPanel.hidden = false;
    loginButton.hidden = true;
  } else {
    fetch(apiBase + "/api/session", {
      credentials: "include",
      mode: "cors",
      headers: authHeaders()
    })
      .then(async (response) => {
        if (response.ok) return response.json();
        if (sessionToken()) clearSession();
        return null;
      })
      .then((data) => (data && data.login ? showLoggedIn(data.login) : showLoggedOut()))
      .catch(() => {
        clearSession();
        showLoggedOut();
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

  document.querySelector("#image-button").addEventListener("click", () => {
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
    if (tag === "img") return "![" + (node.alt || "") + "](" + node.src + ")\n\n";
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
    preview.innerHTML = clone.innerHTML.trim()
      ? clone.innerHTML
      : '<p class="preview-empty">正文写到这里后，预览会出现在这边。</p>';
    const count = bodyField.value.replace(/[#*_$\\[\](){}<>]/g, " ").trim().length;
    wordCount.textContent = count + " 字";
    readTime.textContent = "预计 " + Math.max(1, Math.ceil(count / 450)) + " 分钟阅读";
    if (window.MathJax && preview.textContent.trim()) window.MathJax.typesetPromise([preview]).catch(() => {});
  };

  const saveLocalDraft = () => {
    if (!editor.innerHTML.trim() && !titleField.value.trim()) return;
    localStorage.setItem(localDraftKey, JSON.stringify({
      title: titleField.value,
      slug: slugField.value,
      date: dateField.value,
      description: descriptionField.value,
      tags: tagsField.value,
      researchArea: researchAreaField.value,
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
    researchAreaField.value = draft.researchArea || researchAreaField.value || "";
    editor.innerHTML = draft.html || "";
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
    updatePreview();
    window.clearTimeout(editor._draftTimer);
    editor._draftTimer = window.setTimeout(saveLocalDraft, 350);
  });
  [titleField, slugField, dateField, descriptionField, tagsField, researchAreaField].forEach((field) => {
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

  const savePost = async (draft) => {
    updatePreview();
    const title = titleField.value.trim();
    const body = bodyField.value.trim();
    const researchArea = researchAreaField.value;
    if (!title || !body) {
      setMessage("先填写标题和正文。", "error");
      return;
    }
    if (!researchArea) {
      setMessage("请选择一个研究方向。", "error");
      researchAreaField.focus();
      return;
    }
    if (!apiBase) {
      setMessage("发布接口还没有配置。", "error");
      return;
    }
    setMessage(draft ? "正在保存草稿……" : "正在发布……");
    const payload = {
      title,
      slug: slugField.value.trim() || latinSlug(title),
      date: dateField.value || today,
      description: descriptionField.value.trim(),
      tags: Array.from(new Set([
        researchArea,
        ...tagsField.value.split(",").map((tag) => tag.trim()).filter(Boolean)
      ])),
      research_area: researchArea,
      body,
      draft
    };

    try {
      const response = await fetch(apiBase + "/api/posts", {
        method: "POST",
        credentials: "include",
        mode: "cors",
        headers: {...authHeaders(), "Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "发布失败");
      setMessage(data.message || (draft ? "草稿已保存。" : "文章已发布。"), "success");
      localStorage.removeItem(localDraftKey);
      document.querySelector("#restore-draft").hidden = true;
      document.querySelector("#clear-draft").hidden = true;
    } catch (error) {
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
