-- =============================================================================
-- Migrasi: tambah kolom priority untuk multi-provider failover chain
-- -----------------------------------------------------------------------------
-- Sebelumnya edge function cuma support 1 active + 1 fallback (2 provider).
-- Kolom `priority` memungkinkan chain berurutan (3 main + fallback dst).
-- Edge function: kalau ada provider dgn priority NOT NULL, pakai chain urut
-- priority ASC. Kalau tidak ada (legacy), tetap pakai is_active + is_fallback.
-- Non-breaking: kolom nullable, tidak mengubah index unik yang ada.
-- =============================================================================

alter table public.ai_providers
  add column if not exists priority integer;

comment on column public.ai_providers.priority is
  'Urutan failover chain (1=dicoba pertama). NULL = pakai logic is_active/is_fallback lama.';

-- Index untuk ordering chain (partial: hanya baris yang ikut chain).
create index if not exists ai_providers_priority_idx
  on public.ai_providers (priority) where priority is not null;
