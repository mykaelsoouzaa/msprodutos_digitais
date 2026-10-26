-- Área do capitão: o e-mail informado na inscrição liga o time à conta de quem entra com esse e-mail.
alter table public.team_contacts
  add column captain_email text not null default '' check (char_length(captain_email) <= 120 and captain_email = lower(captain_email));
create index team_contacts_email_idx on public.team_contacts (captain_email) where captain_email <> '';
