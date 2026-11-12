# Ofertix: como colocar no ar

Este guia instala o Ofertix na VPS da MS Soluções (Hostinger KVM 1), ao lado do portal e da Nina, no endereço `ofertix.mssolucoestech.com.br`.

## 1. Testar no seu computador (opcional)

No PowerShell:

```powershell
cd "F:\MYKAEL\EMPREGO\PRODUTOS DIGITAIS\MS SOLUCOESTECH"
tar -xzf ofertix-v5.tar.gz
cd ofertix
$env:OFERTIX_DEV="1"; node --experimental-strip-types src/main.ts
```

Abra http://localhost:3200/demo. Precisa do Node 22 ou mais novo (`node -v`).

## 2. Apontar o subdomínio

No Registro.br, em DNS do domínio mssolucoestech.com.br, crie um registro **A** com nome `ofertix` e valor `IP_DA_VPS`.

## 3. Enviar o pacote para a VPS

No PowerShell:

```powershell
cd "F:\MYKAEL\EMPREGO\PRODUTOS DIGITAIS\MS SOLUCOESTECH"
scp ofertix-v5.tar.gz root@IP_DA_VPS:/tmp/
```

## 4. Instalar a Evolution API (WhatsApp por QR Code)

A Evolution API roda em Docker e só fica acessível de dentro da VPS.

```bash
ssh root@IP_DA_VPS
mkdir -p /srv/ms && cd /srv/ms && tar -xzf /tmp/ofertix-v5.tar.gz && chown -R ms:ms /srv/ms/ofertix
command -v docker || (curl -fsSL https://get.docker.com | sh)
cd /srv/ms/ofertix/evolution
printf "EVOLUTION_API_KEY=%s\nSENHA_BANCO=%s\n" "$(openssl rand -hex 24)" "$(openssl rand -hex 16)" > .env
chmod 600 .env
docker compose up -d
sleep 20 && curl -s http://127.0.0.1:8080 | head -c 200; echo
cat .env
```

O `curl` deve responder com uma mensagem de boas-vindas da Evolution API. Guarde o valor de `EVOLUTION_API_KEY`, que vai no passo 5. Ela ocupa cerca de 400 a 600 MB de memória, e a KVM 1 tem 4 GB.

## 5. Configurar o Ofertix

```bash
ssh root@IP_DA_VPS
cd /srv/ms/ofertix
cp .env.exemplo .env
sed -i "s|^SEGREDO_SESSAO=.*|SEGREDO_SESSAO=$(openssl rand -hex 32)|" .env
sed -i "s|^EVOLUTION_API_KEY=.*|EVOLUTION_API_KEY=$(grep EVOLUTION_API_KEY evolution/.env | cut -d= -f2)|" .env
CHAVE=$(awk 'NF {sub(/\r/, ""); printf "%s\\\\n", $0}' /home/ms/portal-publica.pem)
sed -i "s|^PORTAL_CHAVE_PUBLICA=.*|PORTAL_CHAVE_PUBLICA=$CHAVE|" .env
chown ms:ms .env && chmod 600 .env
grep -v SEGREDO .env
```

Confira que `PORTAL_CHAVE_PUBLICA` ficou em uma linha só, começando com `-----BEGIN PUBLIC KEY-----\n`.

## 6. Subir com o pm2 e testar

```bash
ssh root@IP_DA_VPS
su - ms -c "node -v && cd /srv/ms/ofertix && npm test 2>&1 | tail -3"
su - ms -c "cd /srv/ms/ofertix && pm2 start npm --name ofertix -- start && pm2 save"
su - ms -c "pm2 logs ofertix --lines 20 --nostream"
```

O log deve mostrar `Ofertix em http://localhost:3200`. Para que o pm2 também suba o Ofertix pelo `ecosystem.config.cjs`, acrescente este bloco em `apps` no arquivo `/srv/ms/ecosystem.config.cjs`:

```js
{ name: 'ofertix', cwd: '/srv/ms/ofertix', script: 'npm', args: 'start' },
```

## 7. HTTPS no Caddy

```bash
ssh root@IP_DA_VPS
cat >> /etc/caddy/Caddyfile <<'EOF'

ofertix.mssolucoestech.com.br {
	reverse_proxy 127.0.0.1:3200
}
EOF
caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
curl -s https://ofertix.mssolucoestech.com.br/saude
```

O `curl` deve responder `{"ok":true}`. Depois disso, https://ofertix.mssolucoestech.com.br/demo abre a demonstração.

## 8. Ligar no portal (área do cliente e página de serviços)

O Ofertix usa o mesmo contrato de entrada da Nina e da Campia: o portal assina um acesso EdDSA de 60 segundos e faz um POST do campo `token` para o sistema. Cadastre no portal:

