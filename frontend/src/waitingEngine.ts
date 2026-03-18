type WaitingLike = {
  step_code?: string | null;
  reason?: string | null;
  reason_text?: string | null;
  reason_code?: string | null;
  eligible_at?: string | null;
};

export function formatWaitingStep(step?: string | null): string {
  const map: Record<string, string> = {
    payment_due_notice: "1-е напоминание",
    debt_notice: "Уведомление о задолженности",
    pretension: "Досудебная претензия",
    generate_lawsuit: "Подготовка иска",
    submit_to_court: "Подача в суд",
    send_to_fssp: "Отправка в ФССП",
  };

  return map[String(step || "")] || step || "—";
}

export function formatWaitingReason(value?: WaitingLike | string | null): string {
  if (!value) return "Ожидает наступления условий выполнения";

  if (typeof value === "string") {
    return value;
  }

  const raw =
    value.reason ||
    value.reason_text ||
    reasonCodeLabel(value.reason_code) ||
    null;

  return raw || "Ожидает наступления условий выполнения";
}

export function formatEligibleAt(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ru-RU");
}

export function isEligibleReached(value?: string | null): boolean {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return date.getTime() <= Date.now();
}

export function buildWaitingHint(item?: WaitingLike | null): string {
  if (!item) return "Ожидает окна выполнения";

  const reason = formatWaitingReason(item);
  const eligibleAt = item.eligible_at;

  if (!eligibleAt) return reason;

  if (isEligibleReached(eligibleAt)) {
    return `Срок ожидания наступил · ${reason}`;
  }

  return `${reason} · до ${formatEligibleAt(eligibleAt)}`;
}

export function waitingBadgeLabel(item?: WaitingLike | null): string {
  if (!item?.eligible_at) return "Waiting";

  return isEligibleReached(item.eligible_at) ? "Ready soon" : "Waiting";
}

function reasonCodeLabel(code?: string | null): string | null {
  const map: Record<string, string> = {
    wait_after_due_notice: "Ожидание после напоминания о сроке оплаты",
    wait_after_debt_notice: "Ожидание после уведомления о задолженности",
    wait_after_pretension: "Ожидание после досудебной претензии",
    wait_after_court_result: "Ожидание судебного результата / исполнительного документа",
  };

  return map[String(code || "")] || null;
}