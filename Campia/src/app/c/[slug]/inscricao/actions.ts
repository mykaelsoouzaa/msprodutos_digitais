'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { paymentProvider } from '@/lib/env';
import { normalizePhone, onlyDigits, parsePlayers, shortName, validCpfCnpj } from '@/lib/format';
import { createPixCharge } from '@/lib/payments';
import { createAdminClient } from '@/lib/supabase/admin';

const RESERVE_MINUTES = 30;

const Signup = z.object({
  slug: z.string().min(3).max(80),
  name: z.string().trim().min(2, 'Nome do time muito curto').max(40),
  short: z.string().trim().max(3).default(''),
  captain: z.string().trim().min(2, 'Informe o nome do capitão').max(60),
  phone: z.string().transform(s => normalizePhone(s)).refine(Boolean, 'WhatsApp com DDD inválido'),
  email: z.string().trim().toLowerCase().email('E-mail do capitão inválido').max(120),
  cpf: z.string().default(''),
  players: z.string().max(4000).default(''),
  consent: z.literal('on', { errorMap: () => ({ message: 'É preciso aceitar os termos de exibição' }) }),
});

/**
 * Inscrição pública: reserva uma vaga, grava atletas e cria a cobrança PIX.
 * Roda com a service role porque o visitante não está logado; todas as entradas são validadas aqui.
 */
export async function registerTeam(formData: FormData) {
  const slug = String(formData.get('slug') || '');
  const back = `/c/${slug}/inscricao`;
  const fail = (msg: string): never => redirect(`${back}?erro=${encodeURIComponent(msg)}`);

  const parsed = Signup.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0].message);
  const f = parsed.data!;
  const players = parsePlayers(f.players);
  if (players.length < 1) fail('Cadastre pelo menos 1 atleta (um por linha)');
  const needsCpf = paymentProvider() === 'asaas';
  if (needsCpf && !validCpfCnpj(f.cpf)) fail('CPF ou CNPJ inválido (exigido para gerar o PIX)');

  const db = createAdminClient();
  const { data: champ } = await db.from('championships').select('id, name, fee_cents').eq('slug', f.slug).maybeSingle();
  if (!champ) fail('Campeonato não encontrado');

  const { data: hasResults } = await db.from('games').select('id').eq('championship_id', champ!.id).not('home_score', 'is', null).limit(1);
  if (hasResults?.length) fail('As inscrições estão encerradas: o campeonato já começou');

  const { data: teamId, error: reserveError } = await db.rpc('reserve_slot', {
    p_championship: champ!.id, p_name: f.name, p_short: shortName(f.name, f.short), p_captain: f.captain,
    p_phone: f.phone!, p_minutes: RESERVE_MINUTES,
  });
  if (reserveError) fail('Não foi possível reservar a vaga. Tente de novo.');
  if (!teamId) fail('As vagas esgotaram');

  await db.from('team_contacts').update({ captain_email: f.email }).eq('team_id', teamId);
  await db.from('players').insert(players.map(p => ({ championship_id: champ!.id, team_id: teamId, name: p.name, number: p.number })));

  // Inscrição grátis: confirma direto.
  if (champ!.fee_cents === 0) {
    await db.from('teams').update({ status: 'inscrita', paid: true, reserved_until: null }).eq('id', teamId);
    redirect(`/c/${f.slug}?ok=${encodeURIComponent(`${f.name} está inscrito!`)}`);
  }

  const { data: payment, error: payError } = await db.from('payments').insert({
    championship_id: champ!.id, team_id: teamId, amount_cents: champ!.fee_cents, provider: paymentProvider(),
  }).select('id').single();
  if (payError || !payment) fail('Não foi possível criar a cobrança');

  try {
    const charge = await createPixCharge({
      paymentId: payment!.id, amountCents: champ!.fee_cents, description: `Inscrição ${f.name} · ${champ!.name}`,
      payerName: f.captain, payerPhone: f.phone!, payerCpfCnpj: needsCpf ? onlyDigits(f.cpf) : undefined,
    });
    await db.from('payments').update({
      provider_id: charge.providerId, pix_payload: charge.payload, pix_image: charge.imageBase64,
      expires_at: new Date(Date.now() + RESERVE_MINUTES * 60_000).toISOString(),
    }).eq('id', payment!.id);
  } catch (e) {
    await db.from('payments').update({ status: 'cancelado' }).eq('id', payment!.id);
    await db.from('teams').update({ reserved_until: new Date(0).toISOString() }).eq('id', teamId); // libera a vaga
    fail(e instanceof Error ? `PIX: ${e.message}` : 'Falha ao gerar o PIX');
  }

  redirect(`/pagamento/${payment!.id}`);
}
