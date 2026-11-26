(() => {
  const form = document.querySelector("#match-form");
  const steps = [...form.querySelectorAll(".quiz-step")];
  const totalQuestions = steps.length - 1;
  let current = 0;
  let saved;
  try {
    saved = JSON.parse(sessionStorage.getItem("safemind-preferences") || "null");
  } catch {}
  if (saved?.answers) {
    form.querySelectorAll("input").forEach((input) => {
      const value = saved.answers[input.name];
      input.checked = Array.isArray(value)
        ? value.includes(input.value)
        : value === input.value;
    });
  }
  function showStep(focus = true) {
    steps.forEach((step, index) => {
      step.hidden = index !== current;
    });
    const progress = Math.min(current + 1, totalQuestions);
    document.querySelector("#progress-label").textContent =
      current < totalQuestions
        ? `Pergunta ${current + 1} de ${totalQuestions}`
        : "Tudo pronto";
    document.querySelector("#progress-fill").style.width =
      `${(progress / totalQuestions) * 100}%`;
    document.querySelector("#progress-bar").setAttribute("aria-valuenow", progress);
    document.querySelectorAll("#onboarding-steps li").forEach((item, index) => {
      item.classList.toggle("completed", index < current);
      if (index === current) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    if (focus) steps[current].querySelector("h1").focus();
  }
  function validate(index) {
    const inputs = [...steps[index].querySelectorAll("input")];
    const names = [...new Set(inputs.map((input) => input.name))];
    const valid = names.every((name) =>
      inputs.some((input) => input.name === name && input.checked),
    );
    const error = steps[index].querySelector(".quiz-step__error");
    if (error) error.hidden = valid;
    if (!valid) inputs[0]?.focus();
    return valid;
  }
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
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    for (let index = 0; index < totalQuestions; index++) {
      if (!validate(index)) {
        current = index;
        showStep();
        return;
      }
    }
    const data = new FormData(form);
    const answers = Object.fromEntries(
      ["experiencia", "momento", "formato", "diario"].map((name) => [
        name,
        data.get(name),
      ]),
    );
    answers.horarios = data.getAll("horarios");
    const labels = {};
    form.querySelectorAll("input:checked").forEach((input) => {
      const label = input
        .closest("label")
        .querySelector(".option__title, .chip__label")
        .textContent.trim();
      if (input.name === "horarios") (labels.horarios ||= []).push(label);
      else labels[input.name] = label;
    });
    try {
      sessionStorage.setItem(
        "safemind-preferences",
        JSON.stringify({
          answers: answers,
          labels: labels,
        }),
      );
      sessionStorage.setItem("safemind-welcome", "1");
      sessionStorage.removeItem("safemind-prefs-synced");
      sessionStorage.setItem("safemind-diary-choice", answers.diario);
      try {
        localStorage.setItem("safemind-diary-enabled", String(answers.diario === "sim"));
      } catch {}
      sessionStorage.setItem("safemind-quiz-completed", "1");
      const requested = new URLSearchParams(location.search).get("destino");
      const destination = ["inicio", "profissionais", "diario", "preferencias"].includes(
        requested,
      )
        ? requested
        : "inicio";
      location.href = "paciente.html#" + destination;
    } catch {
      document.querySelector("#onboarding-status").textContent =
        "O navegador não permitiu guardar suas escolhas. Você pode conhecer o site pelo link ao lado e ativar o diário na sua área.";
    }
  });
  document.querySelectorAll("[data-leave-quiz]").forEach((link) => {
    link.addEventListener("click", () => {
      try {
        sessionStorage.setItem("safemind-welcome", "1");
      } catch {}
    });
  });
  showStep(false);
})();
