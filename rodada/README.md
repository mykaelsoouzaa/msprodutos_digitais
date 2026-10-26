# Rodada · MVP

Plataforma para organizar campeonatos amadores: tabela automática, inscrição pelo link com PIX, resultados pelo celular, página pública e artes para o WhatsApp.

Stack: **Next.js 15 (App Router)** + **Supabase** (Postgres, login por e-mail, Row Level Security) + **Asaas** para o PIX.

## O que esta versão faz

| Área | Funções |
| --- | --- |
| Organizador | Login por link no e-mail · criar campeonato (14 esportes, pontos corridos, grupos + mata-mata ou mata-mata) · tabela e agenda automáticas · lançar placar, pênaltis e gols por atleta · mudar data, horário e campo · confirmar pagamento recebido por fora · visibilidade (público ou só com link) · excluir |
| Inscrição | Link público · reserva a vaga por 30 min sem duas inscrições na mesma vaga · cobrança PIX (Asaas ou simulada) · confirmação automática pelo webhook |
| Público | Página do campeonato com próximos jogos, todos os jogos, classificação, chaveamento e artilharia · arte 1080×1920 da rodada em `/c/<slug>/arte?rodada=Rodada%201` |
| App (PWA) | Instalável na tela inicial (Android e iPhone) · abre em tela cheia · páginas já vistas funcionam sem internet · lembretes por notificação 1 dia e 1 hora antes de cada jogo, do campeonato inteiro ou só de um time |

Ficaram de fora desta versão (estão no protótipo): súmula ao vivo, cartões e suspensões, vídeos, mural, palpites, área do atleta, agenda de quadras, equipe com permissões, planos pagos.

## Estrutura

```
src/lib/domain/      regras do campeonato (sem dependências) + testes
src/lib/data.ts      leitura/gravação no Supabase
src/lib/payments/    PIX: simulado e Asaas
src/app/painel/      painel do organizador (protegido pelo middleware)
src/app/c/[slug]/    página pública, inscrição e arte
src/app/pagamento/   tela do PIX (atualiza sozinha)
src/app/api/webhooks/asaas/  confirmação de pagamento
src/app/api/cron/lembretes/  envio dos lembretes de jogo
src/app/manifest.ts  manifest do app · public/sw.js service worker · public/icons/
supabase/migrations/ esquema do banco com RLS
supabase/tests/      testes de permissão do banco
```

## Rodar localmente

1. **Supabase:** crie um projeto em [supabase.com](https://supabase.com) (o plano grátis serve).
   - Em *SQL Editor*, rode o arquivo `supabase/migrations/20261026000000_init.sql` (ou `supabase db push` com a CLI).
   - Em *Authentication › URL Configuration*: *Site URL* = `http://localhost:3000` e adicione `http://localhost:3000/auth/callback` em *Redirect URLs*.
2. **Variáveis:** copie `.env.example` para `.env.local` e preencha com os dados de *Project Settings › API*. Deixe `PAYMENT_PROVIDER=mock` no começo.
3. **Instalar e rodar:**
   ```bash
   npm install
   npm run dev
   ```
4. Abra `http://localhost:3000`, entre pelo e-mail, crie um campeonato e teste a inscrição pelo link. No modo simulado, a tela do PIX tem o botão "Simular pagamento recebido".

## Testes

```bash
npm test          # regras do campeonato, lembretes e formatação (23 testes)
npm run typecheck # tipagem
npm run test:db   # migração + permissões num Postgres local descartável (precisa do PostgreSQL instalado)
```

O GitHub Actions (`.github/workflows/ci.yml`) roda testes, tipagem, build e os testes do banco a cada push.

## App instalável e lembretes (PWA)

O Rodada é um PWA: quem abre o site no celular vê o convite "Instale o Rodada". No Android, o Chrome instala com um toque; no iPhone, a pessoa usa Compartilhar › "Adicionar à Tela de Início".

Para ligar as notificações de lembrete:

1. Gere as chaves: `npm run vapid`. Coloque a pública em `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, a privada em `VAPID_PRIVATE_KEY` e um e-mail de contato em `VAPID_SUBJECT` (`mailto:...`).
2. Rode a migração `supabase/migrations/20261026120000_push.sql`.
3. Defina um `CRON_SECRET` (texto longo e aleatório).
4. Agende a chamada de `/api/cron/lembretes` a cada 10 minutos. O plano grátis da Vercel só permite cron uma vez por dia, então use o agendador do Supabase (*Integrations › Cron*, com as extensões `pg_cron` e `pg_net`):
   ```sql
   select cron.schedule('rodada-lembretes', '*/10 * * * *', $$
     select net.http_get(
       url := 'https://SEU-DOMINIO/api/cron/lembretes',
       headers := jsonb_build_object('Authorization', 'Bearer SEU_CRON_SECRET')
     );
   $$);
   ```

No iPhone, as notificações exigem iOS 16.4 ou mais novo e o app instalado na tela inicial; o pedido de permissão só aparece depois de um toque no botão "Ativar". O horário dos jogos é tratado como horário de Brasília (UTC−3).

## PIX de verdade (Asaas)

1. Crie uma conta no [sandbox da Asaas](https://sandbox.asaas.com) e gere a chave da API.
2. No `.env.local`: `PAYMENT_PROVIDER=asaas`, `ASAAS_API_KEY=...`, `ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3`.
3. Crie o webhook no painel da Asaas apontando para `https://SEU-DOMINIO/api/webhooks/asaas`, com os eventos `PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED` e um token de autenticação (32 a 255 caracteres). Coloque o mesmo token em `ASAAS_WEBHOOK_TOKEN`.
4. Com a Asaas ativa, a inscrição pede o CPF ou CNPJ do responsável (a Asaas exige para criar a cobrança).
5. Para produção, troque para `https://api.asaas.com/v3` e a chave de produção.

Referências: [cobranças via PIX](https://docs.asaas.com/docs/cobrancas-via-pix), [autenticação](https://docs.asaas.com/docs/autentica%C3%A7%C3%A3o-1), [webhooks](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook).

## Publicar

Na [Vercel](https://vercel.com): importe o repositório, cadastre as mesmas variáveis de ambiente (com `NEXT_PUBLIC_SITE_URL` = seu domínio) e atualize a *Site URL* e as *Redirect URLs* no Supabase para o domínio novo.

## Pontos de atenção antes de cobrar de verdade

- **Para onde vai o dinheiro:** nesta versão, todas as inscrições caem na conta Asaas da plataforma e o repasse ao organizador é manual. Para repassar automaticamente, use subcontas e split da Asaas. Receber em nome de terceiros tem implicações fiscais e contratuais: valide com um contador antes de lançar.
- **PIX que cai depois da reserva vencer:** fica com status `pago_tarde` e não toma a vaga de outro time. Hoje isso aparece só no banco (tabela `payments`): devolva ou encaixe o time manualmente.
- **Campeonatos "só com o link":** não aparecem em buscas, mas os dados podem ser lidos pela API pública do Supabase por quem souber consultar. Não coloque informação sensível neles.
- **Anti-abuso:** a inscrição pública não tem limite de tentativas. Antes de divulgar em larga escala, adicione um captcha (ex.: Cloudflare Turnstile) e limite por IP.
