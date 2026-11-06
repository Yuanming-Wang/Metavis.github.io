(() => {
  const config = window.METAVIS_CONFIG || {};
  const apiBase = String(config.apiBase || "").replace(/\/$/, "");
  const setupPanel = document.querySelector("#setup-panel");
  const loginPanel = document.querySelector("#login-panel");
  const editorForm = document.querySelector("#editor-form");
  const loginButtons = [
    document.querySelector("#login-button"),
    document.querySelector("#login-button-secondary")
  ].filter(Boolean);
  const logoutButton = document.querySelector("#logout-button");
  const loginButton = document.querySelector("#login-button");
  const sessionLabel = document.querySelector("#session-label");
  const message = document.querySelector("#form-message");
  const today = new Date().toISOString().slice(0, 10);
  const returnedSession = new URLSearchParams(window.location.hash.slice(1)).get("session");
  if (returnedSession) {
    sessionStorage.setItem("metavis_session", returnedSession);
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }
  const sessionToken = () => sessionStorage.getItem("metavis_session") || "";
  const authHeaders = () => {
    const token = sessionToken();
    return token ? {Authorization: "Bearer " + token} : {};
  };

  document.querySelector("#date").value = today;

  if (!apiBase || apiBase.includes("YOUR-METAVIS-WORKER")) {
    setupPanel.hidden = false;
    loginButton.hidden = true;
    return;
  }

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
  };

  const login = () => {
    const returnTo = window.location.href.split("#")[0];
    window.location.href = apiBase + "/auth/login?return_to=" + encodeURIComponent(returnTo);
  };

  loginButtons.forEach((button) => {
    button.addEventListener("click", login);
  });

  logoutButton.addEventListener("click", async () => {
    await fetch(apiBase + "/auth/logout", {
      credentials: "include",
      mode: "cors",
      headers: authHeaders()
    });
    sessionStorage.removeItem("metavis_session");
    showLoggedOut();
  });

  fetch(apiBase + "/api/session", {
    credentials: "include",
    mode: "cors",
    headers: authHeaders()
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => (data && data.login ? showLoggedIn(data.login) : showLoggedOut()))
    .catch(showLoggedOut);

  editorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "正在保存……";
    message.className = "form-message";

    const payload = {
      title: document.querySelector("#title").value.trim(),
      slug: document.querySelector("#slug").value.trim(),
      date: document.querySelector("#date").value,
      description: document.querySelector("#description").value.trim(),
      tags: document.querySelector("#tags").value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      body: document.querySelector("#body").value,
      draft: document.querySelector("#draft").checked
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
      if (!response.ok) {
        throw new Error(data.error || "发布失败");
      }
      message.textContent = data.message || "已保存。GitHub Actions 会自动更新网站。";
      message.className = "form-message success";
      editorForm.reset();
      document.querySelector("#date").value = today;
      document.querySelector("#draft").checked = true;
    } catch (error) {
      message.textContent = error.message;
      message.className = "form-message error";
    }
  });
})();
