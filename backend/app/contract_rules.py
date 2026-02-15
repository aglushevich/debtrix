from backend.app.enums import ContractType

# Какие дополнительные поля понадобятся для разных contract_type
CONTRACT_REQUIRED_FIELDS = {
    ContractType.supply: ["invoice_number", "invoice_date"],
    ContractType.lease: ["object_address", "period_start", "period_end"],
    ContractType.services: ["act_number", "act_date"],
    ContractType.loan: ["loan_agreement_number", "loan_agreement_date", "is_319_applicable"],
    ContractType.utilities: ["period_month", "personal_account"],
}