import { formatDocumentCode } from "./legalLabels";

type Props = {
  selectedCase: number;
  dashboard: any;
  onDownloadDocument: (caseId: number, code: string, format: "pdf" | "docx") => void;
};

function readinessBadgeClass(doc: any) {
  return doc?.ready ? "status-ready" : "status-not-ready";
}

function readinessLabel(doc: any) {
  return doc?.ready ? "Готов к формированию" : "Требуются данные";
}

function buildDocHint(doc: any): string {
  if (Array.isArray(doc?.missing_fields) && doc.missing_fields.length > 0) {
    return `Недостающие данные: ${doc.missing_fields.join(", ")}`;
  }

  if (doc?.description) return String(doc.description);
  if (doc?.hint) return String(doc.hint);

  return doc?.ready
    ? "Документ можно скачать в PDF или DOCX."
    : "Сначала нужно дозаполнить карточку и обязательные поля.";
}

function resolveDocTitle(doc: any): string {
  return doc?.title_ru || doc?.title || formatDocumentCode(doc?.code);
}

export default function CaseDocumentsPanel({
  selectedCase,
  dashboard,
  onDownloadDocument,
}: Props) {
  const documents = Array.isArray(dashboard?.documents) ? dashboard.documents : [];

  const readyCount = documents.filter((doc: any) => Boolean(doc?.ready)).length;
  const blockedCount = documents.filter((doc: any) => !doc?.ready).length;

  return (
    <section className="panel case-embedded-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Document layer</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Документы
          </div>
          <div className="muted">
            Генерация документов по делу, контроль готовности шаблонов и недостающих данных.
          </div>
        </div>
      </div>

      {!!documents.length && (
        <div className="ops-grid ops-grid-compact" style={{ marginBottom: 16 }}>
          <div className="ops-card ops-card-accent">
            <div className="ops-card-title">Всего документов</div>
            <div className="ops-card-value">{documents.length}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Готовы</div>
            <div className="ops-card-value">{readyCount}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Требуют данных</div>
            <div className="ops-card-value">{blockedCount}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Следующий слой</div>
            <div className="ops-card-value">
              {readyCount > 0 ? "Можно формировать" : "Нужно дозаполнение"}
            </div>
          </div>
        </div>
      )}

      <div className="document-list">
        {documents.length ? (
          documents.map((doc: any) => (
            <div className="document-card" key={doc.code}>
              <div className="document-card-top">
                <div>
                  <div className="document-title">{resolveDocTitle(doc)}</div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    {doc.code || "—"}
                  </div>
                </div>

                <span className={`status-badge ${readinessBadgeClass(doc)}`}>
                  {readinessLabel(doc)}
                </span>
              </div>

              <div className="muted" style={{ marginTop: 10 }}>
                {buildDocHint(doc)}
              </div>

              {Array.isArray(doc?.missing_fields) && doc.missing_fields.length > 0 ? (
                <div className="action-list" style={{ marginTop: 10, flexWrap: "wrap" }}>
                  {doc.missing_fields.map((field: string, index: number) => (
                    <span
                      key={`${doc.code}-${field}-${index}`}
                      className="status-badge status-not-ready"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="document-actions" style={{ marginTop: 12 }}>
                <button
                  className="secondary-btn"
                  disabled={!doc.ready}
                  onClick={() => onDownloadDocument(selectedCase, doc.code, "pdf")}
                >
                  Скачать PDF
                </button>

                <button
                  className="secondary-btn"
                  disabled={!doc.ready}
                  onClick={() => onDownloadDocument(selectedCase, doc.code, "docx")}
                >
                  Скачать DOCX
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-box">Документы пока недоступны.</div>
        )}
      </div>
    </section>
  );
}