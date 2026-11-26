import { access } from "./professional-access.js";
import {
  saveProfessionalProfile,
  loadWorkspace,
  saveWorkspace,
} from "./firestore-data.js";

const { user, professional } = await access; // só segue com psicólogo aprovado

(async () => {
  const uid = user.uid;
  const legacyKey = "safemind-professional-workspace"; // versão antiga (só neste navegador)
  const weekdays = [
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
    "Domingo",
  ];
  const labels = {
    inicio: "Visão geral",
    perfil: "Meu perfil",
    disponibilidade: "Disponibilidade",
    agenda: "Minha agenda",
  };
  const profileForm = document.querySelector("#profile-form");
  const availabilityForm = document.querySelector("#availability-form");
  const appointmentForm = document.querySelector("#appointment-form");
  let state = {
    profile: {
      name: professional.name || "",
      crp: professional.crp || "",
      whatsapp: professional.whatsapp || "",
      specialty: professional.specialty || "",
      format: professional.modality || "online",
      bio: professional.bio || "",
      state: professional.state || "",
      city: professional.city || "",
      neighborhood: professional.neighborhood || "",
    },
    availability: weekdays.map(() => ({
      enabled: false,
      start: "09:00",
      end: "18:00",
    })),
    appointments: [],
  };

  function validWorkspace(saved) {
    return (
      saved &&
      Array.isArray(saved.availability) &&
      saved.availability.length === 7 &&
      Array.isArray(saved.appointments) &&
      saved.availability.every(
        (day) =>
          typeof day.enabled === "boolean" &&
          /^\d{2}:\d{2}$/.test(day.start) &&
          /^\d{2}:\d{2}$/.test(day.end),
      ) &&
      saved.appointments.every(
        (item) =>
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          Number.isFinite(new Date(`${item.date}T${item.time}`).getTime()) &&
          [30, 50, 60, 90].includes(item.duration),
      )
    );
  }

  function toProfileDoc(profile) {
    return {
      name: profile.name,
      whatsapp: profile.whatsapp,
      specialty: profile.specialty,
      bio: profile.bio,
      state: profile.state,
      city: profile.city,
      neighborhood: profile.neighborhood || "",
      modality: profile.format,
    };
  }

  let storageReadable = true;
  function blockSaving(message) {
    storageReadable = false;
    document.querySelectorAll("form button[type=submit]").forEach((button) => {
      button.disabled = true;
    });
    document.querySelectorAll("[role=status]").forEach((status) => {
      status.textContent = message;
    });
  }

  try {
    const saved = await loadWorkspace(uid);
    if (saved) {
      if (!validWorkspace(saved)) throw new Error("invalid");
      state = { ...state, availability: saved.availability, appointments: saved.appointments };
    } else {
      // Primeira vez com Firestore: oferece trazer o que ficou salvo só neste navegador.
      let legacy = null;
      try {
        legacy = JSON.parse(localStorage.getItem(legacyKey) || "null");
      } catch {}
      const hasLegacyWork =
        validWorkspace(legacy) &&
        (legacy.appointments.length || legacy.availability.some((day) => day.enabled));
      const hasLegacyProfile = legacy?.profile && (legacy.profile.specialty || legacy.profile.bio);
      if (
        (hasLegacyWork || hasLegacyProfile) &&
        window.confirm(
          "Encontramos dados salvos apenas neste navegador (perfil, disponibilidade e agenda). Adicionar à sua conta?\n\nOK: adicionar e apagar a cópia local.\nCancelar: manter só neste navegador.",
        )
      ) {
        try {
          const merged = {
            ...state.profile,
            specialty: state.profile.specialty || String(legacy.profile?.specialty || "").slice(0, 120),
            bio: state.profile.bio || String(legacy.profile?.bio || "").slice(0, 2000),
          };
          if (merged.specialty !== state.profile.specialty || merged.bio !== state.profile.bio) {
            await saveProfessionalProfile(uid, toProfileDoc(merged));
            state.profile = merged;
          }
          if (hasLegacyWork) {
            await saveWorkspace(uid, {
              availability: legacy.availability,
              appointments: legacy.appointments,
            });
            state = { ...state, availability: legacy.availability, appointments: legacy.appointments };
          }
          localStorage.removeItem(legacyKey);
        } catch (error) {
          console.error("Firestore:", error.code);
        }
      }
    }
  } catch (error) {
    console.error("Firestore:", error.code);
    blockSaving(
      "Não foi possível carregar seus dados agora. O salvamento foi bloqueado para preservar seus registros; recarregue a página.",
    );
  }

  // kind: "profile" (documento público do profissional) ou "workspace" (privado).
  async function save(next, statusId, kind) {
    const status = document.getElementById(statusId);
    if (!storageReadable) return false;
    try {
      if (kind === "profile") await saveProfessionalProfile(uid, toProfileDoc(next.profile));
      else
        await saveWorkspace(uid, {
          availability: next.availability,
          appointments: next.appointments,
        });
      state = next;
      updateDashboard();
      return true;
    } catch (error) {
      console.error("Firestore:", error.code);
      status.textContent =
        "Não foi possível salvar agora. Seus campos continuam preenchidos; tente de novo em instantes.";
      return false;
    }
  }
  function node(tag, text, className = "") {
    const el = document.createElement(tag);
    el.textContent = text;
    el.className = className;
    return el;
  }
  function startOf(item) {
    return new Date(`${item.date}T${item.time}`).getTime();
  }
  function endOf(item) {
    return startOf(item) + item.duration * 6e4;
  }
  function updateDashboard() {
    const complete = Boolean(state.profile.name && state.profile.specialty && state.profile.bio);
    document.querySelector("#profile-state").textContent = complete ? "Publicado" : "Incompleto";
    document.querySelector("#profile-state-note").textContent = complete
      ? "Visível para os pacientes"
      : "Complete especialidade e apresentação";
    document.querySelector("#preview-badge").textContent = complete
      ? "Visível para os pacientes"
      : "Perfil incompleto";
    document.querySelector("#available-days").textContent = state.availability.filter(
      (day) => day.enabled,
    ).length;
    document.querySelector("#upcoming-count").textContent = state.appointments.filter(
      (item) => endOf(item) >= Date.now(),
    ).length;
  }
  for (const name of ["name", "crp", "whatsapp", "specialty", "format", "bio", "state", "city", "neighborhood"]) {
    if (typeof state.profile[name] === "string")
      profileForm.elements.namedItem(name).value = state.profile[name];
  }
  function updatePreview() {
    const data = Object.fromEntries(new FormData(profileForm));
    document.querySelector("#preview-name").textContent =
      data.name.trim() || "Seu nome profissional";
    document.querySelector("#preview-initials").textContent =
      data.name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "SM";
    document.querySelector("#preview-specialty").textContent =
      data.specialty.trim() || "Sua especialidade";
    document.querySelector("#preview-crp").textContent = data.crp
      ? `CRP ${data.crp}`
      : "CRP não informado";
    document.querySelector("#preview-bio").textContent =
      data.bio.trim() || "Sua apresentação aparecerá aqui.";
  }
  profileForm.addEventListener("input", updatePreview);
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.querySelector("#profile-status");
    const profile = Object.fromEntries(
      [...new FormData(profileForm)].map(([name, value]) => [name, value.trim()]),
    );
    profile.crp = state.profile.crp; // o CRP não muda por aqui
    if (!profile.name || !profile.specialty || !profile.bio) {
      status.textContent = "Preencha nome, especialidade e apresentação.";
      return;
    }
    if (!/^[+()\d\s-]{8,30}$/.test(profile.whatsapp)) {
      status.textContent = "Informe um WhatsApp válido.";
      return;
    }
    if (!/^[A-Z]{2}$/.test(profile.state) || profile.city.length < 2) {
      status.textContent = "Informe o estado (UF) e a cidade onde você atende.";
      return;
    }
    const button = profileForm.querySelector("button[type=submit]");
    button.disabled = true;
    status.textContent = "Salvando...";
    const ok = await save({ ...state, profile }, "profile-status", "profile");
    button.disabled = !storageReadable;
    if (ok) status.textContent = "Perfil salvo. Ele já está visível para os pacientes.";
  });
  weekdays.forEach((day, index) => {
    const row = node("div", "", "availability-row");
    const label = node("label", "", "day-checkbox");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = `enabled-${index}`;
    checkbox.checked = state.availability[index].enabled;
    label.append(checkbox, node("span", day));
    row.append(label);
    for (const [field, text] of [
      ["start", "Início"],
      ["end", "Fim"],
    ]) {
      const wrapper = document.createElement("label");
      wrapper.append(node("span", text));
      const input = document.createElement("input");
      input.type = "time";
      input.name = `${field}-${index}`;
      input.value = state.availability[index][field];
      input.required = true;
      input.disabled = !checkbox.checked;
      input.setAttribute("aria-label", `${text} · ${day}`);
      wrapper.append(input);
      row.append(wrapper);
    }
    checkbox.addEventListener("change", () =>
      row.querySelectorAll('input[type="time"]').forEach((input) => {
        input.disabled = !checkbox.checked;
      }),
    );
    document.querySelector("#availability-days").append(row);
  });
  availabilityForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const availability = weekdays.map((_, index) => ({
      enabled: availabilityForm.elements.namedItem(`enabled-${index}`).checked,
      start: availabilityForm.elements.namedItem(`start-${index}`).value,
      end: availabilityForm.elements.namedItem(`end-${index}`).value,
    }));
    const invalid = availability.findIndex(
      (day) => day.enabled && (!day.start || !day.end || day.start >= day.end),
    );
    if (invalid >= 0) {
      document.querySelector("#availability-status").textContent =
        `${weekdays[invalid]}: o horário final precisa ser depois do inicial.`;
      return;
    }
    if (await save({ ...state, availability }, "availability-status", "workspace"))
      document.querySelector("#availability-status").textContent =
        "Disponibilidade salva na sua conta.";
  });
  function renderAgenda() {
    const list = document.querySelector("#appointments");
    list.replaceChildren();
    const all = document.querySelector("#agenda-filter").value === "all";
    const items = state.appointments
      .filter((item) => all || endOf(item) >= Date.now())
      .slice()
      .sort((a, b) => startOf(a) - startOf(b));
    if (!items.length) {
      const empty = node("div", "", "pro-panel-card agenda-empty");
      empty.append(
        node("h3", "Nenhum compromisso por aqui."),
        node("p", "Adicione um horário para começar a organizar sua rotina."),
      );
      list.append(empty);
    }
    for (const item of items) {
      const card = node("article", "", "appointment-card");
      card.append(
        node(
          "span",
          `${new Date(`${item.date}T12:00`).toLocaleDateString("pt-BR")} · ${item.time} · ${item.duration} min`,
          "appointment-meta",
        ),
        node("h3", item.title),
      );
      const remove = node("button", "Remover", "journal-link");
      remove.type = "button";
      remove.addEventListener("click", async () => {
        if (!confirm("Remover este compromisso da sua agenda?")) return;
        if (
          await save(
            {
              ...state,
              appointments: state.appointments.filter((value) => value.id !== item.id),
            },
            "agenda-status",
            "workspace",
          )
        ) {
          renderAgenda();
          document.querySelector("#agenda-status").textContent = "Compromisso removido.";
        }
      });
      card.append(remove);
      list.append(card);
    }
  }
  appointmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(appointmentForm));
    const item = {
      ...data,
      title: data.title.trim(),
      duration: Number(data.duration),
      id: crypto.randomUUID(),
    };
    if (!item.title || !Number.isFinite(startOf(item))) {
      document.querySelector("#agenda-status").textContent =
        "Preencha um título, uma data e um horário válidos.";
      return;
    }
    if (startOf(item) < Date.now()) {
      document.querySelector("#agenda-status").textContent =
        "Escolha um horário futuro para o compromisso.";
      return;
    }
    if (
      state.appointments.some(
        (existing) => startOf(item) < endOf(existing) && endOf(item) > startOf(existing),
      )
    ) {
      document.querySelector("#agenda-status").textContent =
        "Já existe um compromisso nesse intervalo. Escolha outro horário.";
      return;
    }
    if (
      await save(
        {
          ...state,
          appointments: [...state.appointments, item],
        },
        "agenda-status",
        "workspace",
      )
    ) {
      appointmentForm.reset();
      renderAgenda();
      document.querySelector("#agenda-status").textContent =
        "Compromisso adicionado à sua agenda.";
    }
  });
  document.querySelector("#agenda-filter").addEventListener("change", renderAgenda);
  function showPanel(focus = true) {
    const value = location.hash.slice(1);
    const active = Object.hasOwn(labels, value) ? value : "inicio";
    document.querySelectorAll("[data-pro-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.proPanel !== active;
    });
    document.querySelectorAll("[data-pro-link]").forEach((link) => {
      if (link.dataset.proLink === active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.querySelector("#pro-panel-label").textContent = labels[active];
    document.title = `${labels[active]} — Área do psicólogo`;
    updateDashboard();
    renderAgenda();
    if (focus) document.querySelector(`[data-pro-panel="${active}"] h1`).focus();
  }
  window.addEventListener("hashchange", () => showPanel());
  updatePreview();
  showPanel(false);
})();
