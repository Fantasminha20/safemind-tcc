// Painel de aprovação. Acesso: conta cujo UID tenha o documento admins/{uid} no Firestore.
import { currentUser, logout } from "./auth-helpers.js";
import {
  isAdmin,
  listProfessionalsByStatus,
  reviewProfessional,
  getProfessionalOnboarding,
} from "./firestore-data.js";
import { QUESTIONS, QUESTION_SHORT, labelsFor } from "./pro-quiz-data.js";

const root = document.documentElement;
const app = document.getElementById("admin-app");
const list = document.getElementById("admin-list");
const statusLine = document.getElementById("admin-status");
const filters = [...document.querySelectorAll("[data-status]")];
const MODALITY = { presencial: "Presencial", online: "Online", ambos: "Presencial e online" };
const LABELS = { pending: "pendente", approved: "aprovado", rejected: "recusado" };
let adminUser;
let current = "pending";

function showDenied(email) {
  const main = document.createElement("main");
  main.className = "access-gate";
  main.innerHTML = "";
  const card = document.createElement("section");
  card.className = "access-gate__card";
  const h1 = document.createElement("h1");
  h1.textContent = "Acesso restrito";
  const p = document.createElement("p");
  p.textContent = `A conta ${email || ""} não tem permissão de administrador.`;
  const row = document.createElement("div");
  row.className = "access-gate__actions";
  const home = document.createElement("a");
  home.className = "btn btn--dark btn--sm";
  home.href = "boas-vindas.html";
  home.textContent = "Voltar ao site";
  const out = document.createElement("button");
  out.className = "btn btn--outline btn--sm";
  out.type = "button";
  out.textContent = "Sair";
  out.addEventListener("click", async () => {
    await logout();
    location.href = "login.html?next=admin.html";
  });
  row.append(home, out);
  card.append(h1, p, row);
  main.append(card);
  document.body.append(main);
  root.classList.remove("auth-pending");
}

function field(term, value, href) {
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  if (href) {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = value;
    dd.append(a);
  } else dd.textContent = value || "—";
  return [dt, dd];
}

// Respostas do questionário do psicólogo (se já respondeu), para apoiar a decisão.
async function addOnboarding(article, dl, id) {
  try {
    const answers = await getProfessionalOnboarding(id);
    if (!answers) {
      dl.append(...field("Questionário", "Ainda não respondido"));
      return;
    }
    for (const q of QUESTIONS)
      dl.append(...field(QUESTION_SHORT[q.name], labelsFor(q.name, answers[q.name]).join(", ")));
  } catch (error) {
    console.error("Firestore:", error.code);
  }
}

function card(pro) {
  const article = document.createElement("article");
  article.className = "admin-card";
  const title = document.createElement("h2");
  title.textContent = pro.name;
  const dl = document.createElement("dl");
  const digits = String(pro.whatsapp || "").replace(/\D/g, "");
  dl.append(
    ...field("CRP", pro.crp),
    ...field("WhatsApp", pro.whatsapp, digits.length >= 8 ? "https://wa.me/" + digits : ""),
    ...field(
      "Região",
      [pro.neighborhood, pro.city, pro.state].filter(Boolean).join(", "),
    ),
    ...field("Atendimento", MODALITY[pro.modality]),
    ...field("Especialidade", pro.specialty),
    ...field("Solicitado em", pro.createdAt ? new Date(pro.createdAt).toLocaleString("pt-BR") : ""),
    ...field("UID", pro.id),
  );
  const actions = document.createElement("div");
  actions.className = "admin-card__actions";
  const options =
    pro.status === "pending"
      ? [["approved", "Aprovar", true], ["rejected", "Recusar", false]]
      : pro.status === "approved"
        ? [["rejected", "Revogar acesso", false], ["pending", "Voltar para pendente", false]]
        : [["approved", "Aprovar", true], ["pending", "Voltar para pendente", false]];
  for (const [status, label, primary] of options) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn--sm " + (primary ? "btn--dark" : "btn--outline");
    b.textContent = label;
    b.addEventListener("click", async () => {
      if (!window.confirm(`${label} o cadastro de ${pro.name} (CRP ${pro.crp})?`)) return;
      actions.querySelectorAll("button").forEach((x) => (x.disabled = true));
      try {
        await reviewProfessional(adminUser.uid, pro.id, status);
        statusLine.textContent = `${pro.name}: situação alterada para ${LABELS[status]}.`;
        await load(current, false);
      } catch (error) {
        console.error("Firestore:", error.code);
        statusLine.textContent = "Não foi possível salvar a alteração. Tente de novo.";
        actions.querySelectorAll("button").forEach((x) => (x.disabled = false));
      }
    });
    actions.append(b);
  }
  article.append(title, dl, actions);
  addOnboarding(article, dl, pro.id);
  return article;
}

async function load(status, clearMessage = true) {
  current = status;
  filters.forEach((f) => f.setAttribute("aria-pressed", String(f.dataset.status === status)));
  if (clearMessage) statusLine.textContent = "Carregando...";
  try {
    const items = await listProfessionalsByStatus(status);
    list.replaceChildren(...items.map(card));
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "admin-empty";
      empty.textContent = `Nenhum cadastro ${LABELS[status]}.`;
      list.append(empty);
    }
    if (clearMessage) statusLine.textContent = "";
  } catch (error) {
    console.error("Firestore:", error.code);
    statusLine.textContent = "Não foi possível carregar a lista.";
  }
}

(async () => {
  const user = await currentUser();
  if (!user) {
    location.replace("login.html?next=admin.html");
    return;
  }
  if (!(await isAdmin(user.uid))) return showDenied(user.email);
  adminUser = user;
  document.getElementById("admin-user").textContent = user.email || "";
  document.getElementById("admin-logout").addEventListener("click", async () => {
    await logout();
    location.href = "boas-vindas.html";
  });
  filters.forEach((f) => f.addEventListener("click", () => load(f.dataset.status)));
  app.hidden = false;
  root.classList.remove("auth-pending");
  load("pending");
})();
