import { session } from "./patient-access.js";
import { auth } from "./firebase-init.js";
import { listApprovedProfessionals, saveDiaryEnabled } from "./firestore-data.js";

await session; // só segue com usuário autenticado e quiz sincronizado

(() => {
  const labels = {
    inicio: "Visão geral",
    profissionais: "Profissionais",
    diario: "Diário emocional",
    preferencias: "Suas preferências",
  };
  let diaryEnabled = false;
  try {
    const currentChoice = sessionStorage.getItem("safemind-diary-choice");
    diaryEnabled = currentChoice
      ? currentChoice === "sim"
      : localStorage.getItem("safemind-diary-enabled") === "true";
  } catch {}
  function updateDiary() {
    document.querySelector("#diary-introduction").hidden = diaryEnabled;
    document.querySelector("#diary-content").hidden = !diaryEnabled;
    document.querySelector("#diary-tile-action").textContent = diaryEnabled
      ? "Abrir meu diário ↗"
      : "Conhecer o diário ↗";
  }
  function setDiary(enabled) {
    diaryEnabled = enabled;
    try {
      localStorage.setItem("safemind-diary-enabled", String(enabled));
      sessionStorage.setItem("safemind-diary-choice", enabled ? "sim" : "nao");
    } catch {
      document.querySelector("#patient-status").textContent =
        "Sua escolha vale nesta página, mas não pôde ser salva neste navegador.";
    }
    updateDiary();
    if (auth.currentUser)
      saveDiaryEnabled(auth.currentUser.uid, enabled).catch((error) =>
        console.error("Firestore:", error.code),
      );
    const target = enabled
      ? document.querySelector("#journal-title")
      : document.querySelector("#diary-introduction h1");
    target.setAttribute("tabindex", "-1");
    target.focus();
  }
  document.querySelector("#enable-diary").addEventListener("click", () => setDiary(true));
  document.querySelector("#disable-diary").addEventListener("click", () => {
    setDiary(false);
    document.querySelector("#patient-status").textContent =
      "Diário desativado. Seus registros continuam guardados e estarão aqui se você reativar.";
  });
  function showPanel(focus = true) {
    const key = location.hash.slice(1);
    const active = Object.hasOwn(labels, key) ? key : "inicio";
    document.querySelectorAll("[data-patient-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.patientPanel !== active;
    });
    document.querySelectorAll("[data-panel]").forEach((link) => {
      if (link.dataset.panel === active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.querySelector("#panel-label").textContent = labels[active];
    document.title = `${labels[active]} — Safemind`;
    if (focus) {
      const heading = [
        ...document.querySelectorAll(`#panel-${active} h1, #panel-${active} h2`),
      ].find((node) => !node.closest("[hidden]"));
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus();
      }
    }
  }
  const summary = document.querySelector("#preferences-summary");
  let preferences;
  try {
    preferences = JSON.parse(sessionStorage.getItem("safemind-preferences") || "null");
  } catch {}
  if (preferences?.labels) {
    for (const [key, title] of [
      ["experiencia", "Seu contato com a terapia"],
      ["momento", "Seu momento"],
      ["formato", "Formato de atendimento"],
      ["horarios", "Disponibilidade"],
    ]) {
      const term = document.createElement("dt"),
        description = document.createElement("dd");
      term.textContent = title;
      const value = preferences.labels[key];
      description.textContent = Array.isArray(value)
        ? value.join(", ")
        : value || "Não informado";
      summary.append(term, description);
    }
  } else {
    const empty = document.createElement("p");
    empty.textContent =
      "Você ainda não respondeu ao quiz nesta sessão. Pode começar quando quiser.";
    summary.append(empty);
  }

  // Profissionais aprovados (Firestore) com busca por região.
  // Sem nenhum aprovado, mantém os perfis ilustrativos e esconde os filtros.
  const MODALITY = { presencial: "Presencial", online: "Online", ambos: "Presencial e online" };
  const norm = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  function placeLine(pro) {
    const place = [pro.neighborhood, pro.city && pro.state ? `${pro.city}/${pro.state}` : pro.city]
      .filter(Boolean)
      .join(" · ");
    return [place, MODALITY[pro.modality]].filter(Boolean).join(" — ");
  }

  function proCard(pro, index) {
    const card = document.createElement("article");
    card.className = "person";
    const portrait = document.createElement("div");
    portrait.className = `portrait portrait-${index % 3}`;
    const initials = document.createElement("span");
    initials.textContent = String(pro.name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
    portrait.append(initials);
    const copy = document.createElement("div");
    copy.className = "person-copy";
    const kicker = document.createElement("span");
    kicker.className = "kicker";
    kicker.textContent = "Psicologia · CRP " + pro.crp;
    const name = document.createElement("h3");
    name.textContent = pro.name;
    copy.append(kicker, name);
    const place = placeLine(pro);
    if (place) {
      const where = document.createElement("p");
      where.className = "person-place";
      where.textContent = place;
      copy.append(where);
    }
    const specialty = document.createElement("p");
    specialty.textContent = pro.specialty || "Psicólogo(a)";
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Conhecer perfil ↗";
    const bio = document.createElement("p");
    bio.textContent = pro.bio || "Este profissional ainda não escreveu uma apresentação.";
    details.append(summary, bio);
    const digits = String(pro.whatsapp || "").replace(/\D/g, "");
    if (digits.length >= 8) {
      const link = document.createElement("a");
      link.className = "person-link";
      link.href = "https://wa.me/" + digits;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Conversar pelo WhatsApp →";
      details.append(link);
    }
    copy.append(specialty, details);
    card.append(portrait, copy);
    return card;
  }

  async function loadProfessionals() {
    const holder = document.querySelector("#professional-list");
    const form = document.querySelector("#professional-filters");
    const count = document.querySelector("#professional-count");
    if (!holder || !form) return;
    let all = [];
    try {
      all = await listApprovedProfessionals();
    } catch (error) {
      console.error("Firestore:", error.code);
      return;
    }
    if (!all.length) return;
    all.sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));

    const stateSelect = form.querySelector("#filter-state");
    const cityInput = form.querySelector("#filter-city");
    const cityList = form.querySelector("#filter-city-list");
    const modalitySelect = form.querySelector("#filter-modality");
    const nameInput = form.querySelector("#filter-name");

    const states = [...new Set(all.map((pro) => pro.state).filter(Boolean))].sort();
    stateSelect.append(
      ...states.map((uf) => Object.assign(document.createElement("option"), { value: uf, textContent: uf })),
    );

    function refreshCities() {
      const cities = new Set(
        all
          .filter((pro) => !stateSelect.value || pro.state === stateSelect.value)
          .map((pro) => pro.city)
          .filter(Boolean),
      );
      cityList.replaceChildren(
        ...[...cities]
          .sort((a, b) => a.localeCompare(b, "pt-BR"))
          .map((city) => Object.assign(document.createElement("option"), { value: city })),
      );
    }

    function render() {
      const city = norm(cityInput.value);
      const nameQuery = norm(nameInput.value);
      const modality = modalitySelect.value;
      const filtered = all.filter(
        (pro) =>
          (!stateSelect.value || pro.state === stateSelect.value) &&
          (!city || norm(pro.city).includes(city)) &&
          (!nameQuery || norm(pro.name).includes(nameQuery)) &&
          (!modality || pro.modality === modality || pro.modality === "ambos"),
      );
      if (filtered.length) {
        holder.replaceChildren(...filtered.map(proCard));
      } else {
        const empty = document.createElement("p");
        empty.className = "pro-empty";
        empty.textContent =
          "Nenhum profissional encontrado com esses filtros. Tente outra cidade ou escolha atendimento online.";
        holder.replaceChildren(empty);
      }
      count.textContent =
        filtered.length === 1 ? "1 profissional encontrado." : `${filtered.length} profissionais encontrados.`;
    }

    stateSelect.addEventListener("change", () => {
      refreshCities();
      render();
    });
    [cityInput, nameInput].forEach((input) => input.addEventListener("input", render));
    modalitySelect.addEventListener("change", render);
    form.addEventListener("submit", (event) => event.preventDefault());
    form.querySelector("#filter-clear").addEventListener("click", () => {
      form.reset();
      refreshCities();
      render();
    });

    refreshCities();
    form.hidden = false;
    count.hidden = false;
    render();
  }
  loadProfessionals();
  window.addEventListener("hashchange", () => showPanel());
  updateDiary();
  showPanel(false);
})();
