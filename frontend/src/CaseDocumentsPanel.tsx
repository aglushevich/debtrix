import { formatDocumentCode } from "./legalLabels";

type Props = {
  selectedCase: number;
  dashboard: any;
  onDownloadDocument: (caseId: number, code: string, format: "pdf" | "docx") => void;
};

export default function CaseDocumentsPanel({
  selectedCase,
  dashboard,
  onDownloadDocument,
}: Props) {
  return (
    <section className="panel">
      <div className="panel-title">Документы</div>

      <div className="document-list">
        {dashboard?.documents?.length ? (
          dashboard.documents.map((doc: any) => (
            <div className="document-card" key={doc.code}>
              <div className="document-card-top">
                <div>
                  <div className="document-title">
                    {doc.title_ru || doc.title || formatDocumentCode(doc.code)}
                  </div>
                  <div className="muted">{doc.code}</div>
                </div>

                <span
                  className={`status-badge ${
                    doc.ready ? "status-ready" : "status-not-ready"
                  }`}
                >
                  {doc.ready ? "Готов к формированию" : "Требуются данные"}
                </span>
              </div>

              {doc.missing_fields?.length > 0 && (
                <div className="missing-fields">
                  Недостающие данные: {doc.missing_fields.join(", ")}
                </div>
              )}

              <div className="document-actions">
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