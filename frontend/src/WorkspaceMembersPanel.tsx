import { useEffect, useState } from "react";
import { getWorkspaceMembers } from "./api";
import { getActiveWorkspace } from "./workspace";

type Member = {
  id: number;
  email: string;
  role: string;
};

export default function WorkspaceMembersPanel() {
  const [items, setItems] = useState<Member[]>([]);
  const workspaceId = getActiveWorkspace();

  useEffect(() => {
    if (!workspaceId) return;

    async function load() {
      try {
        const result = await getWorkspaceMembers(workspaceId);
        setItems(result?.items || []);
      } catch (e) {
        console.error(e);
      }
    }

    load();
  }, [workspaceId]);

  if (!workspaceId) return null;

  return (
    <section className="panel">
      <div className="panel-title">Workspace Members</div>

      <div className="participants-list">
        {items.map((item) => (
          <div key={item.id} className="related-case-card">
            <strong>{item.email}</strong>

            <div className="muted small">{item.role}</div>
          </div>
        ))}
      </div>
    </section>
  );
}