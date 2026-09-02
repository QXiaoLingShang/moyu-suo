// 防剧透 tooltip：跟随鼠标位置（.spoiler 悬停时显示“你知道得太多了”）
const TEXT = "你知道得太多了";
const OFFSET_X = 12;
const OFFSET_Y = 14;

let tip: HTMLDivElement | null = null;

function getTip(): HTMLDivElement {
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "spoiler-tip";
    tip.textContent = TEXT;
    document.body.appendChild(tip);
  }
  return tip;
}

// 单监听器全局委托：目标在 .spoiler 内 → 跟着光标走；否则隐藏
document.addEventListener(
  "pointermove",
  (e: PointerEvent) => {
    const el = getTip();
    const over = (e.target as HTMLElement).closest?.(".spoiler");
    if (over) {
      el.style.left = `${e.clientX + OFFSET_X}px`;
      el.style.top = `${e.clientY + OFFSET_Y}px`;
      el.classList.add("visible");
    } else {
      el.classList.remove("visible");
    }
  },
  { passive: true },
);
