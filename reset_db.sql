DROP TABLE IF EXISTS cases CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS debtor_type_enum CASCADE;
DROP TYPE IF EXISTS contract_type_enum CASCADE;
DROP TYPE IF EXISTS case_status_enum CASCADE;

CREATE TYPE debtor_type_enum AS ENUM ('individual', 'company');

CREATE TYPE contract_type_enum AS ENUM (
    'supply',
    'lease',
    'services',
    'work',
    'loan',
    'utilities',
    'other'
);

CREATE TYPE case_status_enum AS ENUM (
    'draft',
    'overdue',
    'pretrial',
    'court',
    'enforcement',
    'closed'
);