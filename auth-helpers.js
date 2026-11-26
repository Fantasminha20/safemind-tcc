import { auth } from "./firebase-init.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Resolve com o usuário atual (ou null) assim que o Firebase restaura a sessão.
export function currentUser() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      resolve(user);
    });
  });
}

// Só aceita voltar para páginas internas conhecidas.
export function safeDestination(raw, fallback = "paciente.html") {
  const [file, hash = ""] = String(raw || "").split("#");
  if (!["paciente.html", "index.html", "psicologo.html", "admin.html", "onboarding-profissional.html", "configuracoes.html"].includes(file)) return fallback;
  return /^[a-z]{1,20}$/.test(hash) ? `${file}#${hash}` : file;
}

export function clearLocalSession() {
  try {
    [
      "safemind-quiz-completed",
      "safemind-preferences",
      "safemind-prefs-synced",
      "safemind-session-uid",
      "safemind-diary-choice",
      "safemind-welcome",
    ].forEach((key) => sessionStorage.removeItem(key));
  } catch {}
}

export async function logout() {
  try {
    await signOut(auth);
  } finally {
    clearLocalSession();
  }
}

// Tela de carregamento (#page-loader nas páginas de login e cadastro).
export function showLoader(text = "Carregando...") {
  const loader = document.getElementById("page-loader");
  if (!loader) return;
  const label = loader.querySelector(".page-loader__text");
  if (label) label.textContent = text;
  loader.classList.remove("is-hidden");
}

export function hideLoader() {
  document.getElementById("page-loader")?.classList.add("is-hidden");
}
