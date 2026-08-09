-- Fix check constraints on public.subscriptions table:
-- Allow tier in ('lite', 'pro', 'basic')
-- Allow status in ('pending', 'active', 'expired', 'rejected', 'canceled', 'cancelled')

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions drop constraint if exists subscriptions_tier_check;

alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('pending', 'active', 'expired', 'rejected', 'canceled', 'cancelled'));

alter table public.subscriptions add constraint subscriptions_tier_check
  check (tier in ('lite', 'pro', 'basic'));
