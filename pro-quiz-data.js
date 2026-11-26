// Perguntas do questionário do psicólogo. Os valores precisam bater com firestore.rules.
export const QUESTIONS = [
  {
    name: "experiencia",
    type: "radio",
    step: "Sua experiência",
    title: "Há quanto tempo você atua como psicólogo(a)?",
    hint: "Isso ajuda a apresentar seu perfil com transparência.",
    options: [
      { value: "ate-2", title: "Menos de 2 anos", desc: "Início da carreira clínica" },
      { value: "2-5", title: "De 2 a 5 anos", desc: "Prática em consolidação" },
      { value: "5-10", title: "De 5 a 10 anos", desc: "Experiência sólida" },
      { value: "mais-10", title: "Mais de 10 anos", desc: "Longa trajetória clínica" },
    ],
  },
  {
    name: "abordagem",
    type: "radio",
    step: "Sua abordagem",
    title: "Qual é a sua principal abordagem teórica?",
    hint: "Escolha a que mais orienta o seu trabalho no dia a dia.",
    options: [
      { value: "tcc", title: "Terapia Cognitivo-Comportamental", desc: "TCC e terapias de terceira onda" },
      { value: "psicanalise", title: "Psicanálise", desc: "Abordagens psicanalíticas e psicodinâmicas" },
      { value: "humanista", title: "Humanista", desc: "Centrada na pessoa, existencial, fenomenológica" },
      { value: "gestalt", title: "Gestalt-terapia", desc: "Foco no presente e na awareness" },
      { value: "comportamental", title: "Análise do comportamento", desc: "Behaviorismo radical e ABA" },
      { value: "integrativa", title: "Integrativa ou outra", desc: "Combino abordagens ou uso outra linha" },
    ],
  },
  {
    name: "publico",
    type: "checkbox",
    step: "Quem você atende",
    title: "Quais públicos você atende?",
    hint: "Marque todos que se aplicam.",
    legend: "Públicos atendidos:",
    min: 1,
    max: 6,
    options: [
      { value: "criancas", title: "Crianças" },
      { value: "adolescentes", title: "Adolescentes" },
      { value: "adultos", title: "Adultos" },
      { value: "idosos", title: "Idosos" },
      { value: "casais", title: "Casais" },
      { value: "familias", title: "Famílias" },
    ],
  },
  {
    name: "temas",
    type: "checkbox",
    step: "Seus temas",
    title: "Em quais temas você mais atua?",
    hint: "Escolha até 5. Eles ajudam pacientes a encontrar você.",
    legend: "Temas de atuação (até 5):",
    min: 1,
    max: 5,
    options: [
      { value: "ansiedade", title: "Ansiedade" },
      { value: "depressao", title: "Depressão" },
      { value: "estresse", title: "Estresse e burnout" },
      { value: "luto", title: "Luto e perdas" },
      { value: "relacionamentos", title: "Relacionamentos" },
      { value: "autoestima", title: "Autoestima" },
      { value: "trauma", title: "Trauma" },
      { value: "carreira", title: "Carreira e trabalho" },
      { value: "neurodiversidade", title: "TDAH e autismo" },
      { value: "alimentar", title: "Alimentação e imagem corporal" },
      { value: "genero", title: "Gênero e sexualidade" },
    ],
  },
  {
    name: "horarios",
    type: "checkbox",
    step: "Seus horários",
    title: "Em quais períodos você costuma atender?",
    hint: "Você detalha os dias e horários depois, na sua área.",
    legend: "Períodos de atendimento:",
    min: 1,
    max: 5,
    options: [
      { value: "manha", title: "Manhã" },
      { value: "tarde", title: "Tarde" },
      { value: "noite", title: "Noite" },
      { value: "fim-de-semana", title: "Finais de semana" },
      { value: "flexivel", title: "Flexível / a combinar" },
    ],
  },
  {
    name: "valor",
    type: "radio",
    step: "Valores",
    title: "Qual é o valor médio da sua sessão?",
    hint: "Essa informação é só para a nossa equipe e não aparece no seu perfil.",
    options: [
      { value: "ate-150", title: "Até R$ 150", desc: "Valor médio por sessão" },
      { value: "150-250", title: "De R$ 150 a R$ 250", desc: "Valor médio por sessão" },
      { value: "250-350", title: "De R$ 250 a R$ 350", desc: "Valor médio por sessão" },
      { value: "mais-350", title: "Acima de R$ 350", desc: "Valor médio por sessão" },
      { value: "combinar", title: "Combino com cada paciente", desc: "Inclui valor social e faixas variáveis" },
    ],
  },
  {
    name: "objetivo",
    type: "radio",
    step: "Seu objetivo",
    title: "O que você espera da Safemind?",
    hint: "Escolha o que é mais importante agora.",
    options: [
      { value: "novos-pacientes", title: "Receber novos pacientes", desc: "Ser encontrado por quem busca cuidado" },
      { value: "organizar", title: "Organizar minha rotina", desc: "Agenda e disponibilidade em um só lugar" },
      { value: "presenca-online", title: "Ampliar minha presença online", desc: "Um perfil profissional bem apresentado" },
      { value: "rede", title: "Fazer parte de uma rede", desc: "Estar entre profissionais comprometidos com o cuidado" },
    ],
  },
];

export function labelFor(name, value) {
  const question = QUESTIONS.find((q) => q.name === name);
  return question?.options.find((o) => o.value === value)?.title || value;
}

export function labelsFor(name, values) {
  return (Array.isArray(values) ? values : [values]).map((v) => labelFor(name, v));
}

export const QUESTION_SHORT = {
  experiencia: "Experiência",
  abordagem: "Abordagem",
  publico: "Públicos",
  temas: "Temas",
  horarios: "Períodos",
  valor: "Valor da sessão",
  objetivo: "Objetivo",
};
