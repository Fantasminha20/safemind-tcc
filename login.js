import { auth } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { currentUser, safeDestination, showLoader, hideLoader } from "./auth-helpers.js";
import { ensureUserDoc, getProfessional, isAdmin } from "./firestore-data.js";

const form = document.getElementById("login-form");
const errorBox = document.getElementById("form-error");
const statusBox = document.getElementById("form-status");
const submitBtn = document.getElementById("login-submit");
const googleBtn = document.getElementById("google-btn");
const resetLink = document.getElementById("reset-link");

const nextParam = new URLSearchParams(location.search).get("next");

// Sem "next": administrador vai ao painel, psicólogo à área profissional, o resto ao paciente.
async function destinationFor(user) {
  if (nextParam) return safeDestination(nextParam);
  try {
    if (await isAdmin(user.uid)) return "admin.html";
    if (await getProfessional(user.uid)) return "psicologo.html";
  } catch (error) {
    console.error("Firestore:", error.code);
  }
  return "paciente.html";
}

let busy = false;
// Quem já está com sessão ativa não precisa entrar de novo.
currentUser().then(async (user) => {
  if (busy) return;
  if (user) {
    showLoader("Entrando na sua conta...");
    location.replace(await destinationFor(user));
  } else hideLoader();
});

const ERROR_MESSAGES = {
  "auth/invalid-email": "Digite um e-mail válido.",
  "auth/user-disabled": "Esta conta foi desativada.",
  "auth/user-not-found": "Não encontramos uma conta com este e-mail.",
  "auth/wrong-password": "Senha incorreta.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/missing-password": "Digite sua senha.",
  "auth/network-request-failed":
    "Falha de conexão. Verifique sua internet e tente novamente.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde um instante e tente de novo.",
  "auth/popup-closed-by-user": "A janela do Google foi fechada antes de concluir.",
  "auth/popup-blocked": "O navegador bloqueou a janela do Google. Permita pop-ups e tente de novo.",
  "auth/unauthorized-domain":
    "Este domínio não está autorizado no Firebase (Authentication > Configurações > Domínios autorizados).",
};

function friendlyError(error) {
  console.error("Falha no login:", error.code, error.message);
  return (
    ERROR_MESSAGES[error.code] ||
    `Não foi possível entrar. Tente novamente em instantes. (código: ${error.code || "desconhecido"})`
  );
}

function showError(message) {
  statusBox.hidden = true;
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function showStatus(message) {
  errorBox.hidden = true;
  statusBox.textContent = message;
  statusBox.hidden = false;
}

function clearMessages() {
  errorBox.hidden = true;
  statusBox.hidden = true;
}

function setLoading(isLoading, overlay = true) {
  busy = isLoading;
  if (overlay) (isLoading ? showLoader("Entrando...") : hideLoader());
  submitBtn.disabled = isLoading;
  googleBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Entrando..." : "Entrar";
}

async function finish(credential) {
  showLoader("Preparando sua conta...");
  // Garante o documento da conta no Firestore (cobre o primeiro login com Google).
  try {
    await ensureUserDoc(credential.user);
  } catch (error) {
    console.error("Firestore:", error.code);
  }
  location.href = await destinationFor(credential.user);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessages();
  const email = form.email.value.trim();
  const senha = form.senha.value;
  if (!email || !senha) {
    showError("Preencha e-mail e senha.");
    return;
  }
  setLoading(true);
  try {
    await finish(await signInWithEmailAndPassword(auth, email, senha));
  } catch (error) {
    showError(friendlyError(error));
    setLoading(false);
  }
});

googleBtn.addEventListener("click", async () => {
  clearMessages();
  setLoading(true, false); // a tela de carregamento só entra depois do popup do Google
  try {
    await finish(await signInWithPopup(auth, new GoogleAuthProvider()));
  } catch (error) {
    showError(friendlyError(error));
    setLoading(false);
  }
});

resetLink.addEventListener("click", async () => {
  clearMessages();
  const email = form.email.value.trim();
  if (!email) {
    showError("Digite seu e-mail acima para recuperar a senha.");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showStatus("Se houver uma conta com este e-mail, enviamos um link de recuperação.");
  } catch (error) {
    showError(friendlyError(error));
  }
});
