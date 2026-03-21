import { useEffect, useMemo, useState } from "react";
import { getUserWorkspaces } from "./api";
import {
  clearActiveWorkspace,
  getActiveWorkspace,
  setActiveWorkspace,
} from "./workspace";

type Workspace = {
  membership_id?: number;
  role: string;
  status?: string;
  workspace: {
    id: number;
    name: string;
    slug: string;
  };
};

function roleLabel(role?: string) {
  const map: Record<string, string> = {
    owner: "owner",
    admin: "admin",
    member: "member",
    viewer: "viewer",
  };

  return map[String(role || "")] || role || "member";
}

function workspaceStatusLabel(status?: string) {
  const map: Record<string, string> = {
    active: "active",
    invited: "invited",
    suspended: "suspended",
  };

  return map[String(status || "")] || status || "active";
}

export default function WorkspaceSwitcher() {
  const [items, setItems] = useState<Workspace[]>([]);
  const [active, setActive] = useState<number | null>(getActiveWorkspace());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        const result = await getUserWorkspaces(1);
        const list = Array.isArray(result?.items) ? result.items : [];

        if (cancelled) return;
        setItems(list);

        if (!list.length) {
          clearActiveWorkspace();
          setActive(null);
          return;
        }

        const stored = getActiveWorkspace();
        const hasStored = list.some((item: Workspace) => item.workspace.id === stored);

        if (hasStored) {
          setActive(stored);
          return;
        }

        const firstId = list[0].workspace.id;
        setActiveWorkspace(firstId);
        setActive(firstId);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeWorkspace = useMemo(
    () => items.find((item) => item.workspace.id === active) || null,
    [items, active]
  );

  function handleChange(id: number) {
    if (!id || id === active) return;

    setActiveWorkspace(id);
    setActive(id);
    window.location.reload();
  }

  if (!items.length) {
    return null;
  }

  return (
    <div className="workspace-switcher" style={{ minWidth: 220 }}>
      <select
        className="small-input"
        value={active ?? ""}
        onChange={(e) => handleChange(Number(e.target.value))}
        disabled={loading}
        title={
          activeWorkspace
            ? `${activeWorkspace.workspace.name} (${roleLabel(
                activeWorkspace.role
              )}, ${workspaceStatusLabel(activeWorkspace.status)})`
            : "Workspace"
        }
      >
        {items.map((item) => (
          <option key={item.workspace.id} value={item.workspace.id}>
            {item.workspace.name} ({roleLabel(item.role)})
          </option>
        ))}
      </select>
    </div>
  );
}