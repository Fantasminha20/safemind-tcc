import { auth } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { currentUser, safeDestination, showLoader, hideLoader } from "./auth-helpers.js";
import { ensureUserDoc } from "./firestore-data.js";
import { passwordStrength } from "./password-ui.js";

const form = document.getElementById("cadastro-form");
const errorBox = document.getElementById("form-error");
const submitBtn = document.getElementById("cadastro-submit");
const googleBtn = document.getElementById("google-btn");

const destination = safeDestination(new URLSearchParams(location.search).get("next"));

let busy = false;
currentUser().then((user) => {
  if (busy) return;
  if (user) {
    showLoader("Entrando na sua conta...");
    location.replace(destination);
  } else hideLoader();
});

const ERROR_MESSAGES = {
  "auth/email-already-in-use": "Este e-mail já está cadastrado. Tente entrar na sua conta.",
  "auth/invalid-email": "Digite um e-mail válido.",
  "auth/weak-password": "A senha está fraca demais. Use pelo menos 8 caracteres.",
  "auth/network-request-failed":
    "Falha de conexão. Verifique sua internet e tente novamente.",
  "auth/popup-closed-by-user": "A janela do Google foi fechada antes de concluir.",
  "auth/popup-blocked": "O navegador bloqueou a janela do Google. Permita pop-ups e tente de novo.",
  "auth/operation-not-allowed":
    "Este método de cadastro não está ativado no projeto Firebase.",
  "auth/unauthorized-domain":
    "Este domínio não está autorizado no Firebase (Authentication > Configurações > Domínios autorizados).",
};

function friendlyError(error) {
  console.error("Falha no cadastro:", error.code, error.message);
  return (
    ERROR_MESSAGES[error.code] ||
    `Não foi possível criar sua conta. Tente novamente em instantes. (código: ${error.code || "desconhecido"})`
  );
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function setLoading(isLoading, overlay = true) {
  busy = isLoading;
  if (overlay) (isLoading ? showLoader("Criando sua conta...") : hideLoader());
  submitBtn.disabled = isLoading;
  googleBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Criando conta..." : "Criar minha conta";
}

async function finish(user, name) {
  showLoader("Preparando sua conta...");
  try {
    await ensureUserDoc(user, { name, role: "patient" });
  } catch (error) {
    console.error("Firestore:", error.code);
  }
  location.href = destination;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  const nome = form.nome.value.trim();
  const email = form.email.value.trim();
  const senha = form.senha.value;
  const confirmarSenha = form.confirmarSenha.value;
  if (!nome || !email || !senha) return showError("Preencha todos os campos.");
  if (nome.length < 2) return showError("Digite seu nome completo.");
  if (passwordStrength(senha).level < 2)
    return showError(
      "Essa senha está fraca demais. Use pelo menos 8 caracteres e evite senhas comuns como 12345678.",
    );
  if (senha !== confirmarSenha) return showError("As senhas não coincidem.");
  setLoading(true);
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, senha);
    await updateProfile(credential.user, { displayName: nome });
    await finish(credential.user, nome);
  } catch (error) {
    showError(friendlyError(error));
    setLoading(false);
  }
});

googleBtn.addEventListener("click", async () => {
  clearError();
  setLoading(true, false); // a tela de carregamento só entra depois do popup do Google
  try {
    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    await finish(credential.user, credential.user.displayName);
  } catch (error) {
    showError(friendlyError(error));
    setLoading(false);
  }
});
