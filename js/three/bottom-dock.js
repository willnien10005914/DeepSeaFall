// Compact controls and chat stay at the bottom, away from the swimmer.
export function setupBottomDock() {
  const app = document.querySelector("#app"),
    dock = document.querySelector("#bottomDock"),
    button = document.querySelector("#btnToggleControls");
  let collapsed = false;
  try { collapsed = localStorage.getItem("deepseaControlsCollapsed") === "true"; } catch {}
  const apply = () => {
    dock.classList.toggle("controls-collapsed", collapsed);
    button.setAttribute("aria-expanded", String(!collapsed));
    button.textContent = collapsed ? "展開操作 ▴" : "收起操作 ▾";
  };
  button.addEventListener("click", () => {
    collapsed = !collapsed;
    apply();
    try { localStorage.setItem("deepseaControlsCollapsed", String(collapsed)); } catch {}
  });
  // Keep the message composer above the software keyboard on mobile browsers.
  const viewport = window.visualViewport;
  const fitKeyboard = () => {
    const inset = viewport
      ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
    app.style.setProperty("--keyboard-inset", `${inset}px`);
  };
  viewport?.addEventListener("resize", fitKeyboard);
  viewport?.addEventListener("scroll", fitKeyboard);
  fitKeyboard();
  apply();
}
