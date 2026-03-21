export const CASE_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  waiting: "Ожидает",
  active: "Активно",
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
  waiting: "Ожидание",
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

export const ACTION_CODE_LABELS: Record<string, string> = {
  send_payment_due_notice: "Отправлено напоминание о сроке оплаты",
  send_debt_notice: "Отправлено уведомление о задолженности",
  send_pretension: "Отправлена досудебная претензия",
  generate_lawsuit: "Сформированы судебные документы",
  submit_to_court: "Материалы направлены в суд",
  send_to_fssp: "Материалы направлены в ФССП",
  send_russian_post_letter: "Отправлено письмо Почтой России",
  identify_debtor: "Сохранены реквизиты должника",
  refresh_debtor: "Обновлён профиль должника",
  update_soft_policy: "Обновлены настройки soft stage",
};

export const EXECUTION_STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает выполнения",
  queued: "Поставлено в очередь",
  running: "Выполняется",
  success: "Выполнено успешно",
  completed: "Завершено",
  blocked: "Заблокировано",
  waiting: "Ожидает срока/окна",
  already_processed: "Уже обработано",
  not_applicable: "Не применимо",
  failed: "Ошибка выполнения",
  error: "Ошибка",
  skipped: "Пропущено",
};

export const ROUTING_STATUS_LABELS: Record<string, string> = {
  ready: "Готово",
  waiting: "Ожидание",
  blocked: "Заблокировано",
  idle: "Вне активного маршрута",
  eligible: "Доступно к исполнению",
  in_progress: "В работе",
  active_collection: "Активное взыскание",
  court_lane: "Судебный трек",
  enforcement_lane: "Исполнительный трек",
  general: "Общий поток",
};

export const SMART_LEVEL_LABELS: Record<string, string> = {
  ready: "Готово",
  partial: "Частично готово",
  waiting: "Ожидает",
  blocked: "Заблокировано",
};

export const SMART_WARNING_LABELS: Record<string, string> = {
  missing_debtor_name: "Не указано имя/наименование должника",
  missing_inn: "Не указан ИНН",
  missing_due_date: "Не указан срок оплаты",
  missing_principal_amount: "Не указана сумма долга",
  missing_contract_type: "Не указан тип договора",
  draft_status: "Дело находится в черновике",
  archived_case: "Дело находится в архиве",
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

export function formatActionCode(code?: string, fallback = "—") {
  return ACTION_CODE_LABELS[code || ""] || code || fallback;
}

export function formatExecutionStatus(status?: string, fallback = "—") {
  return EXECUTION_STATUS_LABELS[status || ""] || status || fallback;
}

export function formatRoutingStatus(status?: string, fallback = "—") {
  return ROUTING_STATUS_LABELS[status || ""] || status || fallback;
}

export function formatSmartLevel(level?: string, fallback = "—") {
  return SMART_LEVEL_LABELS[level || ""] || level || fallback;
}

export function formatSmartWarning(code?: string, fallback = "—") {
  return SMART_WARNING_LABELS[code || ""] || code || fallback;
}