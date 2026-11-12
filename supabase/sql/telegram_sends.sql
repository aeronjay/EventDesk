-- Log of every "Send to Telegram" attempt (successful and failed).
-- Run in the Supabase SQL editor (safe to re-run). Rows are written only by the
-- send-telegram and delete-telegram edge functions (service role), so there
-- are no insert/update policies.

create table if not exists public.telegram_sends (
  id uuid primary key default gen_random_uuid(),
  solicitation_id uuid references public.solicitations(id) on delete set null,
  sent_by uuid references auth.users(id) on delete set null,
  sent_by_email text,
  chat_id text not null,
  status text not null check (status in ('success', 'failed')),
  error text,
  message_id bigint,
  -- Every Telegram message the send created (photos + text), used to delete it
  message_ids bigint[],
  -- Snapshot of the solicitation at send time, so the log still reads
  -- correctly after the solicitation is edited or deleted.
  control_number text,
  organization_name text,
  event text,
  event_date text,
  sent_at timestamptz not null default now(),
  -- Set by the delete-telegram edge function when the messages are removed
  -- from the chat. A deleted send no longer counts as "sent".
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_by_email text
);

-- For databases created before these columns existed
alter table public.telegram_sends add column if not exists message_ids bigint[];
alter table public.telegram_sends add column if not exists deleted_at timestamptz;
alter table public.telegram_sends add column if not exists deleted_by uuid references auth.users(id) on delete set null;
alter table public.telegram_sends add column if not exists deleted_by_email text;

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
