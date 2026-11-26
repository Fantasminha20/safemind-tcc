// Toda a leitura/escrita no Firestore passa por aqui.
//
// Modelo de dados:
//   users/{uid}                  nome, e-mail, role, preferences, diaryEnabled
//   users/{uid}/journal/{id}     registros do diário (só o dono lê/escreve)
//   professionals/{uid}          perfil profissional (status: pending | approved | rejected)
//   contactMessages/{id}         mensagens do formulário de contato (só criação)
import { db } from "./firebase-init.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const MOODS = ["Tranquilo", "Animado", "Ansioso", "Triste", "Cansado", "Irritado"];

/* ---------- Conta ---------- */

export async function ensureUserDoc(user, { name, role = "patient" } = {}) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  const data = {
    name: String(name || user.displayName || "").trim().slice(0, 120),
    email: String(user.email || "").slice(0, 254),
    role,
    createdAt: Date.now(),
  };
  await setDoc(ref, data);
  return data;
}

export async function loadUserDoc(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export function savePreferences(uid, preferences) {
  return updateDoc(doc(db, "users", uid), {
    preferences,
    diaryEnabled: preferences.answers?.diario === "sim",
  });
}

export function saveAccountName(uid, name) {
  return updateDoc(doc(db, "users", uid), { name: String(name).trim().slice(0, 120) });
}

export function saveProfessionalName(uid, name) {
  return updateDoc(doc(db, "professionals", uid), { name: String(name).trim().slice(0, 120) });
}

export function saveDiaryEnabled(uid, enabled) {
  return updateDoc(doc(db, "users", uid), { diaryEnabled: Boolean(enabled) });
}

/* ---------- Diário ---------- */

const journalCol = (uid) => collection(db, "users", uid, "journal");

function cleanEntry(item, fallbackOrder) {
  return {
    mood: MOODS.includes(item.mood) ? item.mood : "Tranquilo",
    intensity: Math.min(5, Math.max(1, Math.round(Number(item.intensity)) || 3)),
    context: String(item.context || "").slice(0, 100),
    text: String(item.text || "").trim().slice(0, 4000),
    date: String(item.date || "").slice(0, 30),
    createdAt: Number(item.createdAt) || fallbackOrder,
  };
}

export async function listJournal(uid) {
  const snap = await getDocs(query(journalCol(uid), orderBy("createdAt")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveJournalEntry(uid, item) {
  const { id, ...rest } = item;
  await setDoc(doc(journalCol(uid), id), cleanEntry(rest, Date.now()));
}

export function deleteJournalEntry(uid, id) {
  return deleteDoc(doc(journalCol(uid), id));
}

// Envia para a conta registros antigos que estavam só neste navegador.
export async function importJournal(uid, items) {
  const base = Date.now();
  const valid = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item && typeof item.text === "string" && item.text.trim());
  for (let start = 0; start < valid.length; start += 400) {
    const batch = writeBatch(db);
    for (const { item, index } of valid.slice(start, start + 400)) {
      const id = /^[A-Za-z0-9_-]{1,80}$/.test(String(item.id))
        ? String(item.id)
        : crypto.randomUUID();
      batch.set(doc(journalCol(uid), id), cleanEntry(item, base + index));
    }
    await batch.commit();
  }
  return valid.length;
}

/* ---------- Profissionais ---------- */

export async function listApprovedProfessionals() {
  const snap = await getDocs(
    query(collection(db, "professionals"), where("status", "==", "approved"), limit(300)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getProfessional(uid) {
  const snap = await getDoc(doc(db, "professionals", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Admin: existe o documento admins/{uid}? (criado manualmente no console)
export async function isAdmin(uid) {
  try {
    return (await getDoc(doc(db, "admins", uid))).exists();
  } catch {
    return false;
  }
}

// Só administradores conseguem ler profissionais pendentes/recusados.
export async function listProfessionalsByStatus(status) {
  const snap = await getDocs(
    query(collection(db, "professionals"), where("status", "==", status), limit(200)),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export function reviewProfessional(adminUid, professionalId, status) {
  return updateDoc(doc(db, "professionals", professionalId), {
    status,
    reviewedAt: Date.now(),
    reviewedBy: adminUid,
  });
}

export function registerProfessional(
  user,
  { name, crp, whatsapp, state, city, neighborhood = "", modality, bio = "", specialty = "" },
) {
  return setDoc(doc(db, "professionals", user.uid), {
    name: String(name).trim().slice(0, 120),
    crp,
    whatsapp,
    state,
    city: String(city).trim().slice(0, 80),
    neighborhood: String(neighborhood).trim().slice(0, 80),
    modality,
    bio: String(bio).slice(0, 2000),
    specialty: String(specialty).slice(0, 120),
    status: "pending",
    createdAt: Date.now(),
  });
}

// Questionário do psicólogo: documento privado (dono + administradores).
export async function getProfessionalOnboarding(uid) {
  const snap = await getDoc(doc(db, "professionalOnboarding", uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveProfessionalOnboarding(uid, answers, { specialty, hasSpecialty }) {
  await setDoc(doc(db, "professionalOnboarding", uid), { ...answers, updatedAt: Date.now() });
  // Sem especialidade no perfil ainda: usa os temas escolhidos como ponto de partida.
  if (!hasSpecialty && specialty) {
    try {
      await updateDoc(doc(db, "professionals", uid), { specialty: specialty.slice(0, 120) });
    } catch (error) {
      console.error("Firestore:", error.code);
    }
  }
}

// Edição do perfil pelo próprio psicólogo (o CRP e o status não mudam por aqui).
export function saveProfessionalProfile(uid, p) {
  return updateDoc(doc(db, "professionals", uid), {
    name: String(p.name).trim().slice(0, 120),
    whatsapp: String(p.whatsapp).trim(),
    specialty: String(p.specialty || "").trim().slice(0, 120),
    bio: String(p.bio || "").trim().slice(0, 2000),
    state: p.state,
    city: String(p.city).trim().slice(0, 80),
    neighborhood: String(p.neighborhood || "").trim().slice(0, 80),
    modality: p.modality,
  });
}

// Disponibilidade e agenda: privadas, só do psicólogo aprovado.
export async function loadWorkspace(uid) {
  const snap = await getDoc(doc(db, "professionalWorkspace", uid));
  return snap.exists() ? snap.data() : null;
}

export function saveWorkspace(uid, { availability, appointments }) {
  return setDoc(doc(db, "professionalWorkspace", uid), {
    availability,
    appointments,
    updatedAt: Date.now(),
  });
}

/* ---------- Dados da conta (exportar / apagar) ---------- */

// Cópia de tudo que a conta tem no Firestore (portabilidade).
export async function exportAccountData(uid) {
  const attempt = async (fn) => {
    try {
      return await fn();
    } catch {
      return null; // sem permissão ou inexistente (ex.: agenda de quem não é aprovado)
    }
  };
  return {
    user: await attempt(() => loadUserDoc(uid)),
    journal: (await attempt(() => listJournal(uid))) || [],
    professional: await attempt(() => getProfessional(uid)),
    professionalOnboarding: await attempt(() => getProfessionalOnboarding(uid)),
    professionalWorkspace: await attempt(() => loadWorkspace(uid)),
  };
}

// Apaga todos os documentos da conta. O login (Auth) é removido depois, em settings.js.
export async function deleteAccountData(uid) {
  const entries = await getDocs(journalCol(uid));
  for (let start = 0; start < entries.docs.length; start += 400) {
    const batch = writeBatch(db);
    entries.docs.slice(start, start + 400).forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, "professionalWorkspace", uid));
  await deleteDoc(doc(db, "professionalOnboarding", uid));
  await deleteDoc(doc(db, "professionals", uid));
  await deleteDoc(doc(db, "users", uid));
}

/* ---------- Contato ---------- */

export function sendContactMessage({ name, email, phone = "", message }) {
  return addDoc(collection(db, "contactMessages"), {
    name: String(name).trim().slice(0, 120),
    email: String(email).trim().slice(0, 254),
    phone: String(phone).trim().slice(0, 30),
    message: String(message).trim().slice(0, 4000),
    createdAt: Date.now(),
  });
}
