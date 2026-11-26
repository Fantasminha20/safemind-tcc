import { currentUser } from "./auth-helpers.js";
import {
  getProfessional,
  getProfessionalOnboarding,
  saveProfessionalOnboarding,
} from "./firestore-data.js";
import { QUESTIONS, labelsFor } from "./pro-quiz-data.js";

const root = document.documentElement;
const form = document.getElementById("pro-quiz-form");
const stepList = document.getElementById("onboarding-steps");
const total = QUESTIONS.length;
let current = 0;
let steps = [];

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function button(label, className, action, type = "button") {
  const b = el("button", className, label);
  b.type = type;
  if (action) b.dataset.action = action;
  return b;
}

function optionRadio(question, option) {
  const label = el("label", "option");
  const input = el("input", "option__input");
  input.type = "radio";
  input.name = question.name;
  input.value = option.value;
  const card = el("span", "option__card");
  const radio = el("span", "option__radio");
  radio.setAttribute("aria-hidden", "true");
  const text = el("span", "option__text");
  text.append(el("span", "option__title", option.title));
  if (option.desc) text.append(el("span", "option__desc", option.desc));
  card.append(radio, text);
  label.append(input, card);
  return label;
}

function optionChip(question, option) {
  const label = el("label", "chip");
  const input = el("input", "chip__input");
  input.type = "checkbox";
  input.name = question.name;
  input.value = option.value;
  label.append(input, el("span", "chip__label", option.title));
  return label;
}

function buildStep(question, index) {
  const step = el("div", "quiz-step");
  step.hidden = index !== 0;
  step.append(el("p", "quiz__step", `Pergunta ${String(index + 1).padStart(2, "0")}`));
  const title = el("h1", "quiz__title", question.title);
  title.id = `q${index + 1}-title`;
  title.tabIndex = -1;
  step.append(title, el("p", "quiz__hint", question.hint));

  if (question.type === "radio") {
    const group = el("div", "quiz__options");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-labelledby", title.id);
    group.append(...question.options.map((o) => optionRadio(question, o)));
    step.append(group);
  } else {
    const fieldset = el("fieldset", "quiz-group");
    fieldset.append(el("legend", "quiz-group__title", question.legend));
    const chips = el("div", "chip-group");
    chips.append(...question.options.map((o) => optionChip(question, o)));
    fieldset.append(chips);
    step.append(fieldset);
  }

  const error = el("p", "quiz-step__error");
  error.setAttribute("role", "alert");
  error.hidden = true;
  step.append(error);

  const nav = el("div", "quiz-nav");
  if (index > 0) nav.append(button("Voltar", "btn btn--outline quiz-nav__back", "prev"));
  nav.append(button("Continuar", "btn btn--dark quiz-nav__next", "next"));
  step.append(nav);
  return step;
}

function buildFinal() {
  const step = el("div", "quiz-step quiz-step--final");
  step.hidden = true;
  const mark = el("span", "completion-symbol", "✓");
  mark.setAttribute("aria-hidden", "true");
  const title = el("h1", "quiz-final__title", "Obrigado por compartilhar.");
  title.tabIndex = -1;
  const status = el("p");
  status.id = "onboarding-status";
  status.setAttribute("role", "status");
  step.append(
    mark,
    title,
    el("p", "", "Suas respostas ajudam a nossa equipe a conhecer o seu trabalho e a apresentar o seu perfil com cuidado."),
    el("p", "quiz-storage-note", "As respostas ficam na sua conta, visíveis só para você e para a equipe Safemind. Você pode refazer o questionário quando quiser."),
    button("Enviar e continuar ↗", "btn btn--dark", "", "submit"),
    button("Revisar respostas", "quiz-final__back", "prev"),
    status,
  );
  return step;
}

function showStep(focus = true) {
  steps.forEach((step, index) => (step.hidden = index !== current));
  const shown = Math.min(current + 1, total);
  document.getElementById("progress-label").textContent =
    current < total ? `Pergunta ${current + 1} de ${total}` : "Tudo pronto";
  document.getElementById("progress-fill").style.width = `${(shown / total) * 100}%`;
  document.getElementById("progress-bar").setAttribute("aria-valuenow", shown);
  stepList.querySelectorAll("li").forEach((item, index) => {
    item.classList.toggle("completed", index < current);
    if (index === current) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
  if (focus) steps[current].querySelector("h1").focus();
}

function validate(index) {
  const question = QUESTIONS[index];
  const checked = form.querySelectorAll(`input[name="${question.name}"]:checked`).length;
  const error = steps[index].querySelector(".quiz-step__error");
  let message = "";
  if (checked < (question.min || 1)) message = "Escolha uma opção para continuar.";
  else if (question.max && checked > question.max)
    message = `Escolha no máximo ${question.max} opções.`;
  error.textContent = message;
  error.hidden = !message;
  if (message) steps[index].querySelector("input")?.focus();
  return !message;
}

function readAnswers() {
  const answers = {};
  for (const q of QUESTIONS) {
    const values = [...form.querySelectorAll(`input[name="${q.name}"]:checked`)].map((i) => i.value);
    answers[q.name] = q.type === "radio" ? values[0] : values;
  }
  return answers;
}

function prefill(saved) {
  if (!saved) return;
  form.querySelectorAll("input").forEach((input) => {
    const value = saved[input.name];
    input.checked = Array.isArray(value) ? value.includes(input.value) : value === input.value;
  });
}

(async () => {
  const user = await currentUser();
  if (!user) {
    location.replace("login.html?next=onboarding-profissional.html");
    return;
  }
  let professional;
  let saved = null;
  try {
    professional = await getProfessional(user.uid);
    if (professional) saved = await getProfessionalOnboarding(user.uid);
  } catch (error) {
    console.error("Firestore:", error.code);
  }
  if (!professional) {
    // Só quem enviou o cadastro profissional responde o questionário.
    location.replace("profissional.html");
    return;
  }

  QUESTIONS.forEach((q) => stepList.append(el("li", "", q.step)));
  steps = [...QUESTIONS.map(buildStep), buildFinal()];
  form.append(...steps);
  prefill(saved);
  showStep(false);
  root.classList.remove("auth-pending");

  form.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "next" && validate(current)) {
      current++;
      showStep();
    }
    if (action === "prev") {
      current = Math.max(0, current - 1);
      showStep();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    for (let index = 0; index < total; index++) {
      if (!validate(index)) {
        current = index;
        showStep();
        return;
      }
    }
    const answers = readAnswers();
    const submit = form.querySelector('button[type="submit"]');
    const status = document.getElementById("onboarding-status");
    submit.disabled = true;
    status.textContent = "Enviando...";
    try {
      const specialty = labelsFor("temas", answers.temas).slice(0, 3).join(", ");
      await saveProfessionalOnboarding(user.uid, answers, {
        specialty,
        hasSpecialty: Boolean(professional.specialty),
      });
      location.href = "psicologo.html";
    } catch (error) {
      console.error("Firestore:", error.code);
      status.textContent =
        "Não foi possível enviar agora. Suas respostas continuam aqui; tente de novo em instantes.";
      submit.disabled = false;
    }
  });
})();
