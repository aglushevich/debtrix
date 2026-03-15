from __future__ import annotations


class EsiaProviderAdapter:
    def build_authorization_url(
        self,
        *,
        state_token: str,
        action_id: int,
        provider: str,
    ) -> dict[str, str]:
        auth_url = (
            "https://esia.example.local/auth"
            f"?state={state_token}"
            f"&action_id={action_id}"
            f"&provider={provider}"
        )
        return {"auth_url": auth_url}