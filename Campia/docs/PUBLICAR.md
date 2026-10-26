# Publicar o campia.app.br com o PIX funcionando

Passo a passo para colocar a Campia no ar, na ordem. Cada etapa diz onde clicar e o que copiar para as variáveis de ambiente. Tempo estimado: 2 a 3 horas, sem contar a aprovação da conta Asaas.

## 0. Antes de começar

- [ ] **Pagar o domínio** campia.app.br no Registro.br. O status "Registro pendente" significa que o pagamento ainda não foi compensado.
- [ ] Ter acesso a: GitHub (o código já está em `msprodutos_digitais/Campia`), um e-mail para as contas e, de preferência, o **CNPJ da MS Suporte TI** para a Asaas.

## 1. Banco de dados e login (Supabase)

1. Em [supabase.com](https://supabase.com), crie o projeto **campia** na região **South America (São Paulo)**. Guarde a senha do banco.
2. Em *SQL Editor*, rode **nesta ordem**:
   1. `supabase/migrations/20261026000000_init.sql`
   2. `supabase/migrations/20261026120000_push.sql`
   3. `supabase/migrations/20261026180000_local.sql`
   4. `supabase/migrations/20261027090000_explorar.sql`
   5. `supabase/migrations/20261027100000_arenas.sql` (cria também a pasta pública `arenas` para os logos)
   6. `supabase/migrations/20261027110000_capitao.sql`
   7. `supabase/migrations/20261027120000_ajudantes.sql`
   8. `supabase/migrations/20261027130000_wo_cartoes.sql`
   9. `supabase/migrations/20261027140000_repasse.sql`

   Já rodou alguns antes? Rode só os que faltam, na ordem. Cada arquivo roda uma vez só.
3. Em *Authentication › URL Configuration*:
   - **Site URL:** `https://campia.app.br`
   - **Redirect URLs:** `https://campia.app.br/auth/callback` e `http://localhost:3000/auth/callback`
4. Em *Authentication › Emails*, traduza o modelo "Magic Link" (ex.: "Seu link para entrar na Campia").
5. Antes de divulgar, configure um **SMTP próprio** em *Authentication › SMTP Settings* (ex.: Resend ou Brevo, com envio por `contato@campia.app.br`). O e-mail padrão do Supabase serve para testes, mas tem limite baixo de envios por hora.
6. Em *Project Settings › API*, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (secreta: nunca coloque no navegador nem no GitHub)

> No plano grátis, projetos sem uso por um tempo são pausados. Confira os limites atuais na página de preços do Supabase antes de lançar; com clientes pagando, o plano Pro evita a pausa.

## 2. Gerar as chaves da Campia

No terminal, dentro da pasta `Campia`:

```bash
npm install
npm run vapid              # gera NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY
openssl rand -hex 32       # use como CRON_SECRET
openssl rand -hex 32       # use como ASAAS_WEBHOOK_TOKEN
```

## 3. Hospedagem (Vercel)

1. Em [vercel.com](https://vercel.com), *Add New › Project* e importe `mykaelsoouzaa/msprodutos_digitais`.
2. Em **Root Directory**, escolha `Campia`. O framework (Next.js) é detectado sozinho.
3. Em *Environment Variables*, cadastre:

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | do passo 1.6 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | do passo 1.6 |
| `SUPABASE_SERVICE_ROLE_KEY` | do passo 1.6 |
| `NEXT_PUBLIC_SITE_URL` | `https://campia.app.br` |
| `PAYMENT_PROVIDER` | `mock` por enquanto (vira `asaas` no passo 5) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | do passo 2 |
| `VAPID_PRIVATE_KEY` | do passo 2 |
| `VAPID_SUBJECT` | `mailto:contato@campia.app.br` |
| `CRON_SECRET` | do passo 2 |
| `CAMPIA_TAXA_PERCENT` | % de cada inscrição que fica com a Campia no repasse automático (ex.: `10`) |

4. Clique em **Deploy**. O site sobe num endereço `*.vercel.app` para você testar.

> **Plano da Vercel:** o plano grátis (Hobby) é só para uso pessoal e não comercial ([termos](https://vercel.com/docs/plans/hobby)). Para testar, ele serve. Quando começar a cobrar das arenas, mude para o **Pro** (US$ 20 por mês por usuário).

## 4. Domínio campia.app.br (Registro.br → Vercel)

1. Na Vercel, abra o projeto, vá em *Settings › Domains* e adicione `campia.app.br` e `www.campia.app.br`. Configure o `www` para redirecionar ao domínio principal.
2. A Vercel mostra os registros DNS que precisa. Normalmente são:
   - `campia.app.br` → registro **A** apontando para `76.76.21.21`
   - `www` → registro **CNAME** com o valor que a Vercel indicar para o seu projeto

   **Use exatamente os valores que aparecem na tela da Vercel** ([documentação](https://vercel.com/docs/domains/set-up-custom-domain)).
3. No [Registro.br](https://registro.br), entre em *Meus domínios › campia.app.br › DNS*, ative o **modo avançado** (editar zona) e crie os registros acima.
4. Espere a Vercel marcar o domínio como válido (de minutos a algumas horas). O certificado HTTPS é emitido sozinho.

## 5. PIX de verdade (Asaas)

**Primeiro no sandbox (teste, sem dinheiro de verdade):**

1. Crie uma conta em [sandbox.asaas.com](https://sandbox.asaas.com) e gere a chave em *Integrações › API*.
2. Na Vercel, mude as variáveis e faça um novo deploy:
   - `PAYMENT_PROVIDER` = `asaas`
   - `ASAAS_API_KEY` = a chave do sandbox
   - `ASAAS_BASE_URL` = `https://api-sandbox.asaas.com/v3`
   - `ASAAS_WEBHOOK_TOKEN` = do passo 2
3. Na Asaas, vá em *Integrações › Webhooks* e crie:
   - URL: `https://campia.app.br/api/webhooks/asaas`
   - Eventos: `PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED`
   - Token de autenticação: o mesmo `ASAAS_WEBHOOK_TOKEN`
4. Faça uma inscrição de teste. Com a Asaas ligada, a inscrição pede o CPF do responsável: use um CPF de teste válido. No painel do sandbox, marque a cobrança como recebida; a tela de pagamento da Campia deve virar "inscrito" sozinha em poucos segundos.

**Depois em produção:**

1. Abra a conta Asaas de produção, de preferência com o **CNPJ da MS Suporte TI**, envie os documentos e cadastre uma **chave PIX** na conta.
2. Gere a chave de API de produção e troque na Vercel:
   - `ASAAS_API_KEY` = a chave de produção
   - `ASAAS_BASE_URL` = `https://api.asaas.com/v3`
3. Crie o mesmo webhook na conta de produção (a de sandbox não vale).
4. Teste com um campeonato de inscrição **R$ 5,00** pagando do seu próprio celular.

### Repasse automático às arenas (split)

- Cada organizador cria a própria conta no Asaas e conecta em **Painel › Recebimentos**, colando a chave de API dele uma vez. A Campia descobre o Wallet ID e **não guarda a chave**.
- A partir daí, cada PIX de inscrição é dividido na hora: `100 − CAMPIA_TAXA_PERCENT`% do valor líquido vai para a conta do organizador e o resto fica na conta da Campia.
- Organizador sem conta conectada, ou se o Asaas recusar a divisão: o dinheiro cai inteiro na conta da Campia e o repasse fica **manual**. Para ver o que falta repassar, rode no *SQL Editor*:

```sql
select c.name as campeonato, t.name as time, p.amount_cents / 100.0 as valor, p.paid_at, u.email as organizador
  from payments p
  join championships c on c.id = p.championship_id
  join teams t on t.id = p.team_id
  join auth.users u on u.id = c.owner_id
 where p.status = 'pago' and p.payout = 'manual'
 order by p.paid_at desc;
```

> Combine a taxa e o repasse por contrato com as arenas e valide a parte fiscal com um contador.

## 6. Lembretes de jogo (agendador)

No Supabase, em *Database › Extensions*, ative **pg_cron** e **pg_net**. Depois, no *SQL Editor*:

```sql
select cron.schedule('campia-lembretes', '*/10 * * * *', $$
  select net.http_get(
    url := 'https://campia.app.br/api/cron/lembretes',
    headers := jsonb_build_object('Authorization', 'Bearer SEU_CRON_SECRET')
  );
$$);
```

Troque `SEU_CRON_SECRET` pelo valor do passo 2. Para conferir: `select * from cron.job_run_details order by start_time desc limit 5;`

## 7. Teste final antes de divulgar

- [ ] Entrar no painel pelo link no e-mail
- [ ] Criar um campeonato de 4 times com inscrição de R$ 5,00
- [ ] Inscrever um time pelo link no celular e pagar o PIX; a vaga deve ficar "Pago" sozinha
- [ ] Lançar um resultado e ver a tabela e a página pública atualizarem
- [ ] Abrir a arte da rodada (aba Compartilhar)
- [ ] Instalar o app no Android (Chrome) e no iPhone (Compartilhar › Adicionar à Tela de Início)
- [ ] Ativar os lembretes e marcar um jogo para daqui a 1h10; o aviso deve chegar por volta de 1 hora antes

## Custos para começar

| Item | Custo |
| --- | --- |
| Domínio campia.app.br | R$ 40 por ano |
| Supabase | grátis para começar; Pro quando tiver clientes |
| Vercel | grátis para testar; Pro (US$ 20 por mês) para uso comercial |
| Asaas | sem mensalidade; taxa por PIX recebido (veja a tabela atual no site da Asaas) |
| SMTP (Resend/Brevo) | grátis até alguns milhares de e-mails por mês |
