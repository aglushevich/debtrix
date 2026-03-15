export const CASE_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  overdue: "Просроченная задолженность",
  pretrial: "Досудебное взыскание",
  court: "Судебное взыскание",
  fssp: "Работа с ФССП",
  enforcement: "Исполнительное производство",
  closed: "Дело завершено",
};

export const DOC_LABELS: Record<string, string> = {
  payment_due_notice: "Напоминание о наступлении срока оплаты",
  debt_notice: "Уведомление о задолженности",
  pretension: "Досудебная претензия",
  lawsuit: "Исковое заявление",
  court_order: "Заявление о выдаче судебного приказа",
  fssp_application: "Заявление в ФССП",
};

export const STAGE_LABELS: Record<string, string> = {
  new: "Новый кейс",
  payment_due_notice_sent: "Направлено первое уведомление",
  debt_notice_sent: "Направлено уведомление о задолженности",
  pretrial: "Досудебная стадия",
  documents: "Подготовка судебных документов",
  enforcement: "Исполнительное производство",
  closed: "Дело завершено",
};

export const PARTICIPANT_ROLE_LABELS: Record<string, string> = {
  debtor: "Должник",
  creditor: "Кредитор",
  guarantor: "Поручитель",
  director: "Руководитель",
  representative: "Представитель",
  third_party: "Третье лицо",
};

export const DEBTOR_TYPE_LABELS: Record<string, string> = {
  company: "Юридическое лицо",
  individual: "Физическое лицо",
  entrepreneur: "Индивидуальный предприниматель",
};

export const FLAG_LABELS: Record<string, string> = {
  payment_due_notice_sent: "Первое уведомление",
  debt_notice_sent: "Уведомление о задолженности",
  notified: "Досудебная претензия",
  documents_prepared: "Судебные документы",
  fssp_prepared: "Материалы для ФССП",
  closed: "Дело завершено",
};

export function formatCaseStatus(status?: string, fallback = "—") {
  return CASE_STATUS_LABELS[status || ""] || status || fallback;
}

export function formatStageStatus(status?: string, fallback = "—") {
  return STAGE_LABELS[status || ""] || status || fallback;
}

export function formatDocumentCode(code?: string, fallback = "—") {
  return DOC_LABELS[code || ""] || code || fallback;
}

export function formatFlagLabel(key: string) {
  return FLAG_LABELS[key] || key;
}

export function formatParticipantRole(role?: string, fallback = "—") {
  return PARTICIPANT_ROLE_LABELS[role || ""] || role || fallback;
}

export function formatDebtorType(value?: string, fallback = "—") {
  return DEBTOR_TYPE_LABELS[value || ""] || value || fallback;
}