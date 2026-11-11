# Ofertix

Painel para afiliados que mantêm grupos de ofertas no WhatsApp. Faz parte dos sistemas da MS Soluções Tecnológicas e abre pela área do cliente em mssolucoestech.com.br, como a Nina e a Campia.

## O que faz

- **Ofertas:** você cola um link da Shopee, do Mercado Livre, da Amazon ou da Magalu. O Ofertix troca pelo seu link de afiliado, busca título, foto, preço e comissão e monta a mensagem.
- **Agendamentos:** envia na hora ou agenda para vários grupos. Entre um grupo e outro do mesmo número existe um intervalo aleatório (padrão de 25 a 70 s), e o plano define um limite diário por número.
- **Grupos de envio:** sincroniza os grupos do WhatsApp. Para cada grupo você liga ou desliga "Enviar ofertas" e "Capturar ofertas".
- **Captura:** lê os links que chegam nos grupos monitorados, converte para o seu link e guarda em Ofertas. Se você ligar a publicação automática, também publica sozinho. Dá para definir um desconto mínimo.
- **Membros:** registra quem entra e sai de cada grupo e mostra o total, o saldo diário, o churn e o gráfico de evolução.
- **Comissões:** puxa o relatório de conversões da Open API de afiliados da Shopee a cada 6 horas e mostra comissão, valor vendido, pedidos, ticket médio e taxa de realização.
- **Cupons:** o cupom ativo de cada loja entra sozinho no texto (campo `{cupom}`).
- **WhatsApp:** conecta números por QR Code pela Evolution API. O plano define quantos números cada conta pode ter.
- **Configurações:** credenciais da Shopee, tag da Amazon, parâmetros do Mercado Livre, modelo da mensagem com prévia e o intervalo entre envios.
- **Administração:** quem tem e-mail em `ADMIN_EMAILS` vê todas as contas e troca o plano de cada uma.
- **Cliques:** cada link sai como `ofertix.../r/<código>`, um código por grupo, e leva direto ao link de afiliado. Robôs de prévia não contam. Dá para desligar em Configurações.
- **Ranking:** a Visão geral mostra as ofertas mais clicadas e os grupos que mais clicam, com a média de cliques por envio.
- **Vários links de uma vez:** até 20 links viram ofertas agendadas, uma a cada 10 minutos a 2 horas.
- **Vitrine e horários automáticos:** a ⭐ põe a oferta na vitrine. Em cada horário configurado (ex.: 09:00, 12:00, 18:00, 21:00), a mais antiga vai para todos os grupos de envio. Um horário que passou há mais de 15 minutos com o servidor desligado é ignorado.
- **Janela de envio:** fora da janela (padrão 8h às 22h) nada sai. O que estiver agendado espera a próxima abertura, e uma fila montada quando a janela fecha é empurrada inteira, sem perder o espaçamento.
- **Proteção contra repetição:** a mesma oferta não volta ao mesmo grupo dentro do prazo escolhido (padrão 24 h). Esses grupos aparecem como pulados.
- **Variações de texto:** `{🔥|⚡|🚨}` sorteia uma opção por grupo, e o modelo padrão já vem com variações.
- **Conferência de preço (Shopee):** logo antes de enviar, consulta a Open API. Se o produto acabou ou o preço subiu mais de 5%, o envio é cancelado e o motivo aparece em Agendamentos.
- **Resumo diário no WhatsApp:** no horário escolhido, o dono da conta recebe mensagens, cliques, capturas, comissões, membros e avisos.
- **Avisos no painel:** número desconectado, envios com erro, limite diário perto do fim, vitrine vazia e credenciais da Shopee faltando.
- **Exportar CSV:** envios (com cliques por grupo) e comissões, com separador `;` e acentos certos para abrir direto no Excel.
- **Links de entrada (v3):** uma página pública em `/g/<endereço>` para a bio do Instagram. A pessoa escolhe o tema (Beleza, Casa, Moda...) e vai direto para o convite do grupo com vaga. Os grupos de cada tema enchem na ordem definida: quando o primeiro chega ao limite (padrão 1.000, o WhatsApp aceita 1.024), o próximo assume. O convite vem da Evolution API (o número precisa ser admin do grupo) ou é colado à mão. Visitas e cliques são contados por origem (`?o=bio`, `?o=stories`, `?o=reels`, `?o=whatsapp`), e os avisos alertam quando faltam menos de 100 vagas ou quando um tema lotou. Os participantes são atualizados a cada 30 minutos e a cada entrada ou saída.
- **Página de vendas (v6):** em `/` para quem não está logado: planos (lidos de `src/planos.ts`), calculadora de ganhos, dúvidas e botões que contam o clique por origem (`?o=`) antes de ir para o teste grátis no portal ou para a demonstração. O relatório fica na Administração.
- **Página do anúncio e WhatsApp (6.1):** `/quero-testar` para quem vem do anúncio "EU QUERO", animação do envio no topo das duas páginas e botão flutuante de WhatsApp que conta o clique por origem (`/zap`).
- **Busca na Shopee (v6):** produtos por palavra pela Open API, com preço, nota, vendas e comissão, já dizendo o que não passa no nicho. Um clique põe na vitrine ou abre o envio.
- **Vitrine abastecida sozinha (v6):** todo dia, no horário escolhido, busca com as palavras da conta e com a coleção do dia, aplica a curadoria e põe os melhores na vitrine.
- **Enquetes (v6):** enquete do WhatsApp pela mesma fila das ofertas, com intervalo e janela de envio.
- **Lista do dia (v6):** no horário escolhido, uma mensagem com as ofertas mais clicadas do dia e o link da vitrine.
- **Respostas no privado (v6):** palavra-chave → resposta, com `{nome}`, `{link_grupos}`, `{vitrine}` e `{cupons}`. Cada contato recebe a mesma resposta no máximo uma vez a cada 12 h, e a pausa geral também segura as respostas.
- **Enviar de novo e próximas datas (v6):** repete um envio com o mesmo texto e grupos; a Visão geral mostra as próximas datas do varejo (11.11, Black Friday, Natal...).
- **Demonstração:** `/demo` (ou o código `demo` vindo do portal) abre um painel com dados fictícios e WhatsApp simulado. Os dados ficam só na memória.

