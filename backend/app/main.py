from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import Body, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.app.api.batch_action_router import router as batch_action_router
from backend.app.api.case_command_router import router as case_command_router
from backend.app.api.control_room_router import router as control_room_router
from backend.app.api.creditor_profile_router import router as creditor_profile_router
from backend.app.api.document_download_router import router as document_download_router
from backend.app.api.execution_log_router import router as execution_router
from backend.app.api.workspace_router import router as workspace_router
from backend.app.database import get_db
from backend.app.schema_bootstrap import ensure_schema

from backend.app.models import (
    Case,
    CaseParticipant,
    CaseProjection,
    DebtorProfile,
    PlaybookDefinition,
    PlaybookStep,
    TimelineEvent,
)

from backend.app.schemas.automation import (
    AutomationRunExecuteRequest,
    AutomationRunStartRequest,
)
from backend.app.schemas.batch import BatchJobCreate, BatchJobExecuteRequest
from backend.app.schemas.batch_execution import BatchJobStartRequest
from backend.app.schemas.case import CaseCreate, CaseResponse
from backend.app.schemas.debtor import (
    DebtorIdentifyRequest,
    DebtorProfileResponse,
    DebtorRefreshRequest,
)
from backend.app.schemas.document_engine import (
    DocumentGenerateRequest,
    DocumentTemplateCreate,
)
from backend.app.schemas.playbook import PlaybookResponse
from backend.app.schemas.portfolio import (
    PortfolioBatchFromViewCreate,
    PortfolioQueryRequest,
    PortfolioRoutingResponse,
    PortfolioViewCreate,
    PortfolioViewUpdate,
    WaitingBucketsResponse,
)
from backend.app.schemas.snapshot import SnapshotResponse

from backend.app.services.action_service import get_available_actions
from backend.app.services.automation_engine_service import (
    execute_automation_run,
    get_automation_run_detail,
    get_waiting_bucket,
    list_automation_runs,
    start_automation_run_for_cases,
)
from backend.app.services.automation_rule_service import (
    list_automation_rules,
    upsert_default_automation_rules,
)
from backend.app.services.batch_execution_service import (
    get_batch_job_detail,
    get_portfolio_waiting_bucket,
    list_batch_jobs as list_batch_jobs_scaffold,
    start_batch_job,
)
from backend.app.services.batch_job_service import (
    create_batch_job,
    create_batch_job_from_portfolio_view,
    execute_batch_job,
    get_batch_job_or_404,
    list_batch_job_items,
    list_batch_jobs,
    rebuild_batch_job_summary,
)
from backend.app.services.case_dashboard_service import build_case_dashboard
from backend.app.services.case_service import (
    apply_action_write,
    create_case_write,
    get_projection_data_or_rebuild,
    sync_and_persist_case,
)
from backend.app.services.debtor_service import (
    normalize_and_validate_inn_ogrn,
    resolve_inn_ogrn_with_fallback,
)
from backend.app.services.document_engine_service import (
    create_document_template,
    generate_document_for_case,
    list_document_templates,
    list_generated_documents,
)
from backend.app.services.document_readiness_service import get_document_readiness
from backend.app.services.document_stage_service import get_available_documents
from backend.app.services.esia_session_service import (
    authorize_esia_session,
    start_esia_session_for_action,
)
from backend.app.services.external_action_service import (
    list_external_actions,
    prepare_external_action,
)
from backend.app.services.fns_sync_service import run_fns_case_sync
from backend.app.services.fssp_sync_service import run_fssp_case_check
from backend.app.services.integration_service import get_case_integrations_status
from backend.app.services.organization_lookup_service import (
    lookup_organization_by_identifiers,
)
from backend.app.services.outbound_gateway_service import dispatch_external_action
from backend.app.services.playbook_engine_service import evaluate_case_playbook
from backend.app.services.playbook_registry_service import list_default_playbooks
from backend.app.services.portfolio_query_service import (
    portfolio_buckets,
    portfolio_summary,
    query_portfolio,
)
from backend.app.services.portfolio_routing_service import build_portfolio_routing
from backend.app.services.portfolio_view_service import (
    create_portfolio_view,
    delete_portfolio_view,
    get_portfolio_view_or_404,
    list_portfolio_views,
    update_portfolio_view,
)
from backend.app.services.tenant_query_service import (
    filter_case_participants_by_tenant,
    filter_cases_by_tenant,
    filter_debtor_profiles_by_tenant,
    load_case_for_tenant_or_404,
    resolve_current_tenant_id,
)
from backend.app.services.tenant_service import bootstrap_tenants_for_existing_data
from backend.app.services.waiting_bucket_service import list_waiting_buckets