| Campo | Valor |
|---|---|
| Identificador (`aud`) | `ofertix` |
| Nome | Ofertix |
| Endereço de entrada | `https://ofertix.mssolucoestech.com.br/sso` |
| Subdomínio | `ofertix.mssolucoestech.com.br` (abre dentro do portal) |
| Teste grátis | 7 dias, com código `demo` (abre o painel de demonstração) |
| Códigos aceitos | vazio = conta normal · `demo` = demonstração · `leitura` = só leitura · `admin` (com `admin: true`) = abre a Administração |

Texto para o card em Serviços da página inicial:

> **Ofertix:** grupos de ofertas no piloto automático. Cole o link da Shopee, do Mercado Livre ou da Amazon e o Ofertix gera o seu link de afiliado, monta a oferta com foto e preço e publica nos seus grupos de WhatsApp. Também acompanha membros, cupons e comissões em um painel só.

## Backups

O banco fica em `/srv/ms/dados/ofertix.db`, dentro da pasta que o backup diário das 3h30 já copia. Confira se o script de backup pega todos os arquivos `.db` dessa pasta.

## Atualizar para a 6.5 (passo a passo das lojas)

- Em Configurações, a parte de lojas virou **Lojas de afiliado**, em três colunas (Shopee, Amazon e Mercado Livre), cada uma com o passo a passo, os campos e se já está configurada.
- **Achar a tag** (Amazon) e **Achar meus parâmetros** (Mercado Livre): cole um link gerado pela sua conta e o Ofertix preenche o campo sozinho. Links curtos (`amzn.to`, `/sec/`) são abertos para chegar ao endereço final.

Nada muda no banco nem no `.env`.

## Atualizar para a 6.4 (regras da Amazon e do Mercado Livre)

- **Amazon:** o link sai direto (sem `/r/`, então não conta clique), sem preço e sem foto, com o aviso de associado no fim. Vale para ofertas, vitrine pública, lista do dia e espelhamento.
- **Mercado Livre:** os parâmetros de outros afiliados saem antes dos seus. Preencha o modelo em Configurações com os parâmetros do seu link (veja a ajuda na tela) e faça uma compra de teste.
- **Automação:** o contador agora diz "Grupos copiados / limite": o limite conta os grupos de origem, não os de destino.
- No painel de Associados da Amazon, cadastre os grupos de WhatsApp como canal de divulgação.

Nada muda no banco nem no `.env`.

## Atualizar para a 6.3 (envio por tema e espelhamento)

- **Envio por tema** em Grupos de envio: botão **Tema** em cada grupo de envio, com as categorias que ele recebe e o preço máximo. A vitrine, os horários automáticos, a captura e o espelhamento respeitam o tema. Grupo sem tema continua recebendo tudo.
- **Automação** (menu novo): espelhamento de grupos. Cada mensagem nova do grupo de origem sai nos seus grupos igualzinha, com os seus links de afiliado. Mensagem com link de loja que não dá para trocar fica bloqueada.
- A imagem copiada é servida em `https://ofertix.cloud/m/<código>` para a Evolution API baixar. Por isso o `URL_PUBLICA` do `.env` precisa ser o endereço público (já é `https://ofertix.cloud`).

O banco recebe as tabelas e colunas novas sozinho. Nada muda no `.env`.

## Atualizar para a 6.2 (Black Friday)

- Modelo de mensagem **Black Friday (contagem regressiva)** em Nicho e curadoria → Modelos.
- Campo novo `{contagem}` para qualquer modelo: "· faltam 15 dias", "· é amanhã!", "· é HOJE!" e "· últimos dias" (até a segunda-feira seguinte). Fora da época, fica vazio. Usa o fuso do `TZ` do `.env`.

Nada muda no banco nem no `.env`.

## Atualizar para a 6.1 (animação, página do anúncio e botão de WhatsApp)

- **Animação no topo** da página de vendas: a oferta saindo para 19 grupos, um de cada vez, com o horário de cada envio e os cliques subindo. Com "reduzir movimento" ligado no celular, aparece parada.
- **Página do anúncio** em `/quero-testar`: a mesma mensagem do anúncio "EU QUERO", a animação, três benefícios, três dúvidas e o botão de teste. Não aparece no Google. Sem `?o=`, as visitas entram na Administração com a origem "anuncio".
- **Botão de WhatsApp** flutuante nas duas páginas. Passa por `/zap`, que conta o clique por origem e abre a conversa com `WHATSAPP_CONTATO` (padrão: o WhatsApp da MS Soluções). A Administração ganhou a coluna "WhatsApp".

Nada muda no banco nem no `.env` (o `WHATSAPP_CONTATO` é opcional).

## Atualizar para a v6 (página de vendas e mais automações)

