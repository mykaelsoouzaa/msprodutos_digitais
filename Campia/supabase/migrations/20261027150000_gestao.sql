-- Gestão: repasse manual feito, devolução de PIX e lembrete de pagamento pendente.

-- Quando a Campia transferiu manualmente o valor ao organizador (repasse manual).
alter table public.payments add column if not exists manual_payout_done_at timestamptz;
-- Quando o capitão recebeu o e-mail lembrando do PIX pendente (envia uma vez só).
alter table public.payments add column if not exists reminder_sent_at timestamptz;
-- Devolução (estorno) do PIX.
alter table public.payments add column if not exists refunded_at timestamptz;

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pendente', 'pago', 'pago_tarde', 'expirado', 'cancelado', 'estornado'));
