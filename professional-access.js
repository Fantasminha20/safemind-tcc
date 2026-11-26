// Porta da Área do psicólogo: só o cadastro APROVADO vê o painel.
//   sem login        -> tela de login
//   sem solicitação  -> convite para se cadastrar
//   pending          -> "Solicitação enviada"
//   rejected         -> "Solicitação não aprovada"
//   approved         -> painel normal
import { currentUser, logout } from "./auth-helpers.js";
import { getProfessional, getProfessionalOnboarding } from "./firestore-data.js";

const root = document.documentElement;
const shell = document.querySelector(".patient-shell");

function button(label, { href, onClick, primary = false }) {
  const node = document.createElement(href ? "a" : "button");
  node.className = "btn btn--sm " + (primary ? "btn--dark" : "btn--outline");
  node.textContent = label;
  if (href) node.href = href;
  else {
    node.type = "button";
    node.addEventListener("click", onClick);
  }
  return node;
}

function showGate({ kicker, title, paragraphs, actions }) {
  shell.hidden = true;
  const main = document.createElement("main");
  main.className = "access-gate";
  const card = document.createElement("section");
  card.className = "access-gate__card";
  card.setAttribute("aria-labelledby", "gate-title");
  const small = document.createElement("span");
  small.className = "kicker";
  small.textContent = kicker;
  const heading = document.createElement("h1");
  heading.id = "gate-title";
  heading.tabIndex = -1;
  heading.textContent = title;
  card.append(small, heading);
  for (const text of paragraphs) {
    const p = document.createElement("p");
    p.textContent = text;
    card.append(p);
  }
  const row = document.createElement("div");
  row.className = "access-gate__actions";
  row.append(...actions);
  card.append(row);
  main.append(card);
  document.body.append(main);
  root.classList.remove("auth-pending");
  heading.focus();
}

const signOutButton = () =>
  button("Sair", {
    onClick: async () => {
      try {
        await logout();
      } catch {}
      location.href = "boas-vindas.html";
    },
  });

function mountSessionUI(user) {
  const actions = document.querySelector(".patient-topbar .header-actions");
  if (!actions) return;
  const name = document.createElement("span");
  name.className = "session-user";
  name.textContent = user.displayName || user.email || "";
  const settings = document.createElement("a");
  settings.className = "btn btn--outline btn--sm";
  settings.href = "configuracoes.html";
  settings.textContent = "⚙ Configurações";
  actions.replaceChildren(name, settings, signOutButton());
}

const never = new Promise(() => {});

// Resolve com { user, professional } só quando o cadastro está aprovado.
export const access = (async () => {
  const user = await currentUser();
  if (!user) {
    location.replace("login.html?next=psicologo.html");
    return never;
  }
  let professional;
  try {
    professional = await getProfessional(user.uid);
  } catch (error) {
    console.error("Firestore:", error.code);
    showGate({
      kicker: "Algo deu errado",
      title: "Não foi possível verificar seu cadastro",
      paragraphs: ["Tente novamente em instantes."],
      actions: [
        button("Tentar de novo", { onClick: () => location.reload(), primary: true }),
        signOutButton(),
      ],
    });
    return never;
  }

  if (!professional) {
    showGate({
      kicker: "Área do psicólogo",
      title: "Você ainda não tem cadastro profissional",
      paragraphs: [
        "Para acessar esta área, envie seus dados profissionais. Nossa equipe confere o CRP antes de liberar o acesso.",
      ],
      actions: [
        button("Cadastrar como profissional", { href: "profissional.html", primary: true }),
        button("Voltar ao site", { href: "boas-vindas.html" }),
        signOutButton(),
      ],
    });
  } else if (professional.status === "pending") {
    let answered = true;
    try {
      answered = Boolean(await getProfessionalOnboarding(user.uid));
    } catch {}
    showGate({
      kicker: "Em análise",
      title: "Solicitação enviada",
      paragraphs: [
        `Recebemos o seu cadastro (CRP ${professional.crp}). Nossa equipe vai verificar o registro e liberar o seu acesso.`,
        "Quando for aprovado, é só entrar de novo para abrir a Área do psicólogo.",
      ],
      actions: [
        ...(answered
          ? []
          : [
              button("Responder questionário profissional", {
                href: "onboarding-profissional.html",
                primary: true,
              }),
            ]),
        button("Voltar ao site", { href: "boas-vindas.html", primary: answered }),
        signOutButton(),
      ],
    });
  } else if (professional.status === "rejected") {
    showGate({
      kicker: "Cadastro",
      title: "Solicitação não aprovada",
      paragraphs: [
        "Não foi possível validar o seu cadastro profissional. Se acredita que houve um engano, fale com a gente pelo contato do site.",
      ],
      actions: [
        button("Falar com a equipe", { href: "boas-vindas.html#contato", primary: true }),
        signOutButton(),
      ],
    });
  } else {
    mountSessionUI(user);
    root.classList.remove("auth-pending");
    return { user, professional };
  }
  return never;
})();
