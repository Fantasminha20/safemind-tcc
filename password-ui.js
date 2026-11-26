// Campos de senha: botão "Mostrar/Ocultar" em todos e barra de força nos que têm data-strength.
const COMMON = new Set(
  `123456 1234567 12345678 123456789 1234567890 12345 111111 000000 00000000 123123 654321 121212
   password password1 password123 senha senha123 senha1234 senha12345 mudar123 mudar@123 qwerty qwerty123
   qwertyuiop abc123 abcd1234 abcdef 1q2w3e4r 1q2w3e iloveyou admin admin123 welcome letmein brasil brasil123
   brazil flamengo corinthians palmeiras saopaulo gabriel123 samsung dragon master monkey football 987654321
   safemind safemind123 psicologo psicologa psicologia terapia`
    .split(/\s+/)
    .filter(Boolean),
);

const LABELS = {
  1: "Muito fraca: fácil demais de adivinhar",
  2: "Fraca",
  3: "Razoável",
  4: "Boa",
  5: "Forte",
};

export function passwordStrength(value) {
  if (!value) return { level: 0, label: "", tip: "" };
  const lower = value.toLowerCase();
  if (value.length < 8)
    return { level: 1, label: LABELS[1], tip: "Use pelo menos 8 caracteres." };
  if (COMMON.has(lower) || /^(.)\1+$/.test(value))
    return {
      level: 1,
      label: LABELS[1],
      tip: "Essa é uma senha muito comum. Escolha algo só seu.",
    };
  const variety =
    /[a-z]/.test(value) + /[A-Z]/.test(value) + /\d/.test(value) + /[^A-Za-z0-9]/.test(value);
  let level = 1 + (value.length >= 12) + (value.length >= 16 ? 1 : 0) + Math.max(0, variety - 1);
  level = Math.max(2, Math.min(5, level));
  const predictable =
    /^\d+$/.test(value) ||
    /(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|qwer|asdf|zxcv)/i.test(value) ||
    /(.)\1{3,}/.test(value);
  if (predictable) level = Math.min(level, 2);
  return {
    level,
    label: LABELS[level],
    tip:
      level >= 4
        ? "Ótima escolha."
        : "Dica: use 12 ou mais caracteres, misturando maiúsculas, minúsculas, números e símbolos.",
  };
}

function enhance(input) {
  const wrapper = document.createElement("div");
  wrapper.className = "pw-field";
  input.before(wrapper);
  wrapper.append(input);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "pw-toggle";
  toggle.textContent = "Mostrar";
  toggle.setAttribute("aria-label", "Mostrar senha");
  toggle.setAttribute("aria-pressed", "false");
  toggle.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    toggle.textContent = show ? "Ocultar" : "Mostrar";
    toggle.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
    toggle.setAttribute("aria-pressed", String(show));
  });
  wrapper.append(toggle);

  if (!input.hasAttribute("data-strength")) return;
  const meter = document.createElement("div");
  meter.className = "pw-meter";
  meter.hidden = true;
  const bar = document.createElement("div");
  bar.className = "pw-meter__bar";
  bar.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 5; i++) bar.append(document.createElement("span"));
  const text = document.createElement("p");
  text.className = "pw-meter__text";
  text.setAttribute("aria-live", "polite");
  meter.append(bar, text);
  wrapper.after(meter);

  input.addEventListener("input", () => {
    const { level, label, tip } = passwordStrength(input.value);
    meter.hidden = level === 0;
    meter.dataset.level = String(level);
    text.textContent = level ? `${label}. ${tip}` : "";
  });
}

document.querySelectorAll('input[type="password"]').forEach(enhance);
