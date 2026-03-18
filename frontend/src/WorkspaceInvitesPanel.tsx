import { useEffect, useState } from "react";
import { createWorkspaceInvite, getWorkspaceInvites } from "./api";
import { getActiveWorkspace } from "./workspace";

type Invite = {
  id: number;
  email: string;
  role: string;
  status: string;
};

export default function WorkspaceInvitesPanel() {
  const [items, setItems] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");

  const workspaceId = getActiveWorkspace();

  async function load() {
    if (!workspaceId) return;

    const result = await getWorkspaceInvites(workspaceId);
    setItems(result?.items || []);
  }

  useEffect(() => {
    load();
  }, [workspaceId]);

  async function invite() {
    if (!workspaceId || !email) return;

    await createWorkspaceInvite(workspaceId, {
      email,
      role,
    });

    setEmail("");
    load();
  }

  if (!workspaceId) return null;

  return (
    <section className="panel">
      <div className="panel-title">Workspace Invites</div>

      <div className="sidebar-form-row">
        <input
          className="sidebar-text-input"
          placeholder="email"
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

        <button className="primary-btn" onClick={invite}>
          Invite
        </button>
      </div>

      <div className="participants-list" style={{ marginTop: 12 }}>
        {items.map((item) => (
          <div key={item.id} className="related-case-card">
            <strong>{item.email}</strong>

            <div className="muted small">
              {item.role} · {item.status}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}