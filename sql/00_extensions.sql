-- 00_extensions.sql
-- Extensões necessárias para o CRM
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Necessário para o constraint EXCLUDE da agenda evitar conflitos temporais
CREATE EXTENSION IF NOT EXISTS "btree_gist";
