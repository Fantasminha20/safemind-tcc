(() => {
  const root = document.documentElement;
  let savedTheme;
  try {
    savedTheme = localStorage.getItem("safemind-theme");
  } catch {}
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  let explicitChoice = savedTheme === "dark" || savedTheme === "light";
  function applyTheme(theme) {
    root.dataset.theme = theme;
    const dark = theme === "dark";
    document.querySelectorAll(".brand-image").forEach((logo) => {
      const darkBackground = dark || logo.closest(".site-footer");
      logo.src = darkBackground ? "brand-dark.svg" : "brand-light.svg";
    });
    document.querySelectorAll(".theme-toggle").forEach((button) => {
      button.textContent = dark ? "☀ Modo claro" : "☾ Modo escuro";
      button.setAttribute("aria-pressed", String(dark));
      button.setAttribute(
        "aria-label",
        dark ? "Ativar modo claro" : "Ativar modo escuro",
      );
    });
  }
  applyTheme(explicitChoice ? savedTheme : systemTheme.matches ? "dark" : "light");
  document.addEventListener("DOMContentLoaded", () => {
    const actions = document.querySelector(".header-actions");
    if (!actions) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    button.addEventListener("click", () => {
      const theme = root.dataset.theme === "dark" ? "light" : "dark";
      explicitChoice = true;
      applyTheme(theme);
      try {
        localStorage.setItem("safemind-theme", theme);
      } catch {}
    });
    actions.prepend(button);
    applyTheme(root.dataset.theme);
  });
  systemTheme.addEventListener("change", (event) => {
    if (!explicitChoice) applyTheme(event.matches ? "dark" : "light");
  });
})();
