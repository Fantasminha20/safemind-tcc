import { session } from "./patient-access.js";
import {
  listJournal,
  saveJournalEntry,
  deleteJournalEntry,
  importJournal,
} from "./firestore-data.js";

const user = await session;

(async () => {
  const form = document.querySelector("#journal");
  const list = document.querySelector("#entries");
  const status = document.querySelector("#journal-status");
  const thought = document.querySelector("#thought");
  const intensity = document.querySelector("#intensity");
  const context = document.querySelector("#context");
  const filter = document.querySelector("#filter-mood");
  const storageKey = "safemind-journal";
  const levels = ["Leve", "Baixa", "Moderada", "Alta", "Muito intensa"];
  let records = [];
  let editingId = null;
  const uid = user.uid;
  function lockSaving(message) {
    status.textContent = message;
    document.querySelector("#save-entry").disabled = true;
  }
  // Registros que estavam só neste navegador (versão antiga): oferece enviar para a conta.
  async function migrateLocal() {
    let local = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(parsed))
        local = parsed.filter((item) => item && typeof item.text === "string" && item.text.trim());
    } catch {}
    if (!local.length) return;
    const ask = window.confirm(
      `Encontramos ${local.length} registro(s) do diário salvos apenas neste aparelho. Adicionar à sua conta?\n\nOK: adicionar e apagar a cópia local.\nCancelar: manter só neste aparelho.`,
    );
    if (!ask) return;
    try {
      await importJournal(uid, local);
      localStorage.removeItem(storageKey);
      records = await listJournal(uid);
      status.textContent = `${local.length} registro(s) foram adicionados à sua conta.`;
    } catch (error) {
      console.error("Firestore:", error.code);
      status.textContent =
        "Não foi possível enviar os registros deste aparelho. Eles continuam guardados aqui.";
    }
  }
  try {
    records = await listJournal(uid);
    await migrateLocal();
  } catch (error) {
    console.error("Firestore:", error.code);
    lockSaving(
      "Não foi possível carregar seus registros agora. Para não perder nada, o salvamento está indisponível; tente recarregar a página.",
    );
  }
  document.querySelector("#today-label").textContent = new Date().toLocaleDateString(
    "pt-BR",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );
  function updateInputs() {
    document.querySelector("#intensity-value").textContent =
      `${intensity.value} de 5 · ${levels[Number(intensity.value) - 1]}`;
    document.querySelector("#character-count").textContent =
      `${thought.value.length.toLocaleString("pt-BR")} / 4.000`;
  }
  function resetEditor() {
    editingId = null;
    form.reset();
    document.querySelector("#editor-title").textContent = "Como você está agora?";
    document.querySelector("#save-entry").textContent = "Salvar registro ↗";
    document.querySelector("#cancel-edit").hidden = true;
    thought.setCustomValidity("");
    updateInputs();
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }
  function render() {
    list.replaceChildren();
    document.querySelector("#entry-total").textContent = records.length;
    document.querySelector("#export-journal").hidden = records.length === 0;
    const visible = records
      .filter((item) => !filter.value || item.mood === filter.value)
      .slice()
      .reverse();
    if (!visible.length) {
      const empty = element("div", "journal-empty", "");
      empty.append(
        element(
          "h4",
          "",
          records.length
            ? "Nenhum registro com essa emoção."
            : "Seu primeiro momento começa aqui.",
        ),
        element(
          "p",
          "",
          records.length
            ? "Escolha outra emoção para explorar seu histórico."
            : "Quando você salvar, seus registros aparecerão neste espaço.",
        ),
      );
      list.append(empty);
    }
    visible.forEach((item) => {
      const card = element("article", "journal-entry", "");
      const header = element("div", "entry-header", "");
      header.append(
        element("span", "emotion-badge", item.mood),
        element("span", "entry-date", item.date || "Data não informada"),
      );
      const meta = [
        item.intensity ? `Intensidade ${item.intensity} de 5` : null,
        item.context,
      ]
        .filter(Boolean)
        .join(" · ");
      card.append(
        header,
        element("p", "entry-meta", meta),
        element("p", "entry-text", item.text),
      );
      const actions = element("div", "entry-actions", "");
      const edit = element("button", "journal-link", "Editar");
      edit.type = "button";
      edit.addEventListener("click", () => {
        editingId = item.id;
        form.reset();
        const radio = Array.from(form.elements.mood).find(
          (input) => input.value === item.mood,
        );
        if (radio) radio.checked = true;
        thought.value = item.text;
        intensity.value = item.intensity || 3;
        context.value = item.context || "";
        document.querySelector("#editor-title").textContent = "Revisite este momento";
        document.querySelector("#save-entry").textContent = "Salvar alterações";
        document.querySelector("#cancel-edit").hidden = false;
        status.textContent = "Editando o registro de " + item.date + ".";
        updateInputs();
        thought.focus();
      });
      const remove = element("button", "journal-link entry-delete", "Excluir");
      remove.type = "button";
      remove.addEventListener("click", async () => {
        if (!window.confirm("Excluir este registro? Essa ação não pode ser desfeita."))
          return;
        remove.disabled = true;
        try {
          await deleteJournalEntry(uid, item.id);
          records = records.filter((record) => record.id !== item.id);
          if (editingId === item.id) resetEditor();
          status.textContent = "Registro excluído.";
          render();
        } catch (error) {
          console.error("Firestore:", error.code);
          remove.disabled = false;
          status.textContent = "Não foi possível excluir agora. Tente novamente.";
        }
      });
      actions.append(edit, remove);
      card.append(actions);
      list.append(card);
    });
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!thought.value.trim()) {
      thought.setCustomValidity("Escreva algumas palavras para guardar este momento.");
      thought.reportValidity();
      return;
    }
    const previous = records.find((item) => item.id === editingId);
    const item = {
      id: previous?.id || crypto.randomUUID(),
      date: previous?.date || new Date().toLocaleDateString("pt-BR"),
      mood: form.elements.mood.value,
      intensity: Number(intensity.value),
      context: context.value,
      text: thought.value.trim(),
      createdAt: previous?.createdAt || Date.now(),
    };
    const saveButton = document.querySelector("#save-entry");
    saveButton.disabled = true;
    try {
      await saveJournalEntry(uid, item);
    } catch (error) {
      console.error("Firestore:", error.code);
      saveButton.disabled = false;
      status.textContent =
        "Não foi possível salvar. Seu texto continua aqui; copie-o antes de sair e tente de novo.";
      return;
    }
    saveButton.disabled = false;
    records = editingId
      ? records.map((record) => (record.id === editingId ? item : record))
      : [...records, item];
    const edited = Boolean(editingId);
    resetEditor();
    filter.value = "";
    render();
    status.textContent = edited ? "Alterações salvas." : "Seu momento foi guardado.";
  });
  thought.addEventListener("input", () => {
    thought.setCustomValidity("");
    updateInputs();
  });
  intensity.addEventListener("input", updateInputs);
  filter.addEventListener("change", render);
  document.querySelector("#cancel-edit").addEventListener("click", () => {
    resetEditor();
    status.textContent = "Edição cancelada.";
  });
  document.querySelector("#export-journal").addEventListener("click", () => {
    const text = records
      .map(
        (item) =>
          `${item.date} · ${item.mood}${item.intensity ? ` · Intensidade ${item.intensity}/5` : ""}\n${item.context || ""}\n${item.text}`,
      )
      .join("\n\n────────────────────\n\n");
    const url = URL.createObjectURL(
      new Blob([text], {
        type: "text/plain;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "meu-diario-safemind.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  });
  updateInputs();
  render();
})();
