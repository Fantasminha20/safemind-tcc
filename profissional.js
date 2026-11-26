import { auth } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ensureUserDoc, registerProfessional, getProfessional } from "./firestore-data.js";
import { passwordStrength } from "./password-ui.js";

const form = document.querySelector(".pro-form");
const googleBtn = document.getElementById("pro-google");
const submitBtn = form.querySelector(".pro-form__submit");
const message = document.getElementById("pro-message");

const ERRORS = {
  "auth/email-already-in-use": "Este e-mail já está cadastrado. Tente entrar na sua conta.",
  "auth/invalid-email": "Digite um e-mail válido.",
  "auth/weak-password": "A senha precisa ter pelo menos 8 caracteres.",
  "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente novamente.",
  "auth/popup-closed-by-user": "A janela do Google foi fechada antes de concluir.",
  "auth/popup-blocked": "O navegador bloqueou a janela do Google. Permita pop-ups e tente de novo.",
  "auth/operation-not-allowed": "Este método de cadastro não está ativado no projeto Firebase.",
  "auth/unauthorized-domain": "Este domínio não está autorizado no Firebase.",
  "permission-denied": "O cadastro profissional foi recusado. Confira CRP e WhatsApp.",
};

function show(text, error = true) {
  message.textContent = text;
  message.className = "pro-form__message" + (error ? " pro-form__message--error" : "");
  message.hidden = false;
}

function setLoading(on) {
  submitBtn.disabled = on;
  googleBtn.disabled = on;
  submitBtn.textContent = on ? "Criando conta..." : "Criar minha conta";
}

// Valida os campos comuns (nome só é exigido no cadastro por e-mail).
function readProfile(withEmailFields) {
  const crp = form.crp.value.trim();
  const whatsapp = form.whatsapp.value.trim();
  if (!/^\d{2}\/\d{3,6}$/.test(crp)) return show("Informe o CRP no formato 06/12345.");
  if (!/^[+()\d\s-]{8,30}$/.test(whatsapp)) return show("Informe um WhatsApp válido.");
  const state = form.estado.value;
  const city = form.cidade.value.trim();
  const neighborhood = form.bairro.value.trim();
  const modality = form.atendimento.value;
  if (!/^[A-Z]{2}$/.test(state)) return show("Selecione o estado (UF) onde você atende.");
  if (city.length < 2) return show("Informe a cidade onde você atende.");
  if (!["presencial", "online", "ambos"].includes(modality))
    return show("Selecione o tipo de atendimento.");
  const common = { crp, whatsapp, state, city, neighborhood, modality };
  if (!withEmailFields) return common;
  const nome = form.nome.value.trim();
  const email = form.email.value.trim();
  const senha = form.senha.value;
  if (nome.length < 2) return show("Digite seu nome profissional.");
  if (!email) return show("Digite seu e-mail.");
  if (senha.length < 8) return show("A senha precisa ter pelo menos 8 caracteres.");
  if (passwordStrength(senha).level < 2)
    return show("Essa senha é muito comum. Escolha uma senha mais difícil de adivinhar.");
  return { ...common, nome, email, senha };
}

async function finish(user, name, profile) {
  try {
    // Já existe solicitação para esta conta: só leva à tela de acompanhamento.
    if (await getProfessional(user.uid)) {
      location.href = "psicologo.html";
      return;
    }
    await ensureUserDoc(user, { name, role: "professional" });
    await registerProfessional(user, { name, ...profile });
  } catch (error) {
    console.error("Firestore:", error.code);
    show(
      ERRORS[error.code] ||
        "Sua conta foi criada, mas não conseguimos enviar o cadastro profissional. Escreva para a gente pelo contato.",
    );
    setLoading(false);
    return;
  }
  location.href = "onboarding-profissional.html";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.hidden = true;
  const profile = readProfile(true);
  if (!profile) return;
  setLoading(true);
  try {
    const credential = await createUserWithEmailAndPassword(auth, profile.email, profile.senha);
    await updateProfile(credential.user, { displayName: profile.nome });
    await finish(credential.user, profile.nome, profile);
  } catch (error) {
    console.error(error.code, error.message);
    show(ERRORS[error.code] || `Não foi possível criar sua conta. (código: ${error.code || "desconhecido"})`);
    setLoading(false);
  }
});

googleBtn.addEventListener("click", async () => {
  message.hidden = true;
  const profile = readProfile(false);
  if (!profile) return;
  setLoading(true);
  try {
    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    await finish(credential.user, credential.user.displayName || "Profissional", profile);
  } catch (error) {
    console.error(error.code, error.message);
    show(ERRORS[error.code] || `Não foi possível cadastrar com o Google. (código: ${error.code || "desconhecido"})`);
    setLoading(false);
  }
});
