import RecoveryPanel from "./RecoveryPanel";
import DebtorDashboardPanel from "./DebtorDashboardPanel";
import DebtMapPanel from "./DebtMapPanel";
import DebtorGraphPanel from "./DebtorGraphPanel";
import OrganizationPanel from "./OrganizationPanel";
import IntegrationPanel from "./IntegrationPanel";
import ExternalActionsPanel from "./ExternalActionsPanel";
import ExecutionHistoryPanel from "./ExecutionHistoryPanel";
import IntelligencePanel from "./IntelligencePanel";
import CaseHeader from "./CaseHeader";
import CaseActionsPanel from "./CaseActionsPanel";
import CaseDocumentsPanel from "./CaseDocumentsPanel";
import CaseTimelinePanel from "./CaseTimelinePanel";
import {
  formatCaseStatus,
  formatDebtorType,
  formatFlagLabel,
  formatParticipantRole,
  formatStageStatus,
} from "./legalLabels";
import PlaybookTimelinePanel from "./PlaybookTimelinePanel";
import DecisionExplainPanel from "./DecisionExplainPanel";

type Props = {
  selectedCase: number;
  selectedCaseCard: any;
  dashboard: any;
  timeline: any;
  loadingCase: boolean;
  error: string;
  participants: any[];
  debtorInn: string;
  debtorOgrn: string;
  debtorBusy: boolean;
  debtorMessage: string;
  setDebtorInn: (value: string) => void;
  setDebtorOgrn: (value: string) => void;
  handleLookupOrganization: () => Promise<void> | void;
  handleIdentifyDebtor: () => Promise<void> | void;
  handleRefreshDebtor: () => Promise<void> | void;
  displayedOrganization: any;
  softPolicy: {
    payment_due_notice_delay_days: number;
    debt_notice_delay_days: number;
    pretension_delay_days: number;
  };
  setSoftPolicy: (
    updater:
      | {
          payment_due_notice_delay_days: number;
          debt_notice_delay_days: number;
          pretension_delay_days: number;
        }
      | ((prev: {
          payment_due_notice_delay_days: number;
          debt_notice_delay_days: number;
          pretension_delay_days: number;
        }) => {
          payment_due_notice_delay_days: number;
          debt_notice_delay_days: number;
          pretension_delay_days: number;
        })
  ) => void;
  softPolicyBusy: boolean;
  softPolicyMessage: string;
  handleSaveSoftPolicy: () => Promise<void> | void;
  recommendation: string;
  relatedCases: any[];
  relatedSummary: any;
  debtorId: number | null;
  actionBusy: string;
  runAction: (code: string) => Promise<void> | void;
  onOpenCase: (caseId: number) => void;
  onDownloadDocument: (caseId: number, code: string, format: "pdf" | "docx") => void;
};

function getSmartBlock(dashboard: any) {
  return dashboard?.case?.meta?.smart || dashboard?.case?.smart || dashboard?.smart || null;
}

function readinessLabel(level?: string) {
  if (level === "ready") return "Готово";
  if (level === "partial") return "Частично готово";
  if (level === "waiting") return "Ожидает";
  if (level === "blocked") return "Заблокировано";
  return "Черновик";
}

function readinessClass(level?: string) {
  if (level === "ready") return "is-ready";
  if (level === "partial") return "is-partial";
  if (level === "waiting") return "is-waiting";
  if (level === "blocked") return "is-blocked";
  return "is-draft";
}

function asArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function formatMoney(value: any): string {
  const num = Number(String(value ?? 0).replace(",", "."));
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function safeStatusClass(status?: string | null) {
  return `status-badge status-${String(status || "draft")}`;
}

export default function CaseWorkspace({
  selectedCase,
  selectedCaseCard,
  dashboard,
  timeline,
  loadingCase,
  error,
  participants,
  debtorInn,
  debtorOgrn,
  debtorBusy,
  debtorMessage,
  setDebtorInn,
  setDebtorOgrn,
  handleLookupOrganization,
  handleIdentifyDebtor,
  handleRefreshDebtor,
  displayedOrganization,
  softPolicy,
  setSoftPolicy,
  softPolicyBusy,
  softPolicyMessage,
  handleSaveSoftPolicy,
  recommendation,
  relatedCases,
  relatedSummary,
  debtorId,
  actionBusy,
  runAction,
  onOpenCase,
  onDownloadDocument,
}: Props) {
  const smart = getSmartBlock(dashboard);

  const smartScore = Number(smart?.readiness_score || 0);
  const smartLevel = String(smart?.readiness_level || "draft");
  const smartWarnings = asArray<string>(smart?.warnings);
  const smartSignals = asArray<string>(smart?.signals);
  const smartDuplicates = asArray<any>(smart?.duplicates);
  const smartOrganization = smart?.organization || null;
  const smartCompleteness = smart?.completeness || null;

  const stageFlags = Object.entries(dashboard?.stage?.flags || {});
  const safeParticipants = asArray<any>(participants);
  const safeRelatedCases = asArray<any>(relatedCases);

  if (loadingCase) {
    return (
      <div className="case-workspace">
        <div className="case-main">
          <div className="panel">Загрузка данных дела…</div>
        </div>
        <IntelligencePanel dashboard={dashboard} />
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="case-workspace">
        <div className="case-main">
          <div className="panel error-panel">
            <div className="panel-title">Ошибка загрузки дела</div>
            <div>{error}</div>
          </div>
        </div>
        <IntelligencePanel dashboard={dashboard} />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="case-workspace">
        <div className="case-main">
          <div className="panel">Выберите дело в портфеле или создайте новое.</div>
        </div>
        <IntelligencePanel dashboard={dashboard} />
      </div>
    );
  }

  return (
    <div className="case-workspace">
      <div className="case-main">
        <CaseHeader
          selectedCase={selectedCase}
          selectedCaseCard={selectedCaseCard}
          dashboard={dashboard}
        />

        {!!smart && (
          <section className="case-section-block">
            <div className="case-section-head">
              <div>
                <div className="section-eyebrow">Smart layer</div>
                <div className="panel-title" style={{ marginBottom: 6 }}>
                  Smart readiness по делу
                </div>
                <div className="muted">
                  Быстрая оценка качества карточки, сигналов риска, дубликатов и полноты данных.
                </div>
              </div>
            </div>

            <section className="panel smart-case-panel">
              <div className="smart-case-hero">
                <div className="smart-case-hero-main">
                  <div className="smart-case-hero-label">Readiness score</div>
                  <div className="smart-case-hero-value">{smartScore}</div>

                  <div className={`smart-case-hero-badge ${readinessClass(smartLevel)}`}>
                    {readinessLabel(smartLevel)}
                  </div>

                  <div className="smart-case-hero-progress">
                    <div
                      className={`smart-case-hero-progress-bar ${readinessClass(smartLevel)}`}
                      style={{ width: `${Math.max(6, Math.min(smartScore, 100))}%` }}
                    />
                  </div>

                  <div className="smart-case-hero-caption">
                    {smartLevel === "ready" &&
                      "Карточка заполнена достаточно хорошо для уверенной дальнейшей работы."}
                    {smartLevel === "partial" &&
                      "Карточка рабочая, но есть пробелы, которые желательно закрыть."}
                    {smartLevel === "waiting" &&
                      "Дело пока не готово к активному движению и требует уточнений."}
                    {smartLevel === "blocked" &&
                      "По делу есть ограничения, которые мешают нормальной маршрутизации."}
                    {smartLevel === "draft" &&
                      "Это всё ещё черновик: нужны дополнительные данные для нормальной маршрутизации."}
                  </div>
                </div>

                <div className="smart-case-side-grid">
                  <div className="smart-case-mini-card">
                    <span>Warnings</span>
                    <strong>{smartWarnings.length}</strong>
                  </div>

                  <div className="smart-case-mini-card">
                    <span>Signals</span>
                    <strong>{smartSignals.length}</strong>
                  </div>

                  <div className="smart-case-mini-card">
                    <span>Duplicates</span>
                    <strong>{smartDuplicates.length}</strong>
                  </div>

                  <div className="smart-case-mini-card">
                    <span>Организация</span>
                    <strong>{smartOrganization?.resolved ? "Найдена" : "Нет"}</strong>
                  </div>
                </div>
              </div>

              {!!smartCompleteness && (
                <div className="smart-case-completeness-grid">
                  <div className="smart-case-check-card">
                    <span>ИНН</span>
                    <strong>{smartCompleteness.has_inn ? "Есть" : "Нет"}</strong>
                  </div>

                  <div className="smart-case-check-card">
                    <span>ОГРН</span>
                    <strong>{smartCompleteness.has_ogrn ? "Есть" : "Нет"}</strong>
                  </div>

                  <div className="smart-case-check-card">
                    <span>Срок оплаты</span>
                    <strong>{smartCompleteness.has_due_date ? "Есть" : "Нет"}</strong>
                  </div>

                  <div className="smart-case-check-card">
                    <span>Сумма</span>
                    <strong>{smartCompleteness.has_amount ? "Есть" : "Нет"}</strong>
                  </div>
                </div>
              )}

              {!!smartSignals.length && (
                <div className="smart-case-block">
                  <div className="smart-case-block-title">Сигналы</div>
                  <div className="smart-case-chip-list">
                    {smartSignals.map((item: string, index: number) => (
                      <span key={`${item}:${index}`} className="smart-case-chip">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!!smartWarnings.length && (
                <div className="smart-case-block smart-case-block-warning">
                  <div className="smart-case-block-title">Предупреждения</div>
                  <ul className="smart-case-list">
                    {smartWarnings.map((item: string, index: number) => (
                      <li key={`${item}:${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!smartDuplicates.length && (
                <div className="smart-case-block smart-case-block-duplicate">
                  <div className="smart-case-block-title">Возможные дубликаты</div>
                  <div className="smart-case-duplicate-list">
                    {smartDuplicates.map((item: any, index: number) => (
                      <button
                        type="button"
                        key={`${item.case_id || index}-${item.inn || ""}-${item.ogrn || ""}`}
                        className="smart-case-duplicate-card"
                        onClick={() => item.case_id && onOpenCase(item.case_id)}
                      >
                        <strong>{item.name || "Без названия"}</strong>
                        <div className="muted small">
                          Дело #{item.case_id || "—"}
                          {item.inn ? ` · ИНН ${item.inn}` : ""}
                          {item.ogrn ? ` · ОГРН ${item.ogrn}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </section>
        )}

        <section className="case-section-block">
          <div className="case-section-head">
            <div>
              <div className="section-eyebrow">Playbook flow</div>
              <div className="panel-title" style={{ marginBottom: 6 }}>
                Оркестрация движения дела
              </div>
              <div className="muted">
                Текущий playbook взыскания, шаги процесса, waiting-окна и точка принятия решения.
              </div>
            </div>
          </div>

          <PlaybookTimelinePanel dashboard={dashboard} recommendation={recommendation} />
        </section>

        <section className="case-section-block">
          <div className="case-section-head">
            <div>
              <div className="section-eyebrow">Decision zone</div>
              <div className="panel-title" style={{ marginBottom: 6 }}>
                Текущее решение по делу
              </div>
              <div className="muted">
                Статус, стадия взыскания, следующий шаг и explainability в одной зоне.
              </div>
            </div>
          </div>

          <section className="dashboard-grid">
            <div className="panel">
              <div className="panel-title">Карточка дела</div>

              <div className="info-grid">
                <div className="info-item">
                  <span className="label">Должник</span>
                  <strong>{dashboard?.case?.debtor_name || "—"}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Тип должника</span>
                  <strong>
                    {dashboard?.case?.debtor_type_title ||
                      formatDebtorType(dashboard?.case?.debtor_type)}
                  </strong>
                </div>

                <div className="info-item">
                  <span className="label">Тип договора</span>
                  <strong>
                    {dashboard?.case?.contract_type_title || dashboard?.case?.contract_type || "—"}
                  </strong>
                </div>

                <div className="info-item">
                  <span className="label">Сумма задолженности</span>
                  <strong>{formatMoney(dashboard?.case?.principal_amount)} ₽</strong>
                </div>

                <div className="info-item">
                  <span className="label">Срок оплаты</span>
                  <strong>{dashboard?.case?.due_date || "—"}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Статус дела</span>
                  <strong>
                    {dashboard?.case?.status_title || formatCaseStatus(dashboard?.case?.status)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-title">Стадия взыскания и следующий шаг</div>

              {dashboard?.next_step ? (
                <div className="next-step-box">
                  <div className="next-step-title">
                    {dashboard?.next_step?.title_ru || dashboard?.next_step?.title || "—"}
                  </div>
                  <div className="muted">Код действия: {dashboard?.next_step?.code || "—"}</div>
                </div>
              ) : (
                <div className="empty-box">Доступные действия отсутствуют.</div>
              )}

              <div className="stage-block">
                <div className="label">Текущая стадия</div>
                <div className="stage-title">
                  {dashboard?.stage?.status_title || formatStageStatus(dashboard?.stage?.status)}
                </div>

                <div className="flag-list">
                  {stageFlags.map(([key, value]) => (
                    <span key={key} className={`mini-badge ${value ? "ok" : "muted-badge"}`}>
                      {formatFlagLabel(key)}: {value ? "да" : "нет"}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="dashboard-grid dashboard-grid-secondary">
            <div className="panel">
              <div className="panel-title">Рекомендация по взысканию</div>

              <div className="recommendation-box">
                <div className="recommendation-title">{recommendation}</div>
                <div className="muted">
                  Используйте это как основной следующий шаг по делу.
                </div>
              </div>

              <DecisionExplainPanel explain={dashboard?.decision_explain} />
            </div>

            <CaseActionsPanel
              dashboard={dashboard}
              actionBusy={actionBusy}
              onRunAction={runAction}
            />
          </section>
        </section>

        <section className="case-section-block">
          <div className="case-section-head">
            <div>
              <div className="section-eyebrow">Debtor and policy</div>
              <div className="panel-title" style={{ marginBottom: 6 }}>
                Должник и правила движения кейса
              </div>
              <div className="muted">
                Идентификация должника, профиль организации и параметры soft stage.
              </div>
            </div>
          </div>

          <section className="dashboard-grid dashboard-grid-secondary">
            <div className="panel">
              <div className="panel-title">Профиль должника</div>

              <div className="debtor-actions-form">
                <div className="debtor-actions-row">
                  <input
                    className="small-input"
                    placeholder="ИНН"
                    value={debtorInn}
                    onChange={(e) => setDebtorInn(e.target.value)}
                  />
                  <input
                    className="small-input"
                    placeholder="ОГРН"
                    value={debtorOgrn}
                    onChange={(e) => setDebtorOgrn(e.target.value)}
                  />
                </div>

                <div className="debtor-actions-buttons">
                  <button
                    className="secondary-btn"
                    onClick={handleLookupOrganization}
                    disabled={debtorBusy}
                  >
                    {debtorBusy ? "Поиск…" : "Проверить организацию"}
                  </button>

                  <button
                    className="secondary-btn"
                    onClick={handleIdentifyDebtor}
                    disabled={debtorBusy}
                  >
                    {debtorBusy ? "Сохранение…" : "Сохранить реквизиты"}
                  </button>

                  <button
                    className="primary-btn"
                    onClick={handleRefreshDebtor}
                    disabled={debtorBusy}
                  >
                    {debtorBusy ? "Обновление…" : "Обновить профиль"}
                  </button>
                </div>

                {debtorMessage && <div className="debtor-actions-message">{debtorMessage}</div>}
              </div>

              {displayedOrganization ? (
                <div className="info-grid" style={{ marginTop: 14 }}>
                  <div className="info-item info-item-wide">
                    <span className="label">Полное наименование</span>
                    <strong>{displayedOrganization.name_full || "—"}</strong>
                  </div>

                  <div className="info-item">
                    <span className="label">ИНН</span>
                    <strong>{displayedOrganization.inn || "—"}</strong>
                  </div>

                  <div className="info-item">
                    <span className="label">ОГРН</span>
                    <strong>{displayedOrganization.ogrn || "—"}</strong>
                  </div>

                  <div className="info-item">
                    <span className="label">КПП</span>
                    <strong>{displayedOrganization.kpp || "—"}</strong>
                  </div>

                  <div className="info-item">
                    <span className="label">Руководитель</span>
                    <strong>{displayedOrganization.director_name || "—"}</strong>
                  </div>

                  <div className="info-item">
                    <span className="label">Статус</span>
                    <strong>{displayedOrganization.status || "—"}</strong>
                  </div>

                  <div className="info-item">
                    <span className="label">Дата регистрации</span>
                    <strong>{displayedOrganization.registration_date || "—"}</strong>
                  </div>

                  <div className="info-item">
                    <span className="label">Основной ОКВЭД</span>
                    <strong>{displayedOrganization.okved_main || "—"}</strong>
                  </div>

                  <div className="info-item info-item-wide">
                    <span className="label">Адрес</span>
                    <strong>{displayedOrganization.address || "—"}</strong>
                  </div>

                  <div className="info-item">
                    <span className="label">Источник данных</span>
                    <strong>{displayedOrganization.source || "—"}</strong>
                  </div>
                </div>
              ) : (
                <div className="empty-box" style={{ marginTop: 14 }}>
                  Профиль должника пока не загружен.
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-title">Настройки soft stage</div>

              <div className="muted" style={{ marginBottom: 14 }}>
                Эти сроки определяют внутреннюю политику кредитора до перехода к досудебной
                претензии.
              </div>

              <div className="info-grid" style={{ marginBottom: 14 }}>
                <div className="info-item">
                  <span className="label">Первое уведомление после срока оплаты, дней</span>
                  <input
                    className="small-input"
                    type="number"
                    min={0}
                    value={softPolicy.payment_due_notice_delay_days}
                    onChange={(e) =>
                      setSoftPolicy((prev) => ({
                        ...prev,
                        payment_due_notice_delay_days: Number(e.target.value || 0),
                      }))
                    }
                  />
                </div>

                <div className="info-item">
                  <span className="label">Уведомление о задолженности, дней</span>
                  <input
                    className="small-input"
                    type="number"
                    min={0}
                    value={softPolicy.debt_notice_delay_days}
                    onChange={(e) =>
                      setSoftPolicy((prev) => ({
                        ...prev,
                        debt_notice_delay_days: Number(e.target.value || 0),
                      }))
                    }
                  />
                </div>

                <div className="info-item">
                  <span className="label">Досудебная претензия, дней</span>
                  <input
                    className="small-input"
                    type="number"
                    min={0}
                    value={softPolicy.pretension_delay_days}
                    onChange={(e) =>
                      setSoftPolicy((prev) => ({
                        ...prev,
                        pretension_delay_days: Number(e.target.value || 0),
                      }))
                    }
                  />
                </div>

                <div className="info-item">
                  <span className="label">Базовая дата</span>
                  <strong>
                    {dashboard?.policy_timing?.base_due_date || dashboard?.case?.due_date || "—"}
                  </strong>
                </div>

                <div className="info-item">
                  <span className="label">Дата первого уведомления</span>
                  <strong>{dashboard?.policy_timing?.payment_due_notice_eligible_at || "—"}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Дата уведомления о задолженности</span>
                  <strong>{dashboard?.policy_timing?.debt_notice_eligible_at || "—"}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Дата досудебной претензии</span>
                  <strong>{dashboard?.policy_timing?.pretension_eligible_at || "—"}</strong>
                </div>
              </div>

              <div className="action-list">
                <button
                  className="primary-btn"
                  onClick={handleSaveSoftPolicy}
                  disabled={softPolicyBusy}
                >
                  {softPolicyBusy ? "Сохранение…" : "Сохранить настройки"}
                </button>
              </div>

              {softPolicyMessage && (
                <div className="form-message" style={{ marginTop: 12 }}>
                  {softPolicyMessage}
                </div>
              )}
            </div>
          </section>
        </section>

        <section className="case-section-block">
          <div className="case-section-head">
            <div>
              <div className="section-eyebrow">Recovery control</div>
              <div className="panel-title" style={{ marginBottom: 6 }}>
                Recovery и debtor-level обзор
              </div>
              <div className="muted">
                Финансовая часть кейса и общий контекст по должнику в одном рабочем слое.
              </div>
            </div>
          </div>

          <section className="dashboard-grid dashboard-grid-secondary">
            <RecoveryPanel caseId={selectedCase} />
            <DebtorDashboardPanel debtorId={debtorId} onOpenCase={onOpenCase} />
          </section>
        </section>

        <section className="case-section-block">
          <div className="case-section-head">
            <div>
              <div className="section-eyebrow">Operations deck</div>
              <div className="panel-title" style={{ marginBottom: 6 }}>
                Операционная зона исполнения
              </div>
              <div className="muted">
                Документы, интеграции, внешние действия и execution-log в едином рабочем слое.
              </div>
            </div>
          </div>

          <section className="case-ops-deck">
            <div className="case-ops-deck-main">
              <CaseDocumentsPanel
                selectedCase={selectedCase}
                dashboard={dashboard}
                onDownloadDocument={onDownloadDocument}
              />

              <ExecutionHistoryPanel caseId={selectedCase} />
            </div>

            <div className="case-ops-deck-side">
              <IntegrationPanel caseId={selectedCase} />
              <ExternalActionsPanel caseId={selectedCase} />
            </div>
          </section>

          <OrganizationPanel caseId={selectedCase} onOpenCase={onOpenCase} />
        </section>

        <section className="case-section-block">
          <div className="case-section-head">
            <div>
              <div className="section-eyebrow">Network and context</div>
              <div className="panel-title" style={{ marginBottom: 6 }}>
                Связи, участники и смежные кейсы
              </div>
              <div className="muted">
                Полезный контекст по должнику, связанным лицам и другим делам.
              </div>
            </div>
          </div>

          <section className="panel">
            <div className="panel-title">Участники дела</div>

            {safeParticipants.length ? (
              <div className="participants-list">
                {safeParticipants.map((participant: any) => (
                  <div className="participant-card" key={participant.id}>
                    <div className="participant-card-top">
                      <div>
                        <div className="participant-role">
                          {formatParticipantRole(participant.role)}
                        </div>
                        <div className="participant-name">{participant.party?.name || "—"}</div>
                      </div>

                      <div className="participant-badges">
                        {participant.is_primary && (
                          <span className="status-badge status-ready">Основной участник</span>
                        )}
                      </div>
                    </div>

                    <div className="participant-meta-grid">
                      <div className="info-item">
                        <span className="label">Тип участника</span>
                        <strong>{formatDebtorType(participant.party?.debtor_type)}</strong>
                      </div>

                      <div className="info-item">
                        <span className="label">ИНН</span>
                        <strong>{participant.party?.inn || "—"}</strong>
                      </div>

                      <div className="info-item">
                        <span className="label">ОГРН</span>
                        <strong>{participant.party?.ogrn || "—"}</strong>
                      </div>

                      <div className="info-item">
                        <span className="label">Руководитель</span>
                        <strong>{participant.party?.director_name || "—"}</strong>
                      </div>

                      <div className="info-item info-item-wide">
                        <span className="label">Адрес</span>
                        <strong>{participant.party?.address || "—"}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-box">Участники дела пока не сформированы.</div>
            )}
          </section>

          <section className="dashboard-grid dashboard-grid-secondary">
            <DebtMapPanel caseId={selectedCase} onOpenCase={onOpenCase} />
            <DebtorGraphPanel caseId={selectedCase} onOpenCase={onOpenCase} />
          </section>

          <section className="panel">
            <div className="panel-title">Другие дела этого должника</div>

            {relatedSummary && (
              <div className="debtor-cases-summary">
                <div className="summary-card">
                  <span className="label">Количество дел</span>
                  <strong>{relatedSummary.cases_count || 0}</strong>
                </div>
                <div className="summary-card">
                  <span className="label">Общая сумма задолженности</span>
                  <strong>{formatMoney(relatedSummary.total_principal_amount)} ₽</strong>
                </div>
              </div>
            )}

            <div className="related-cases-list">
              {safeRelatedCases.length ? (
                safeRelatedCases.map((item: any) => (
                  <button
                    key={item.case_id}
                    className={`related-case-card ${item.is_current ? "is-current" : ""}`}
                    onClick={() => onOpenCase(item.case_id)}
                  >
                    <div className="related-case-top">
                      <strong>Дело №{item.case_id}</strong>
                      <span className={safeStatusClass(item.status)}>
                        {item.status_title || formatCaseStatus(item.status)}
                      </span>
                    </div>

                    <div className="muted">
                      {(item.contract_type_title || item.contract_type || "—") +
                        " · " +
                        formatMoney(item.principal_amount) +
                        " ₽"}
                    </div>

                    <div className="muted small">Срок оплаты: {item.due_date || "—"}</div>
                  </button>
                ))
              ) : (
                <div className="empty-box">Других дел по должнику пока нет.</div>
              )}
            </div>
          </section>
        </section>

        <section className="case-section-block">
          <div className="case-section-head">
            <div>
              <div className="section-eyebrow">Timeline</div>
              <div className="panel-title" style={{ marginBottom: 6 }}>
                Timeline жизни дела
              </div>
              <div className="muted">Хронология ключевых событий внутри process engine.</div>
            </div>
          </div>

          <CaseTimelinePanel timeline={timeline} />
        </section>
      </div>

      <IntelligencePanel dashboard={dashboard} />
    </div>
  );
}