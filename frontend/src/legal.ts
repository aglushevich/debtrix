export const CASE_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  overdue: "Просроченная задолженность",
  pretrial: "Досудебное взыскание",
  court: "Судебное взыскание",
  fssp: "ФССП",
  enforcement: "Исполнительное производство",
  closed: "Завершено",
};

export const DOC_LABELS: Record<string, string> = {
  payment_due_notice: "Напоминание о наступлении срока оплаты",
  debt_notice: "Уведомление о наличии задолженности",
  pretension: "Досудебная претензия",
  lawsuit: "Исковое заявление",
  court_order: "Заявление о выдаче судебного приказа",
  fssp_application: "Заявление в ФССП",
};

export const STAGE_LABELS: Record<string, string> = {
  new: "Новый кейс",
  payment_due_notice_sent: "Напоминание направлено",
  debt_notice_sent: "Уведомление о задолженности направлено",
  pretrial: "Досудебная стадия",
  documents: "Подготовка судебных документов",
  enforcement: "Исполнительное производство",
  closed: "Закрыто",
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
  payment_due_notice_sent: "Напоминание направлено",
  debt_notice_sent: "Уведомление направлено",
  notified: "Претензия направлена",
  documents_prepared: "Судебные документы подготовлены",
  fssp_prepared: "Материалы в ФССП подготовлены",
  closed: "Дело закрыто",
};

export const ACTION_LABELS: Record<string, string> = {
  payment_due_notice: "Направить напоминание о сроке оплаты",
  send_payment_due_notice: "Направить напоминание о сроке оплаты",
  debt_notice: "Направить уведомление о задолженности",
  send_debt_notice: "Направить уведомление о задолженности",
  pretension: "Подготовить досудебную претензию",
  send_pretension: "Направить досудебную претензию",
  submit_to_court: "Подать материалы в суд",
  send_to_fssp: "Направить материалы в ФССП",
  send_russian_post_letter: "Отправить письмо через Почту России",
  generate_documents: "Сформировать документы",
  close_case: "Закрыть дело",
};

export const EXECUTION_STATUS_LABELS: Record<string, string> = {
  success: "Выполнено",
  completed: "Завершено",
  blocked: "Заблокировано",
  waiting: "Ожидает срока",
  error: "Ошибка",
  failed: "Ошибка",
  queued: "Поставлено в очередь",
  running: "Выполняется",
  pending: "Ожидает выполнения",
};

export const ROUTING_STATUS_LABELS: Record<string, string> = {
  waiting: "Ожидание",
  blocked: "Блокировка",
  ready: "Готово к выполнению",
  eligible: "Доступно к выполнению",
  not_applicable: "Неприменимо",
};

export function formatCaseStatus(status?: string) {
  return CASE_STATUS_LABELS[status || ""] || status || "—";
}

export function formatStageStatus(status?: string) {
  return STAGE_LABELS[status || ""] || status || "—";
}

export function formatDocumentCode(code?: string) {
  return DOC_LABELS[code || ""] || code || "—";
}

export function formatFlagLabel(key: string) {
  return FLAG_LABELS[key] || key;
}

export function formatParticipantRole(role?: string) {
  return PARTICIPANT_ROLE_LABELS[role || ""] || role || "—";
}

export function formatDebtorType(value?: string) {
  return DEBTOR_TYPE_LABELS[value || ""] || value || "—";
}

export function formatActionCode(code?: string) {
  return ACTION_LABELS[code || ""] || code || "—";
}

export function formatExecutionStatus(status?: string) {
  return EXECUTION_STATUS_LABELS[status || ""] || status || "—";
}

export function formatRoutingStatus(status?: string) {
  return ROUTING_STATUS_LABELS[status || ""] || status || "—";
}