# Debtrix

Debtrix — LegalTech SaaS / process engine для взыскания задолженности.

## Архитектурная модель

Debtrix строится не как CRM, а как:

- Case Engine
- Playbook Engine
- Snapshot + Event Log
- Integrations Layer
- Provider Adapters
- External Action Gateway
- Portfolio / Batch Execution foundation
- Waiting Buckets / eligible_at model
- Batch-ready architecture for large debt portfolios

## Что уже собрано в кодовой базе

- дела и карточка дела
- snapshot / projection
- timeline / event log
- debtor profile / organization lookup
- integrations scaffold:
  - ФНС
  - ФССП
- external actions flow:
  - prepare
  - ESIA session start
  - ESIA authorize
  - dispatch
- portfolio views
- automation rules / runs scaffold
- batch jobs scaffold
- playbook scaffold
- document engine scaffold
- frontend workbench

## Важно перед запуском

Сейчас проект нужно держать в **одной согласованной линии миграций и импортов**.

Если в проекте остались дублирующие alembic migrations или склеенные файлы схем, backend может не подняться даже до первого запроса.

Перед первым запуском проверь:

- `backend/app/models/__init__.py` импортирует только реально существующие model-файлы
- `backend/app/schemas/automation.py` не содержит второго `from __future__ import annotations`
- `backend/app/schemas/portfolio.py` не содержит второго `from __future__ import annotations`
- в `backend/alembic/versions` нет параллельных и дублирующих migration-цепочек

## Установка backend

Создай и активируй venv:

```bash
python3 -m venv .venv
source .venv/bin/activate