- **Página de vendas** em `/` (ofertix.cloud): planos, calculadora, dúvidas e os botões de teste grátis (vão para `PORTAL_URL/teste?sis=ofertix`) e de demonstração. Visitas e cliques entram na Administração, separados pela origem: use `?o=` no link de cada anúncio ou post (ex.: `https://ofertix.cloud/?o=stories`). Quem já está logado continua indo direto ao painel (para ver a página, use `/?site`).
- **Buscar na Shopee** (em Ofertas): produtos por palavra, com preço, nota, vendas e comissão, já marcando o que não passa no seu nicho.
- **Vitrine abastecida sozinha** (em Nicho): todo dia, no horário escolhido, busca com as suas palavras e com a coleção do dia e põe na vitrine os que passam na curadoria.
- **Enquetes**, **lista do dia** e **respostas automáticas no privado** (em Mensagens automáticas).
- **Enviar de novo** (em Agendamentos) e **próximas datas do varejo** (na Visão geral).

O banco recebe as tabelas e colunas novas sozinho.

```bash
ssh root@IP_DA_VPS
cd /srv/ms && tar -xzf /tmp/ofertix-v6.tar.gz && chown -R ms:ms /srv/ms/ofertix
grep -q '^ADMIN_EMAILS=.\+' /srv/ms/ofertix/.env && echo "admin ok" || echo "FALTA ADMIN_EMAILS no .env"
su - ms -c "cd /srv/ms/ofertix && npm test 2>&1 | tail -3 && pm2 restart ofertix"
```

A partir da v6, `ADMIN_EMAILS` não tem mais valor padrão no código: se o `.env` não tiver essa linha, ninguém vê a Administração.

Para a resposta no privado, a Evolution API precisa mandar as mensagens das conversas individuais no evento `MESSAGES_UPSERT`, que é o padrão.

## Atualizar para a v5 (20 melhorias)

Primeiros passos, aquecimento do número, pausa geral, envio de teste, mensagens recorrentes, boas-vindas, busca, edição, campeãs, aviso de oferta repetida, histórico de preço, envio direto para a vitrine, arquivamento, melhores horários, meta de comissão, funil, grupos cansados, resumo semanal, vitrine pública `/v/<endereço>` e instalação como app. O banco recebe as tabelas e colunas novas sozinho.

```bash
ssh root@IP_DA_VPS
cd /srv/ms && tar -xzf /tmp/ofertix-v5.tar.gz && chown -R ms:ms /srv/ms/ofertix
su - ms -c "cd /srv/ms/ofertix && npm test 2>&1 | tail -3 && pm2 restart ofertix"
```

O aquecimento vale para números conectados a partir da v5 e para os conectados há menos de 3 semanas. Para desligar, use Configurações › Mais opções.

## Atualizar para a v4 (nicho e curadoria)

A v4 junta os links de entrada da v3 com a tela **Nicho e curadoria**: categorias, regras de curadoria (preço, nota, vendas, palavras), coleções da semana, modelos de mensagem, rodapé de afiliado e o pacote pronto de achadinhos femininos. O banco recebe as colunas novas sozinho.

```bash
ssh root@IP_DA_VPS
cd /srv/ms && tar -xzf /tmp/ofertix-v4.tar.gz && chown -R ms:ms /srv/ms/ofertix
su - ms -c "cd /srv/ms/ofertix && npm test 2>&1 | tail -3 && pm2 restart ofertix"
```

## Atualizar para a v3 (links de entrada)

Mesmo processo da v2: extrair por cima, `npm test` e `pm2 restart ofertix`. O banco ganha as tabelas novas sozinho. A página pública fica em `https://ofertix.mssolucoestech.com.br/g/<endereço>`, sem configuração nova no Caddy.

Para cada grupo que vai entrar no rodízio, o número conectado ao Ofertix precisa ser **administrador**, para o botão "Pegar do WhatsApp" conseguir o link de convite. Se não for, cole o link de convite à mão.

## Atualizar da v1 para a v2

O banco da v1 recebe as colunas novas sozinho quando o Ofertix abre. Acrescente o fuso no `.env` e reinicie:

```bash
ssh root@IP_DA_VPS
cd /srv/ms && tar -xzf /tmp/ofertix-v3.tar.gz && chown -R ms:ms /srv/ms/ofertix
grep -q '^TZ=' /srv/ms/ofertix/.env || echo 'TZ=America/Sao_Paulo' >> /srv/ms/ofertix/.env
su - ms -c "cd /srv/ms/ofertix && npm test 2>&1 | tail -3 && pm2 restart ofertix"
```

O link curto `/r/...` já funciona pelo mesmo endereço do Caddy, sem configuração nova.

## Atualizar

```bash
ssh root@IP_DA_VPS
cd /srv/ms && tar -xzf /tmp/ofertix-vN.tar.gz && chown -R ms:ms /srv/ms/ofertix
su - ms -c "pm2 restart ofertix"
```

O `.env`, o banco e a pasta `evolution/.env` não vêm no pacote, então nada disso é apagado.
