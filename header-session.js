// Páginas públicas: troca "Entrar / Cadastrar" por "Minha área / Sair" quando há sessão.
import { currentUser, logout } from "./auth-helpers.js";

const actions = document.querySelector(".site-header .header-actions");
if (actions) {
  currentUser()
    .then((user) => {
      if (!user) return;
      const area = document.createElement("a");
      area.className = "btn btn--dark btn--sm";
      area.href = "paciente.html";
      area.textContent = "Minha área";
      area.title = user.displayName || user.email || "";
      const out = document.createElement("button");
      out.type = "button";
      out.className = "btn btn--outline btn--sm";
      out.textContent = "Sair";
      out.addEventListener("click", async () => {
        out.disabled = true;
        try {
          await logout();
        } catch {}
        location.reload();
      });
      actions.replaceChildren(area, out);
    })
    .catch(() => {});
}