from backend.app.api.recovery_dashboard_router import router as recovery_dashboard_router

app = FastAPI(
    title="Debtrix",
    description="Debtrix — process engine / case engine для взыскания задолженности",
    version="0.1.0",
    root_path="/proxy/8000",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(execution_router)
app.include_router(creditor_profile_router)
app.include_router(document_download_router)
app.include_router(batch_action_router)
app.include_router(control_room_router)
app.include_router(workspace_router)
app.include_router(case_command_router)
app.include_router(recovery_dashboard_router)


@app.on_event("startup")
def on_startup() -> None:
    ensure_schema()


def get_current_tenant_id(
    db: Session = Depends(get_db),
    tenant_id: Optional[int] = Query(default=None, alias="tenant_id"),
) -> int:
    return resolve_current_tenant_id(db, tenant_id)


def _normalize_soft_policy_payload(payload: dict) -> dict[str, int]:
    policy = {
        "payment_due_notice_delay_days": int(payload.get("payment_due_notice_delay_days", 0)),
        "debt_notice_delay_days": int(payload.get("debt_notice_delay_days", 3)),
        "pretension_delay_days": int(payload.get("pretension_delay_days", 10)),
    }

    for key, value in policy.items():
        if value < 0:
            raise HTTPException(status_code=422, detail=f"{key} must be >= 0")

    if policy["debt_notice_delay_days"] < policy["payment_due_notice_delay_days"]:
        raise HTTPException(
            status_code=422,
            detail="debt_notice_delay_days must be >= payment_due_notice_delay_days",
        )

    if policy["pretension_delay_days"] < policy["debt_notice_delay_days"]:
        raise HTTPException(
            status_code=422,
            detail="pretension_delay_days must be >= debt_notice_delay_days",
        )

    return policy


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "debtrix",
        "mode": "case-engine",
    }


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/admin/bootstrap-tenants")
def admin_bootstrap_tenants(db: Session = Depends(get_db)):
    result = bootstrap_tenants_for_existing_data(db)
    db.commit()
    return result


