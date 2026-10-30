-- Log of every "Send to Telegram" attempt (successful and failed).
-- Run once in the Supabase SQL editor. Rows are written only by the
-- send-telegram edge function (service role), so there is no insert policy.

create table if not exists public.telegram_sends (
  id uuid primary key default gen_random_uuid(),
  solicitation_id uuid references public.solicitations(id) on delete set null,
  sent_by uuid references auth.users(id) on delete set null,
  sent_by_email text,
  chat_id text not null,
  status text not null check (status in ('success', 'failed')),
  error text,
  message_id bigint,
  -- Snapshot of the solicitation at send time, so the log still reads
  -- correctly after the solicitation is edited or deleted.
  control_number text,
  organization_name text,
  event text,
  event_date text,
  sent_at timestamptz not null default now()
);

create index if not exists telegram_sends_sent_at_idx
  on public.telegram_sends (sent_at desc);
create index if not exists telegram_sends_solicitation_idx
  on public.telegram_sends (solicitation_id, sent_at desc);

alter table public.telegram_sends enable row level security;

drop policy if exists "Authenticated users can read telegram sends" on public.telegram_sends;
create policy "Authenticated users can read telegram sends"
  on public.telegram_sends for select
  to authenticated
  using (true);
