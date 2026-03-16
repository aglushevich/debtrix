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

  if (!dashboard && !error) {
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

        <section className="case-section-block">
          <div className="case-section-head">
            <div>
              <div className="section-eyebrow">Decision zone</div>
              <div className="panel-title" style={{ marginBottom: 6 }}>
                Текущее решение по делу
              </div>
              <div className="muted">
                Статус, стадия взыскания и рекомендуемый следующий шаг.
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
                    {dashboard?.case?.contract_type_title ||
                      dashboard?.case?.contract_type ||
                      "—"}
                  </strong>
                </div>

                <div className="info-item">
                  <span className="label">Сумма задолженности</span>
                  <strong>{dashboard?.case?.principal_amount || "—"} ₽</strong>
                </div>

                <div className="info-item">
                  <span className="label">Срок оплаты</span>
                  <strong>{dashboard?.case?.due_date || "—"}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Статус дела</span>
                  <strong>
                    {dashboard?.case?.status_title ||
                      formatCaseStatus(dashboard?.case?.status)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-title">Стадия взыскания и следующий шаг</div>

              {dashboard?.next_step ? (
                <div className="next-step-box">
                  <div className="next-step-title">
                    {dashboard.next_step.title_ru || dashboard.next_step.title}
                  </div>
                  <div className="muted">Код действия: {dashboard.next_step.code}</div>
                </div>
              ) : (
                <div className="empty-box">Доступные действия отсутствуют.</div>
              )}

              <div className="stage-block">
                <div className="label">Текущая стадия</div>
                <div className="stage-title">
                  {dashboard?.stage?.status_title ||
                    formatStageStatus(dashboard?.stage?.status)}
                </div>

                <div className="flag-list">
                  {Object.entries(dashboard?.stage?.flags || {}).map(([key, value]) => (
                    <span
                      key={key}
                      className={`mini-badge ${value ? "ok" : "muted-badge"}`}
                    >
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

                {debtorMessage && (
                  <div className="debtor-actions-message">{debtorMessage}</div>
                )}
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
                Эти сроки определяют внутреннюю политику кредитора до перехода к
                досудебной претензии.
              </div>

              <div className="info-grid" style={{ marginBottom: 14 }}>
                <div className="info-item">
                  <span className="label">
                    Первое уведомление после срока оплаты, дней
                  </span>
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
                    {dashboard?.policy_timing?.base_due_date ||
                      dashboard?.case?.due_date ||
                      "—"}
                  </strong>
                </div>

                <div className="info-item">
                  <span className="label">Дата первого уведомления</span>
                  <strong>
                    {dashboard?.policy_timing?.payment_due_notice_eligible_at || "—"}
                  </strong>
                </div>

                <div className="info-item">
                  <span className="label">Дата уведомления о задолженности</span>
                  <strong>
                    {dashboard?.policy_timing?.debt_notice_eligible_at || "—"}
                  </strong>
                </div>

                <div className="info-item">
                  <span className="label">Дата досудебной претензии</span>
                  <strong>
                    {dashboard?.policy_timing?.pretension_eligible_at || "—"}
                  </strong>
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
              <div className="section-eyebrow">Documents and integrations</div>
              <div className="panel-title" style={{ marginBottom: 6 }}>
                Документы, интеграции и внешние действия
              </div>
              <div className="muted">
                Рабочая зона подготовки документов и взаимодействия с внешними провайдерами.
              </div>
            </div>
          </div>

          <CaseDocumentsPanel
            selectedCase={selectedCase}
            dashboard={dashboard}
            onDownloadDocument={onDownloadDocument}
          />

          <OrganizationPanel caseId={selectedCase} onOpenCase={onOpenCase} />
          <IntegrationPanel caseId={selectedCase} />
          <ExternalActionsPanel caseId={selectedCase} />
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

            {participants.length ? (
              <div className="participants-list">
                {participants.map((participant: any) => (
                  <div className="participant-card" key={participant.id}>
                    <div className="participant-card-top">
                      <div>
                        <div className="participant-role">
                          {formatParticipantRole(participant.role)}
                        </div>
                        <div className="participant-name">
                          {participant.party?.name || "—"}
                        </div>
                      </div>

                      <div className="participant-badges">
                        {participant.is_primary && (
                          <span className="status-badge status-ready">
                            Основной участник
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="participant-meta-grid">
                      <div className="info-item">
                        <span className="label">Тип участника</span>
                        <strong>
                          {formatDebtorType(participant.party?.debtor_type)}
                        </strong>
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

          <DebtMapPanel caseId={selectedCase} onOpenCase={onOpenCase} />
          <DebtorGraphPanel caseId={selectedCase} onOpenCase={onOpenCase} />
          <DebtorDashboardPanel debtorId={debtorId} onOpenCase={onOpenCase} />

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
                  <strong>{relatedSummary.total_principal_amount || "0.00"} ₽</strong>
                </div>
              </div>
            )}

            <div className="related-cases-list">
              {relatedCases.length ? (
                relatedCases.map((item: any) => (
                  <button
                    key={item.case_id}
                    className={`related-case-card ${item.is_current ? "is-current" : ""}`}
                    onClick={() => onOpenCase(item.case_id)}
                  >
                    <div className="related-case-top">
                      <strong>Дело №{item.case_id}</strong>
                      <span className={`status-badge status-${item.status}`}>
                        {item.status_title || formatCaseStatus(item.status)}
                      </span>
                    </div>

                    <div className="muted">
                      {(item.contract_type_title || item.contract_type || "—") +
                        " · " +
                        (item.principal_amount || "—") +
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
              <div className="section-eyebrow">Recovery and history</div>
              <div className="panel-title" style={{ marginBottom: 6 }}>
                Recovery, execution и история
              </div>
              <div className="muted">
                Финансовая часть, история исполнения и хронология жизни дела.
              </div>
            </div>
          </div>

          <RecoveryPanel caseId={selectedCase} />
          <ExecutionHistoryPanel caseId={selectedCase} />
          <CaseTimelinePanel timeline={timeline} />
        </section>
      </div>

      <IntelligencePanel dashboard={dashboard} />
    </div>
  );
}