# ---------------------------
# CASES
# ---------------------------
@app.post("/cases", response_model=CaseResponse)
def create_case(
    payload: CaseCreate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    created = create_case_write(
        db,
        tenant_id=tenant_id,
        debtor_type=payload.debtor_type,
        debtor_name=payload.debtor_name,
        contract_type=payload.contract_type,
        principal_amount=payload.principal_amount,
        due_date=payload.due_date,
        contract_data=payload.contract_data or {},
    )
    db.commit()
    db.refresh(created)
    return created


@app.get("/cases", response_model=list[CaseResponse])
def list_cases(
    include_archived: bool = Query(default=False),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    query = db.query(Case).order_by(Case.id.desc())
    query = filter_cases_by_tenant(query, tenant_id, include_archived=include_archived)
    return query.all()


@app.get("/cases/{case_id}")
def get_case_detail(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    _ = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    return get_projection_data_or_rebuild(db, case_id)


@app.get("/cases/{case_id}/snapshot", response_model=SnapshotResponse)
def get_case_snapshot(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    case = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    data = get_projection_data_or_rebuild(db, case.id)

    projection = (
        db.query(CaseProjection)
        .filter(CaseProjection.case_id == case.id)
        .first()
    )

    return SnapshotResponse(
        case_id=case.id,
        updated_at=projection.updated_at if projection else None,
        data=data,
    )


@app.get("/cases/{case_id}/dashboard")
def get_case_dashboard(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    _ = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    return build_case_dashboard(db, case_id)


@app.post("/cases/{case_id}/actions/{action_code}")
def apply_action(
    case_id: int,
    action_code: str,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = apply_action_write(
        db,
        case_id=case_id,
        tenant_id=tenant_id,
        action_code=action_code,
    )
    db.commit()
    return result


@app.get("/cases/{case_id}/timeline")
def get_timeline(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    case = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)

    events = (
        db.query(TimelineEvent)
        .filter(TimelineEvent.case_id == case.id)
        .order_by(TimelineEvent.id.desc())
        .all()
    )

    return {
        "case_id": case.id,
        "items": [
            {
                "id": item.id,
                "event_type": item.event_type,
                "title": item.title,
                "details": item.details,
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "dedup_key": getattr(item, "dedup_key", None),
            }
            for item in events
        ],
    }


@app.get("/cases/{case_id}/participants")
def get_case_participants(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    _ = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)

    rows_query = (
        db.query(CaseParticipant)
        .filter(CaseParticipant.case_id == case_id)
        .order_by(CaseParticipant.id.asc())
    )
    rows_query = filter_case_participants_by_tenant(rows_query, tenant_id)
    rows = rows_query.all()

    return {
        "case_id": case_id,
        "participants": [
            {
                "id": row.id,
                "role": row.role,
                "is_primary": row.is_primary,
                "meta": row.meta or {},
                "party": {
                    "id": row.party.id,
                    "name": row.party.name,
                    "debtor_type": row.party.debtor_type,
                    "inn": row.party.inn,
                    "ogrn": row.party.ogrn,
                    "address": row.party.address,
                    "director_name": row.party.director_name,
                }
                if getattr(row, "party", None)
                else None,
            }
            for row in rows
        ],
    }


@app.get("/cases/{case_id}/available-actions")
def available_actions(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    _ = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    return {
        "case_id": case_id,
        "actions": get_available_actions(db, case_id),
    }


@app.get("/cases/{case_id}/available-documents")
def available_documents(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    _ = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    return {
        "case_id": case_id,
        "documents": get_available_documents(db, case_id),
    }


@app.get("/cases/{case_id}/document-readiness")
def document_readiness(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    _ = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    docs = get_available_documents(db, case_id)
    return {
        "case_id": case_id,
        "documents": get_document_readiness(docs),
    }


@app.get("/cases/{case_id}/soft-policy")
def get_case_soft_policy(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    case = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    contract_data = dict(case.contract_data or {})
    soft_policy = dict(contract_data.get("soft_policy") or {})

    return {
        "case_id": case.id,
        "soft_policy": {
            "payment_due_notice_delay_days": int(
                soft_policy.get("payment_due_notice_delay_days", 0)
            ),
            "debt_notice_delay_days": int(
                soft_policy.get("debt_notice_delay_days", 3)
            ),
            "pretension_delay_days": int(
                soft_policy.get("pretension_delay_days", 10)
            ),
        },
    }


@app.patch("/cases/{case_id}/soft-policy")
def update_case_soft_policy(
    case_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    case = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    policy = _normalize_soft_policy_payload(payload)

    contract_data = dict(case.contract_data or {})
    contract_data["soft_policy"] = policy

    case.contract_data = contract_data
    case.updated_at = datetime.utcnow()
    db.add(case)

    sync_and_persist_case(db, case)
    db.commit()
    db.refresh(case)

    return {
        "ok": True,
        "case_id": case.id,
        "soft_policy": policy,
    }


# ---------------------------
# DEBTOR / ORGANIZATION
# ---------------------------
@app.patch("/cases/{case_id}/debtor/identify")
def debtor_identify(
    case_id: int,
    payload: DebtorIdentifyRequest,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    case = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    inn_norm, ogrn_norm = normalize_and_validate_inn_ogrn(payload.inn, payload.ogrn)

    contract_data = dict(case.contract_data or {})
    debtor_block = dict(contract_data.get("debtor") or {})

    if inn_norm:
        debtor_block["inn"] = inn_norm
    if ogrn_norm:
        debtor_block["ogrn"] = ogrn_norm

    contract_data["debtor"] = debtor_block
    case.contract_data = contract_data
    case.updated_at = datetime.utcnow()
    db.add(case)

    sync_and_persist_case(db, case)
    db.commit()
    db.refresh(case)

    return {
        "ok": True,
        "case_id": case.id,
        "debtor": debtor_block,
    }


@app.post("/cases/{case_id}/debtor/refresh", response_model=DebtorProfileResponse)
def debtor_refresh(
    case_id: int,
    payload: DebtorRefreshRequest | None = Body(default=None),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    case = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)

    contract_data = dict(case.contract_data or {})
    debtor_block = dict(contract_data.get("debtor") or {})

    inn_in = payload.inn if payload else None
    ogrn_in = payload.ogrn if payload else None

    inn_norm, ogrn_norm = resolve_inn_ogrn_with_fallback(
        inn_in,
        ogrn_in,
        debtor_block.get("inn"),
        debtor_block.get("ogrn"),
    )

    org = lookup_organization_by_identifiers(inn=inn_norm, ogrn=ogrn_norm)

    debtor_block["inn"] = org.get("inn")
    debtor_block["ogrn"] = org.get("ogrn")
    debtor_block["name"] = org.get("name")
    debtor_block["name_full"] = org.get("name_full")
    debtor_block["name_short"] = org.get("name_short")
    debtor_block["kpp"] = org.get("kpp")
    debtor_block["address"] = org.get("address")
    debtor_block["director_name"] = org.get("director_name")
    debtor_block["status"] = org.get("status")
    debtor_block["registration_date"] = org.get("registration_date")
    debtor_block["okved_main"] = org.get("okved_main")
    debtor_block["source"] = org.get("source")

    contract_data["debtor"] = debtor_block
    case.contract_data = contract_data
    db.add(case)

    profile_query = db.query(DebtorProfile).filter(DebtorProfile.case_id == case.id)
    profile_query = filter_debtor_profiles_by_tenant(profile_query, tenant_id)
    profile = profile_query.first()

    if not profile:
        profile = DebtorProfile(case_id=case.id, tenant_id=tenant_id)
        db.add(profile)

    profile.tenant_id = tenant_id
    profile.inn = org.get("inn")
    profile.ogrn = org.get("ogrn")
    profile.name = org.get("name")
    profile.address = org.get("address")
    profile.director_name = org.get("director_name")
    profile.source = org.get("source") or "fns_mock"
    profile.raw = {
        "name_full": org.get("name_full"),
        "name_short": org.get("name_short"),
        "kpp": org.get("kpp"),
        "status": org.get("status"),
        "registration_date": org.get("registration_date"),
        "okved_main": org.get("okved_main"),
        "provider_payload": org.get("raw") or {},
    }

    sync_and_persist_case(db, case)
    db.commit()
    db.refresh(profile)
    return profile


@app.get("/cases/{case_id}/debtor/profile", response_model=DebtorProfileResponse)
def get_debtor_profile(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    _ = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)

    profile_query = db.query(DebtorProfile).filter(DebtorProfile.case_id == case_id)
    profile_query = filter_debtor_profiles_by_tenant(profile_query, tenant_id)
    profile = profile_query.first()

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Debtor profile not found (call POST /cases/{id}/debtor/refresh)",
        )

    return profile


@app.get("/organizations/lookup")
def organizations_lookup(
    inn: Optional[str] = Query(default=None),
    ogrn: Optional[str] = Query(default=None),
):
    if not inn and not ogrn:
        raise HTTPException(status_code=422, detail="Нужно передать inn или ogrn")

    try:
        return lookup_organization_by_identifiers(inn=inn, ogrn=ogrn)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ---------------------------
# INTEGRATIONS
# ---------------------------
@app.get("/cases/{case_id}/integrations")
def case_integrations_status(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    _ = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    return get_case_integrations_status(db, tenant_id=tenant_id, case_id=case_id)


@app.post("/cases/{case_id}/integrations/fns/sync")
def case_fns_sync(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    case = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    result = run_fns_case_sync(db, case=case, tenant_id=tenant_id)
    sync_and_persist_case(db, case)
    db.commit()
    return result


@app.post("/cases/{case_id}/integrations/fssp/check")
def case_fssp_check(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    case = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    result = run_fssp_case_check(db, case=case, tenant_id=tenant_id)
    db.commit()
    return result


# ---------------------------
# EXTERNAL ACTIONS
# ---------------------------
@app.get("/cases/{case_id}/external-actions")
def case_external_actions(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    _ = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    return list_external_actions(db, tenant_id=tenant_id, case_id=case_id)


@app.post("/cases/{case_id}/external-actions/{action_code}/prepare")
def case_prepare_external_action(
    case_id: int,
    action_code: str,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    _ = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)
    result = prepare_external_action(
        db,
        tenant_id=tenant_id,
        case_id=case_id,
        action_code=action_code,
    )
    db.commit()
    return result


@app.post("/external-actions/{action_id}/esia-session/start")
def external_action_start_esia_session(
    action_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = start_esia_session_for_action(
        db,
        action_id=action_id,
        tenant_id=tenant_id,
    )
    db.commit()
    return result


@app.post("/esia-sessions/{session_id}/authorize")
def esia_session_authorize(
    session_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = authorize_esia_session(
        db,
        session_id=session_id,
        tenant_id=tenant_id,
    )
    db.commit()
    return result


@app.post("/external-actions/{action_id}/dispatch")
def external_action_dispatch(
    action_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = dispatch_external_action(
        db,
        action_id=action_id,
        tenant_id=tenant_id,
    )
    db.commit()
    return result


# ---------------------------
# AUTOMATION ENGINE
# ---------------------------
@app.post("/automation/rules/bootstrap")
def automation_rules_bootstrap(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = upsert_default_automation_rules(db, tenant_id=tenant_id)
    db.commit()
    return result


@app.get("/automation/rules")
def automation_rules_list(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return list_automation_rules(db, tenant_id=tenant_id)


@app.get("/automation/runs")
def automation_runs_list(
    case_id: Optional[int] = Query(default=None),
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    if case_id is not None:
        _ = load_case_for_tenant_or_404(db, case_id, tenant_id, include_archived=True)

    return list_automation_runs(
        db,
        tenant_id=tenant_id,
        case_id=case_id,
        status=status,
    )


@app.get("/automation/runs/{run_id}")
def automation_run_detail(
    run_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return get_automation_run_detail(db, run_id=run_id, tenant_id=tenant_id)


@app.post("/automation/runs")
def automation_run_start(
    payload: AutomationRunStartRequest,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = start_automation_run_for_cases(
        db,
        rule_id=payload.rule_id,
        case_ids=payload.case_ids,
        tenant_id=tenant_id,
        requested_by=payload.requested_by,
    )
    db.commit()
    return result


@app.post("/automation/runs/{run_id}/execute")
def automation_run_execute(
    run_id: int,
    payload: AutomationRunExecuteRequest = Body(default=AutomationRunExecuteRequest()),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = execute_automation_run(
        db,
        run_id=run_id,
        tenant_id=tenant_id,
        force=payload.force,
    )
    db.commit()
    return result


@app.get("/automation/waiting-bucket")
def automation_waiting_bucket(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return get_waiting_bucket(db, tenant_id=tenant_id)


# ---------------------------
# BATCH EXECUTION
# ---------------------------
@app.get("/batch-jobs")
def batch_jobs_list_endpoint(
    status: Optional[str] = Query(default=None),
    job_type: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return list_batch_jobs(
        db,
        tenant_id=tenant_id,
        status=status,
        job_type=job_type,
    )


@app.post("/batch-jobs")
def batch_job_create(
    payload: BatchJobCreate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = create_batch_job(
        db,
        tenant_id=tenant_id,
        payload=payload.model_dump(),
    )
    db.commit()
    return result


@app.get("/batch-jobs/{batch_job_id}")
def batch_job_detail_endpoint(
    batch_job_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    job = get_batch_job_or_404(
        db,
        batch_job_id=batch_job_id,
        tenant_id=tenant_id,
    )
    return {
        "job": {
            "id": job.id,
            "tenant_id": job.tenant_id,
            "job_type": job.job_type,
            "title": job.title,
            "description": job.description,
            "status": job.status,
            "rule_id": job.rule_id,
            "selection_snapshot": job.selection_snapshot or {},
            "execution_params": job.execution_params or {},
            "summary": job.summary or {},
            "result": job.result or {},
            "error_message": job.error_message,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "finished_at": job.finished_at.isoformat() if job.finished_at else None,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "updated_at": job.updated_at.isoformat() if job.updated_at else None,
        }
    }


@app.get("/batch-jobs/{batch_job_id}/items")
def batch_job_items(
    batch_job_id: int,
    status: Optional[str] = Query(default=None),
    bucket_code: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return list_batch_job_items(
        db,
        batch_job_id=batch_job_id,
        tenant_id=tenant_id,
        status=status,
        bucket_code=bucket_code,
    )


@app.post("/batch-jobs/{batch_job_id}/execute")
def batch_job_execute_endpoint(
    batch_job_id: int,
    payload: BatchJobExecuteRequest = Body(default=BatchJobExecuteRequest()),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = execute_batch_job(
        db,
        batch_job_id=batch_job_id,
        tenant_id=tenant_id,
        force=payload.force,
    )
    db.commit()
    return result


@app.post("/batch-jobs/{batch_job_id}/rebuild-summary")
def batch_job_rebuild_summary(
    batch_job_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = rebuild_batch_job_summary(
        db,
        batch_job_id=batch_job_id,
        tenant_id=tenant_id,
    )
    db.commit()
    return result


@app.post("/batch-scaffold/jobs")
def batch_job_start_scaffold(
    payload: BatchJobStartRequest,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = start_batch_job(
        db,
        rule_id=payload.rule_id,
        case_ids=payload.case_ids,
        tenant_id=tenant_id,
        requested_by=payload.requested_by,
        title=payload.title,
    )
    db.commit()
    return result


@app.get("/batch-scaffold/jobs")
def batch_jobs_list_scaffold(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return list_batch_jobs_scaffold(db, tenant_id=tenant_id)


@app.get("/batch-scaffold/jobs/{batch_job_id}")
def batch_job_detail_scaffold(
    batch_job_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return get_batch_job_detail(
        db,
        batch_job_id=batch_job_id,
        tenant_id=tenant_id,
    )


@app.get("/portfolio/waiting-items")
def portfolio_waiting_items(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return get_portfolio_waiting_bucket(db, tenant_id=tenant_id)


# ---------------------------
# PORTFOLIO REGISTRY / VIEWS
# ---------------------------
@app.post("/portfolio/query")
def portfolio_query_endpoint(
    payload: PortfolioQueryRequest,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return query_portfolio(
        db,
        tenant_id=tenant_id,
        filters=payload.filters.model_dump(),
        limit=payload.limit,
        offset=payload.offset,
        order_by=payload.order_by,
    )


@app.post("/portfolio/summary")
def portfolio_summary_endpoint(
    payload: PortfolioQueryRequest,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return portfolio_summary(
        db,
        tenant_id=tenant_id,
        filters=payload.filters.model_dump(),
        order_by=payload.order_by,
    )


@app.post("/portfolio/buckets")
def portfolio_buckets_endpoint(
    payload: PortfolioQueryRequest,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return portfolio_buckets(
        db,
        tenant_id=tenant_id,
        filters=payload.filters.model_dump(),
        order_by=payload.order_by,
    )


@app.get("/portfolio/views")
def portfolio_views_list(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return list_portfolio_views(db, tenant_id=tenant_id)


@app.post("/portfolio/views")
def portfolio_view_create_endpoint(
    payload: PortfolioViewCreate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = create_portfolio_view(
        db,
        tenant_id=tenant_id,
        payload=payload.model_dump(),
    )
    db.commit()
    return result


@app.get("/portfolio/views/{view_id}")
def portfolio_view_detail(
    view_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    item = get_portfolio_view_or_404(db, view_id=view_id, tenant_id=tenant_id)
    return {
        "view": {
            "id": item.id,
            "tenant_id": item.tenant_id,
            "name": item.name,
            "description": item.description,
            "is_default": item.is_default,
            "is_shared": item.is_shared,
            "filters": item.filters or {},
            "sorting": item.sorting or {},
            "columns": item.columns or {},
            "meta": item.meta or {},
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        }
    }


@app.patch("/portfolio/views/{view_id}")
def portfolio_view_update_endpoint(
    view_id: int,
    payload: PortfolioViewUpdate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = update_portfolio_view(
        db,
        view_id=view_id,
        tenant_id=tenant_id,
        payload=payload.model_dump(exclude_unset=True),
    )
    db.commit()
    return result


@app.delete("/portfolio/views/{view_id}")
def portfolio_view_delete_endpoint(
    view_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = delete_portfolio_view(
        db,
        view_id=view_id,
        tenant_id=tenant_id,
    )
    db.commit()
    return result


@app.post("/portfolio/views/{view_id}/batch-jobs")
def portfolio_view_create_batch_job(
    view_id: int,
    payload: PortfolioBatchFromViewCreate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = create_batch_job_from_portfolio_view(
        db,
        tenant_id=tenant_id,
        view_id=view_id,
        payload=payload.model_dump(),
    )
    db.commit()
    return result


@app.get("/portfolio/routing", response_model=PortfolioRoutingResponse)
def portfolio_routing(
    include_archived: bool = Query(default=False),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    query = db.query(Case).order_by(Case.id.desc())
    query = filter_cases_by_tenant(
        query,
        tenant_id,
        include_archived=include_archived,
    )
    cases = query.all()

    return build_portfolio_routing(
        db,
        tenant_id=tenant_id,
        cases=cases,
    )


@app.get("/portfolio/waiting-buckets", response_model=WaitingBucketsResponse)
def portfolio_waiting_buckets(
    status: str | None = Query(default="waiting"),
    bucket_code: str | None = Query(default=None),
    step_code: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return list_waiting_buckets(
        db,
        tenant_id=tenant_id,
        status=status,
        bucket_code=bucket_code,
        step_code=step_code,
        limit=limit,
    )


# ---------------------------
# PLAYBOOKS
# ---------------------------
@app.get("/meta/playbooks/defaults")
def get_default_playbooks():
    return {"items": list_default_playbooks()}


@app.get("/cases/{case_id}/playbook", response_model=PlaybookResponse)
def case_playbook(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    case = load_case_for_tenant_or_404(
        db,
        case_id,
        tenant_id,
        include_archived=True,
    )
    return evaluate_case_playbook(db, case)


@app.post("/admin/bootstrap-playbooks")
def admin_bootstrap_playbooks(db: Session = Depends(get_db)):
    created_playbooks = 0
    created_steps = 0

    for playbook_data in list_default_playbooks():
        existing = (
            db.query(PlaybookDefinition)
            .filter(PlaybookDefinition.code == playbook_data["code"])
            .first()
        )
        if existing:
            continue

        playbook = PlaybookDefinition(
            code=playbook_data["code"],
            title=playbook_data["title"],
            contract_type=playbook_data.get("contract_type"),
            debtor_type=playbook_data.get("debtor_type"),
            is_active=True,
            version=1,
            description=playbook_data.get("description"),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(playbook)
        db.flush()

        created_playbooks += 1

        for step_data in playbook_data.get("steps", []):
            step = PlaybookStep(
                playbook_id=playbook.id,
                step_code=step_data["step_code"],
                title=step_data["title"],
                sequence_no=step_data["sequence_no"],
                step_type=step_data.get("step_type", "action"),
                action_code=step_data.get("action_code"),
                document_code=step_data.get("document_code"),
                is_manual=bool(step_data.get("is_manual", True)),
                is_blocking=bool(step_data.get("is_blocking", True)),
                eligibility_expr=step_data.get("eligibility_expr"),
                waiting_rule_code=step_data.get("waiting_rule_code"),
                description=step_data.get("description"),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(step)
            created_steps += 1

    db.commit()

    return {
        "ok": True,
        "created_playbooks": created_playbooks,
        "created_steps": created_steps,
    }


# ---------------------------
# DOCUMENT ENGINE
# ---------------------------
@app.post("/document-templates")
def create_document_template_endpoint(
    payload: DocumentTemplateCreate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = create_document_template(
        db,
        tenant_id=tenant_id,
        payload=payload.model_dump(),
    )
    db.commit()
    return result


@app.get("/document-templates")
def list_document_templates_endpoint(
    contract_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return list_document_templates(
        db,
        tenant_id=tenant_id,
        contract_type=contract_type,
    )


@app.post("/cases/{case_id}/generated-documents")
def generate_document_for_case_endpoint(
    case_id: int,
    payload: DocumentGenerateRequest,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    result = generate_document_for_case(
        db,
        tenant_id=tenant_id,
        case_id=case_id,
        payload=payload.model_dump(),
    )
    db.commit()
    return result


@app.get("/cases/{case_id}/generated-documents")
def list_generated_documents_endpoint(
    case_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    return list_generated_documents(
        db,
        tenant_id=tenant_id,
        case_id=case_id,
    )


# ---------------------------
# META
# ---------------------------
@app.get("/meta/contract-types")
def contract_types():
    return [
        {"code": "supply", "title": "Поставка"},
        {"code": "rent", "title": "Аренда"},
        {"code": "services", "title": "Услуги"},
        {"code": "loan", "title": "Заем"},
        {"code": "utility", "title": "ЖКХ"},
    ]


@app.get("/meta/debtor-types")
def debtor_types():
    return [
        {"code": "company", "title": "Юрлицо"},
        {"code": "individual", "title": "Физлицо"},
        {"code": "entrepreneur", "title": "ИП"},
    ]