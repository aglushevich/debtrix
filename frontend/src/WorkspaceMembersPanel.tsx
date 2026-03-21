import { useEffect, useState } from "react";
import { getWorkspaceMembers } from "./api";
import { getActiveWorkspace } from "./workspace";

type Member = {
  id: number;
  email: string;
  role: string;
};

function roleLabel(role?: string) {
  const map: Record<string, string> = {
    viewer: "Viewer",
    operator: "Operator",
    admin: "Admin",
  };

  return map[String(role || "")] || role || "—";
}

export default function WorkspaceMembersPanel() {
  const [items, setItems] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const workspaceId = getActiveWorkspace();

  async function load() {
    if (!workspaceId) {
      setItems([]);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const result = await getWorkspaceMembers(workspaceId);
      setItems(result?.items || []);
    } catch (e: any) {
      setItems([]);
      setError(e?.message || "Не удалось загрузить участников workspace.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [workspaceId]);

  if (!workspaceId) return null;

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Workspace access</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Участники workspace
          </div>
          <div className="muted">
            Кто сейчас имеет доступ к текущему рабочему пространству.
          </div>
        </div>

        <div className="action-list">
          <button className="secondary-btn" onClick={() => void load()} disabled={loading}>
            {loading ? "Обновляем…" : "Обновить"}
          </button>
        </div>
      </div>

      {!loading && !error && items.length > 0 && (
        <div className="ops-grid ops-grid-compact" style={{ marginBottom: 16 }}>
          <div className="ops-card ops-card-accent">
            <div className="ops-card-title">Всего участников</div>
            <div className="ops-card-value">{items.length}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Admins</div>
            <div className="ops-card-value">
              {items.filter((item) => item.role === "admin").length}
            </div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Operators</div>
            <div className="ops-card-value">
              {items.filter((item) => item.role === "operator").length}
            </div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Viewers</div>
            <div className="ops-card-value">
              {items.filter((item) => item.role === "viewer").length}
            </div>
          </div>
        </div>
      )}

      {loading && <div className="empty-box">Загрузка участников workspace…</div>}
      {!loading && error && <div className="empty-box">{error}</div>}

      {!loading && !error && !items.length && (
        <div className="empty-box">Участники workspace пока не найдены.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="participants-list">
          {items.map((item) => (
            <div key={item.id} className="participant-card">
              <div className="participant-card-top">
                <div>
                  <div className="participant-role">Участник</div>
                  <div className="participant-name">{item.email}</div>
                </div>

                <div className="participant-badges">
                  <span className="status-badge status-pretrial">
                    {roleLabel(item.role)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}