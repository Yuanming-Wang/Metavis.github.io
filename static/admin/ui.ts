type ResearchArea =
  | "efficient-inference"
  | "memory-continual-learning"
  | "interpretability-embodiment";

interface AreaInfo {
  label: string;
  short: string;
}

const AREA_INFO: Record<ResearchArea, AreaInfo> = {
  "efficient-inference": {
    label: "高效模型架构与推理优化",
    short: "COMPUTE / ARCHITECTURE"
  },
  "memory-continual-learning": {
    label: "神经记忆与持续学习",
    short: "STATE / LEARNING"
  },
  "interpretability-embodiment": {
    label: "机制可解释性与具身智能",
    short: "MECHANISM / EMBODIMENT"
  }
};

const areaSelect = document.querySelector<HTMLSelectElement>("#research-area");
const areaBadge = document.querySelector<HTMLElement>("#area-badge");
const editor = document.querySelector<HTMLElement>("#editor");
const wordCount = document.querySelector<HTMLElement>("#word-count");
const readTime = document.querySelector<HTMLElement>("#read-time");
const toolbarButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-command]")
);

const updateAreaBadge = (): void => {
  if (!areaSelect || !areaBadge) return;
  const area = areaSelect.value as ResearchArea;
  const info = AREA_INFO[area];
  areaBadge.textContent = info ? info.label : "请选择研究方向";
  areaBadge.dataset.selected = info ? "true" : "false";
  areaBadge.title = info ? info.short : "文章会归入对应研究区";
};

const updateWritingState = (): void => {
  if (!editor || !wordCount || !readTime) return;
  const text = editor.innerText.trim();
  const count = text.length;
  wordCount.textContent = count + " 字";
  readTime.textContent = "预计 " + Math.max(1, Math.ceil(count / 450)) + " 分钟阅读";
};

const wireToolbarState = (): void => {
  toolbarButtons.forEach((button) => {
    button.addEventListener("click", () => {
      toolbarButtons.forEach((item) => item.classList.remove("active-format"));
      button.classList.add("active-format");
    });
  });
};

areaSelect?.addEventListener("change", updateAreaBadge);
editor?.addEventListener("input", updateWritingState);
wireToolbarState();
updateAreaBadge();
updateWritingState();
