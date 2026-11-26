import { sendContactMessage } from "./firestore-data.js";

const form = document.querySelector(".contact__form");
if (form) {
  const button = form.querySelector('button[type="submit"]');
  const feedback = document.createElement("p");
  feedback.className = "form-feedback";
  feedback.setAttribute("role", "status");
  feedback.hidden = true;
  form.append(feedback);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    feedback.hidden = true;
    const name = form.nome.value.trim();
    const email = form.email.value.trim();
    const message = form.mensagem.value.trim();
    if (name.length < 2 || !email || message.length < 5) {
      feedback.textContent = "Preencha nome, e-mail e uma mensagem com pelo menos 5 caracteres.";
      feedback.hidden = false;
      return;
    }
    button.disabled = true;
    try {
      await sendContactMessage({ name, email, phone: form.telefone.value, message });
      form.reset();
      feedback.textContent = "Mensagem enviada. Responderemos em até 24 horas.";
    } catch (error) {
      console.error("Firestore:", error.code);
      feedback.textContent = "Não foi possível enviar agora. Tente novamente em instantes.";
    }
    feedback.hidden = false;
    button.disabled = false;
  });
}
