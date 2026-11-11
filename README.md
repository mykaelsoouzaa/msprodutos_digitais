# MS Produtos Digitais

Produtos digitais da MS Suporte TI.

| Produto | O que é | Pasta |
| --- | --- | --- |
| [Campia](https://campia.app.br) | Plataforma para organizar campeonatos amadores de qualquer esporte: tabela automática, inscrição com PIX, resultados, página pública e app instalável com lembretes | [`Campia/`](Campia/) |
| [Ofertix](https://ofertix.cloud) | Painel para afiliados com grupos de ofertas no WhatsApp: link de afiliado automático, envio espaçado para vários grupos, vitrine com horários, curadoria por nicho, link de entrada para a bio, cliques e comissões | [`Ofertix/`](Ofertix/) |

## Campia

![Campia](Campia/brand/campia-logo-claro.png)

- `Campia/`: o sistema (Next.js + Supabase + PIX Asaas). Instruções em [`Campia/README.md`](Campia/README.md).
- `Campia/docs/PUBLICAR.md`: passo a passo para colocar o campia.app.br no ar com o PIX funcionando.
- `Campia/brand/`: logo, símbolo e imagens para redes sociais.
- `Campia/prototipo/`: protótipo navegável com todas as funções estudadas e vídeo de demonstração.

## Ofertix

![Ofertix](Ofertix/public/assets/logo-128.png)

- `Ofertix/`: o sistema (Node 22 + TypeScript sem dependências, SQLite nativo, WhatsApp pela Evolution API). O que ele faz está em [`Ofertix/README.md`](Ofertix/README.md).
- `Ofertix/COMO-RODAR.md`: instalação e atualização na VPS, com Caddy e pm2.
- `Ofertix/prototipo/`: protótipo navegável do painel.
- Testes: `cd Ofertix && npm test`.
