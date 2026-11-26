// Porta de entrada da Área do paciente (módulo):
// 1) exige login (Firebase Auth); 2) sincroniza o quiz com a conta (Firestore);
// 3) mostra nome + Sair. Os outros módulos aguardam `session`.
import { currentUser, logout } from "./auth-helpers.js";
import { ensureUserDoc, loadUserDoc, savePreferences } from "./firestore-data.js";

const root = document.documentElement;
const panels = ["inicio", "profissionais", "diario", "preferencias"];
const requested = location.hash.slice(1);
const destination = panels.includes(requested) ? requested : "inicio";
const never = new Promise(() => {});

const store = {
  get: (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {}
  },
  remove: (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  },
};

function applyDiaryFlag(enabled) {
  store.set("safemind-diary-choice", enabled ? "sim" : "nao");
  try {
    localStorage.setItem("safemind-diary-enabled", String(enabled));
  } catch {}
}

// Retorna true quando o quiz já foi respondido (nesta sessão ou salvo na conta).
async function syncQuiz(user) {
  // Outra pessoa usou esta aba antes: não herdar respostas dela.
  const previous = store.get("safemind-session-uid");
  if (previous && previous !== user.uid) {
    ["safemind-quiz-completed", "safemind-preferences", "safemind-prefs-synced"].forEach(
      store.remove,
    );
  }
  store.set("safemind-session-uid", user.uid);

  const completedHere = store.get("safemind-quiz-completed") === "1";
  const synced = store.get("safemind-prefs-synced") === "1";
  let local = null;
  try {
    local = JSON.parse(store.get("safemind-preferences") || "null");
  } catch {}

  // Respostas novas feitas nesta sessão: grava na conta.
  if (completedHere && local?.answers && !synced) {
    try {
      await savePreferences(user.uid, local);
      store.set("safemind-prefs-synced", "1");
    } catch (error) {
      console.error("Firestore:", error.code);
    }
    return true;
  }
  if (completedHere) return true;

  // Sessão nova: traz da conta o que já foi respondido.
  try {
    const account = await loadUserDoc(user.uid);
    if (account?.preferences?.answers) {
      store.set("safemind-preferences", JSON.stringify(account.preferences));
      store.set("safemind-quiz-completed", "1");
      store.set("safemind-prefs-synced", "1");
      applyDiaryFlag(
        typeof account.diaryEnabled === "boolean"
          ? account.diaryEnabled
          : account.preferences.answers.diario === "sim",
      );
      return true;
    }
  } catch (error) {
    console.error("Firestore:", error.code);
  }
  return false;
}

function mountSessionUI(user) {
  const actions = document.querySelector(".patient-topbar .header-actions");
  if (!actions) return;
  const name = document.createElement("span");
  name.className = "session-user";
  name.textContent = user.displayName || user.email || "";
  const out = document.createElement("button");
  out.type = "button";
  out.className = "btn btn--outline btn--sm";
  out.textContent = "Sair";
  out.addEventListener("click", async () => {
    out.disabled = true;
    try {
      await logout();
    } catch {}
    location.href = "boas-vindas.html";
  });
  const settings = document.createElement("a");
  settings.className = "btn btn--outline btn--sm";
  settings.href = "configuracoes.html";
  settings.textContent = "⚙ Configurações";
  actions.replaceChildren(name, settings, out);
}

export const session = (async () => {
  const user = await currentUser();
  if (!user) {
    location.replace(
      "login.html?next=" + encodeURIComponent("paciente.html#" + destination),
    );
    return never;
  }
  try {
    await ensureUserDoc(user);
  } catch (error) {
    console.error("Firestore:", error.code);
  }
  if (!(await syncQuiz(user))) {
    location.replace("index.html?destino=" + destination);
    return never;
  }
  mountSessionUI(user);
  root.classList.remove("auth-pending");
  return user;
})();