## Planos (provisórios)

Os limites ficam em `src/planos.ts`.

| | Teste | Inicial | Pro | Escala |
|---|---|---|---|---|
| Preço/mês | grátis | R$ 47 | R$ 97 | R$ 197 |
| Números de WhatsApp | 1 | 1 | 2 | 4 |
| Grupos de envio | 3 | 5 | 15 | 40 |
| Grupos monitorados (captura) | 2 | não | 10 | 30 |
| Envios por número por dia | 100 | 300 | 800 | 1.500 |

## Tecnologia

- Node 22 com TypeScript, rodando direto sem compilação (`--experimental-strip-types`) e sem nenhuma dependência.
- Banco SQLite nativo do Node (`node:sqlite`), em `src/db.ts`.
- `src/servidor.ts`: HTTP, API, entrada pelo portal (`POST /sso`) e webhook da Evolution API (`POST /webhook/whatsapp/<instância>?t=<token>`).
- `src/servico.ts`: regras de ofertas, fila de envio, captura, membros e comissões.
- `src/shopee.ts`: Open API de afiliados da Shopee (GraphQL com assinatura SHA256).
- `src/whatsapp.ts`: Evolution API v2 e o WhatsApp simulado.
- `src/v6.ts`: busca na Shopee, vitrine abastecida, enquetes, lista do dia, respostas no privado, datas e visitas do site.
- `src/vendas.ts`: a página de vendas.
- `public/index.html`: o painel, uma página só, com tema claro e escuro.
- `prototipo/index.html`: o mesmo painel com uma API simulada no navegador. Gera com `python3 scripts/gerar-prototipo.py <snapshot.json>`.

## Rodar

```bash
npm run demo    # http://localhost:3200/demo (painel de demonstração) ou /dev-login?email=voce@exemplo.com
npm test        # 51 testes
```

Para colocar no ar na VPS e ligar no portal, siga o [COMO-RODAR.md](COMO-RODAR.md).

## A confirmar no primeiro uso real

- Os campos da Open API da Shopee (`generateShortLink`, `productOfferV2`, `conversionReport`) seguem a documentação de afiliados. Teste com o seu AppID antes de vender.
- Os endpoints e eventos da Evolution API v2 (`/instance/create`, `/instance/connect`, `/group/fetchAllGroups`, `/message/sendMedia` e os eventos `MESSAGES_UPSERT`, `GROUP_PARTICIPANTS_UPDATE`, `CONNECTION_UPDATE`). Confira na versão instalada.
- Mercado Livre: o link oficial de afiliado sai do painel de afiliados do ML. O Ofertix acrescenta os parâmetros configurados, então confira se a comissão está sendo registrada.
- WhatsApp por QR Code não é a API oficial da Meta. Existe risco de bloqueio do número se o envio for agressivo, e por isso existem os intervalos, o limite diário e as dicas na tela WhatsApp.
