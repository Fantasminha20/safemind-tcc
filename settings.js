import { auth } from "./firebase-init.js";
import {
  updateProfile,
  updatePassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { currentUser, logout, clearLocalSession } from "./auth-helpers.js";
import {
  loadUserDoc,
  saveDiaryEnabled,
  saveAccountName,
  saveProfessionalName,
  getProfessional,
  isAdmin,
  exportAccountData,
  deleteAccountData,
} from "./firestore-data.js";
import { passwordStrength } from "./password-ui.js";

const $ = (id) => document.getElementById(id);
const root = document.documentElement;

const AUTH_ERRORS = {
  "auth/wrong-password": "Senha atual incorreta.",
  "auth/invalid-credential": "Senha atual incorreta.",
  "auth/weak-password": "A nova senha está fraca demais. Use pelo menos 8 caracteres.",
  "auth/requires-recent-login": "Por segurança, saia, entre de novo e repita a ação.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde um instante e tente de novo.",
  "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente novamente.",
  "auth/popup-closed-by-user": "A janela do Google foi fechada antes de concluir.",
  "auth/popup-blocked": "O navegador bloqueou a janela do Google. Permita pop-ups e tente de novo.",
  "auth/user-mismatch": "Use a mesma conta Google com a qual você entrou.",
};

function setStatus(id, message, isError = false) {
  const node = $(id);
  node.textContent = message;
  node.classList.toggle("settings-status--error", isError);
}

const authMessage = (error, fallback) => {
  console.error(error.code || error.name, error.message);
  return AUTH_ERRORS[error.code] || fallback;
};

(async () => {
  const user = await currentUser();
  if (!user) {
    location.replace("login.html?next=configuracoes.html");
    return;
  }

  let account = null;
  let professional = null;
  try {
    [account, professional] = await Promise.all([loadUserDoc(user.uid), getProfessional(user.uid)]);
  } catch (error) {
    console.error("Firestore:", error.code);
  }

  const admin = await isAdmin(user.uid);
  const hasPassword = user.providerData.some((p) => p.providerId === "password");
  const hasGoogle = user.providerData.some((p) => p.providerId === "google.com");

  /* ---------- Conta ---------- */
  $("back-link").href = admin ? "admin.html" : professional ? "psicologo.html" : "paciente.html";
  $("account-name").value = user.displayName || account?.name || "";
  $("account-email").value = user.email || "";
  const STATUS = { pending: "em análise", approved: "aprovado", rejected: "não aprovado" };
  $("account-meta").textContent =
    `Tipo de conta: ${admin ? "Administrador" : professional ? "Psicólogo(a)" : "Paciente"} · Entrada: ` +
    [hasPassword && "e-mail e senha", hasGoogle && "Google"].filter(Boolean).join(" e ");

  $("name-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("account-name").value.trim();
    if (name.length < 2) return setStatus("name-status", "Digite seu nome (mínimo 2 letras).", true);
    const button = event.submitter;
    button.disabled = true;
    setStatus("name-status", "Salvando...");
    try {
      await updateProfile(user, { displayName: name });
      await saveAccountName(user.uid, name);
      let warning = "";
      if (professional) {
        try {
          await saveProfessionalName(user.uid, name);
        } catch (error) {
          console.error("Firestore:", error.code);
          warning =
            " O nome do perfil profissional não foi atualizado; edite-o em Editar perfil.";
        }
      }
      setStatus("name-status", "Nome atualizado." + warning, Boolean(warning));
    } catch (error) {
      setStatus("name-status", authMessage(error, "Não foi possível salvar agora."), true);
    }
    button.disabled = false;
  });

  /* ---------- Senha (só contas com e-mail e senha) ---------- */
  if (hasPassword) {
    $("password-section").hidden = false;
    $("password-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const current = $("current-password").value;
      const next = $("new-password").value;
      if (next !== $("confirm-password").value)
        return setStatus("password-status", "As senhas novas não coincidem.", true);
      if (passwordStrength(next).level < 2)
        return setStatus(
          "password-status",
          "A nova senha está fraca demais. Use pelo menos 8 caracteres e evite senhas comuns.",
          true,
        );
      const button = event.submitter;
      button.disabled = true;
      setStatus("password-status", "Verificando...");
      try {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
        await updatePassword(user, next);
        event.target.reset();
        event.target.querySelector(".pw-meter")?.setAttribute("hidden", "");
        setStatus("password-status", "Senha alterada com sucesso.");
      } catch (error) {
        setStatus("password-status", authMessage(error, "Não foi possível alterar a senha."), true);
      }
      button.disabled = false;
    });
  }

  /* ---------- Paciente: diário ---------- */
  if (!professional && !admin) {
    $("patient-section").hidden = false;
    let enabled = account?.diaryEnabled;
    if (typeof enabled !== "boolean") {
      try {
        enabled = localStorage.getItem("safemind-diary-enabled") === "true";
      } catch {
        enabled = false;
      }
    }
    $("diary-toggle").checked = enabled;
    $("diary-toggle").addEventListener("change", async (event) => {
      const value = event.target.checked;
      try {
        await saveDiaryEnabled(user.uid, value);
        try {
          localStorage.setItem("safemind-diary-enabled", String(value));
          sessionStorage.setItem("safemind-diary-choice", value ? "sim" : "nao");
        } catch {}
        setStatus("diary-status", value ? "Diário ativado." : "Diário desativado.");
      } catch (error) {
        console.error("Firestore:", error.code);
        event.target.checked = !value;
        setStatus("diary-status", "Não foi possível salvar agora.", true);
      }
    });
  } else if (professional) {
    $("professional-section").hidden = false;
    $("professional-meta").textContent =
      `CRP ${professional.crp} · Cadastro ${STATUS[professional.status] || professional.status}.`;
  }

  /* ---------- Exportar dados ---------- */
  $("export-button").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    setStatus("export-status", "Reunindo seus dados...");
    try {
      const data = await exportAccountData(user.uid);
      data.account = {
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "safemind-meus-dados.json";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setStatus("export-status", "Arquivo baixado.");
    } catch (error) {
      console.error("Firestore:", error.code);
      setStatus("export-status", "Não foi possível reunir os dados agora.", true);
    }
    button.disabled = false;
  });

  /* ---------- Apagar conta ---------- */
  const deleteForm = $("delete-form");
  const deleteOpen = $("delete-open");
  const confirmInput = $("delete-confirm");
  const deleteSubmit = $("delete-submit");
  const passwordWrap = $("delete-password-wrap");
  const passwordInput = $("delete-password");
  passwordWrap.hidden = !hasPassword;
  passwordInput.required = hasPassword;
  $("delete-hint").textContent = hasPassword
    ? "Por segurança, vamos confirmar a sua senha."
    : "Por segurança, vamos pedir que você confirme com o Google.";

  function refreshDeleteButton() {
    deleteSubmit.disabled =
      confirmInput.value.trim().toUpperCase() !== "APAGAR" || (hasPassword && !passwordInput.value);
  }
  confirmInput.addEventListener("input", refreshDeleteButton);
  passwordInput.addEventListener("input", refreshDeleteButton);
  deleteOpen.addEventListener("click", () => {
    deleteForm.hidden = false;
    deleteOpen.setAttribute("aria-expanded", "true");
    confirmInput.focus();
  });
  $("delete-cancel").addEventListener("click", () => {
    deleteForm.reset();
    deleteForm.hidden = true;
    deleteOpen.setAttribute("aria-expanded", "false");
    setStatus("delete-status", "");
    refreshDeleteButton();
  });

  deleteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    refreshDeleteButton();
    if (deleteSubmit.disabled) return;
    deleteSubmit.disabled = true;
    setStatus("delete-status", "Confirmando sua identidade...");
    try {
      if (hasPassword)
        await reauthenticateWithCredential(
          user,
          EmailAuthProvider.credential(user.email, passwordInput.value),
        );
      else await reauthenticateWithPopup(user, new GoogleAuthProvider());
    } catch (error) {
      setStatus("delete-status", authMessage(error, "Não foi possível confirmar sua identidade."), true);
      refreshDeleteButton();
      return;
    }
    try {
      setStatus("delete-status", "Apagando seus dados...");
      await deleteAccountData(user.uid);
    } catch (error) {
      console.error("Firestore:", error.code);
      setStatus(
        "delete-status",
        "Não foi possível apagar todos os dados. Seu login continua ativo; tente de novo.",
        true,
      );
      refreshDeleteButton();
      return;
    }
    try {
      await deleteUser(user);
    } catch (error) {
      console.error(error.code, error.message);
      setStatus(
        "delete-status",
        "Seus dados foram apagados, mas não conseguimos encerrar o login. Saia, entre de novo e repita o pedido.",
        true,
      );
      return;
    }
    clearLocalSession();
    try {
      localStorage.removeItem("safemind-diary-enabled");
    } catch {}
    const app = $("settings-app");
    const done = document.createElement("section");
    done.className = "settings-card";
    const h = document.createElement("h1");
    h.textContent = "Conta apagada";
    const p = document.createElement("p");
    p.textContent = "Seus dados foram removidos. Você será levado à página inicial.";
    done.append(h, p);
    app.replaceChildren(done);
    setTimeout(() => location.replace("boas-vindas.html"), 3000);
  });

  $("settings-logout").addEventListener("click", async () => {
    try {
      await logout();
    } catch {}
    location.href = "boas-vindas.html";
  });

  root.classList.remove("auth-pending");
  $("settings-app").hidden = false;
})();
