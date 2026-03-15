from __future__ import annotations

from pathlib import Path


class LocalStorageService:
    def __init__(self, base_dir: str = "./backend/storage/generated_documents"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save_text(
        self,
        *,
        tenant_id: int,
        case_id: int,
        filename: str,
        content: str,
    ) -> str:
        tenant_dir = self.base_dir / f"tenant_{tenant_id}" / f"case_{case_id}"
        tenant_dir.mkdir(parents=True, exist_ok=True)

        file_path = tenant_dir / filename
        file_path.write_text(content, encoding="utf-8")

        return str(file_path)