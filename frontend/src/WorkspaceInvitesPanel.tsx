import { useEffect, useMemo, useState } from "react";
import { createWorkspaceInvite, getWorkspaceInvites } from "./api";
import { getActiveWorkspace } from "./workspace";

type Invite = {
  id: number;
  email: string;
  role: string;
  status: string;
};

function roleLabel(role?: string) {
  const map: Record<string, string> = {
    viewer: "Viewer",
    operator: "Operator",
    admin: "Admin",
  };

  return map[String(role || "")] || role || "—";
}

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    pending: "Ожидает принятия",
    accepted: "Принято",
    expired: "Истекло",
    revoked: "Отозвано",
  };

  return map[String(status || "")] || status || "—";
}

function statusClass(status?: string) {
  const map: Record<string, string> = {
    pending: "status-waiting",
    accepted: "status-ready",
    expired: "status-not-ready",
    revoked: "status-overdue",
  };

  return map[String(status || "")] || "status-draft";
}

export default function WorkspaceInvitesPanel() {
  const [items, setItems] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const workspaceId = getActiveWorkspace();

  async function load() {
    if (!workspaceId) {
      setItems([]);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const result = await getWorkspaceInvites(workspaceId);
      setItems(result?.items || []);
    } catch (e: any) {
      setItems([]);
      setError(e?.message || "Не удалось загрузить приглашения.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [workspaceId]);

  async function invite() {
    if (!workspaceId || !email.trim()) return;

    try {
      setBusy(true);
      setError("");
      setMessage("");

      await createWorkspaceInvite(workspaceId, {
        email: email.trim(),
        role,
      });

      setEmail("");
      setRole("viewer");
      setMessage("Приглашение отправлено.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Не удалось отправить приглашение.");
    } finally {
      setBusy(false);
    }
  }

  const summary = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter((item) => item.status === "pending").length,
      accepted: items.filter((item) => item.status === "accepted").length,
      expired: items.filter((item) => item.status === "expired").length,
    };
  }, [items]);

  if (!workspaceId) return null;

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Workspace access</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Приглашения в workspace
          </div>
          <div className="muted">
            Управление инвайтами для доступа к текущему рабочему пространству.
          </div>
        </div>

        <div className="action-list">
          <button className="secondary-btn" onClick={() => void load()} disabled={loading}>
            {loading ? "Обновляем…" : "Обновить"}
          </button>
        </div>
      </div>

      <div className="ops-grid ops-grid-compact" style={{ marginBottom: 16 }}>
        <div className="ops-card ops-card-accent">
          <div className="ops-card-title">Всего приглашений</div>
          <div className="ops-card-value">{summary.total}</div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Pending</div>
          <div className="ops-card-value">{summary.pending}</div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Accepted</div>
          <div className="ops-card-value">{summary.accepted}</div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Expired</div>
          <div className="ops-card-value">{summary.expired}</div>
        </div>
      </div>

      <section className="panel panel-nested" style={{ marginBottom: 16 }}>
        <div className="panel-title">Новое приглашение</div>

        <div className="sidebar-form-row">
          <input
            className="sidebar-text-input"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <select
            className="sidebar-select-input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="viewer">Viewer</option>
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </select>

          <button className="primary-btn" onClick={invite} disabled={busy || !email.trim()}>
            {busy ? "Отправляем…" : "Пригласить"}
          </button>
        </div>

        {message && (
          <div className="form-message" style={{ marginTop: 12 }}>
            {message}
          </div>
        )}

        {error && (
          <div className="empty-box" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </section>

      {loading && <div className="empty-box">Загрузка приглашений workspace…</div>}

      {!loading && !items.length && !error && (
        <div className="empty-box">Приглашений пока нет.</div>
      )}

      {!loading && items.length > 0 && (
        <div className="participants-list">
          {items.map((item) => (
            <div key={item.id} className="participant-card">
              <div className="participant-card-top">
                <div>
                  <div className="participant-role">Invite</div>
                  <div className="participant-name">{item.email}</div>
                </div>

                <div className="participant-badges">
                  <span className={`status-badge ${statusClass(item.status)}`}>
                    {statusLabel(item.status)}
                  </span>
                </div>
              </div>

              <div className="participant-meta-grid">
                <div className="info-item">
                  <span className="label">Роль</span>
                  <strong>{roleLabel(item.role)}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Статус</span>
                  <strong>{statusLabel(item.status)}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}