-- WhatsApp oficial: registro do que já foi enviado (para nunca mandar a mesma mensagem duas vezes).
create table if not exists public.whatsapp_sent (
  key         text primary key check (char_length(key) <= 120),
  created_at  timestamptz not null default now()
);
alter table public.whatsapp_sent enable row level security;
