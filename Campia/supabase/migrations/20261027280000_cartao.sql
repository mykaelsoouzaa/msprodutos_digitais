-- Inscrição no cartão de crédito (pela página de pagamento do Asaas), com parcelamento opcional.
-- 0 = não aceita cartão; 1 = só à vista; N = até N parcelas.
alter table public.championships add column if not exists card_installments integer not null default 0 check (card_installments between 0 and 12);
alter table public.payments add column if not exists method text not null default 'pix' check (method in ('pix', 'cartao'));
alter table public.payments add column if not exists invoice_url text;
alter table public.payments add column if not exists installments integer check (installments between 1 and 12);
-- Parcelado no Asaas vira um "parcelamento": a devolução é feita nele, não só na 1ª parcela.
alter table public.payments add column if not exists provider_installment_id text;
