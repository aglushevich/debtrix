import { useEffect, useState } from "react";
import { getUserWorkspaces } from "./api";
import { getActiveWorkspace, setActiveWorkspace } from "./workspace";

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

export default function WorkspaceSwitcher() {
  const [items, setItems] = useState<Workspace[]>([]);
  const [active, setActive] = useState<number | null>(getActiveWorkspace());

  useEffect(() => {
    async function load() {
      try {
        const result = await getUserWorkspaces(1);
        const list = result?.items || [];

        setItems(list);

        if (!active && list.length) {
          setActiveWorkspace(list[0].workspace.id);
          setActive(list[0].workspace.id);
        }
      } catch (e) {
        console.error(e);
      }
    }

    load();
  }, [active]);

  function handleChange(id: number) {
    setActiveWorkspace(id);
    setActive(id);
    window.location.reload();
  }

  if (!items.length) {
    return null;
  }

  return (
    <div className="workspace-switcher">
      <select
        value={active ?? ""}
        onChange={(e) => handleChange(Number(e.target.value))}
      >
        {items.map((item) => (
          <option key={item.workspace.id} value={item.workspace.id}>
            {item.workspace.name} ({item.role})
          </option>
        ))}
      </select>
    </div>
  );
}