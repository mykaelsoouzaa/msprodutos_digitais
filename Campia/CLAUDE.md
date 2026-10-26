# Campia: regras do projeto

## Toda atualização entra em Novidades

Toda mudança que o usuário final percebe (tela nova, recurso, correção visível) precisa, **no mesmo commit**:

1. Subir a versão em `src/lib/version.ts` (`APP_VERSION`) e em `package.json`, sempre iguais:
   - correção pequena → 1.1.0 → 1.1.1
   - recurso ou tela nova → 1.1.0 → 1.2.0
   - mudança grande (ex.: repasse automático às arenas) → 2.0.0
2. Adicionar um item **no topo** de `CHANGELOG` em `src/lib/version.ts` com:
   - `version` e `date` (AAAA-MM-DD);
   - um `title` curto;
   - `items` em português simples, falando do benefício para quem usa e não do código ("Lembrete chega 1 hora antes do jogo", e não "cron de push ajustado").
3. Trocar o nome do cache em `public/sw.js` (`campia-vN` → `campia-vN+1`) quando mudar CSS, ícones ou telas, para o app instalado atualizar.

Mudanças só internas (testes, CI, refatoração sem efeito visível) não sobem versão nem entram em Novidades.

O rodapé, a tela de abertura e a página `/novidades` leem `version.ts`; não há outro lugar para atualizar.

## Verificação antes do commit

- `npm test` (lógica de domínio)
- `bash scripts/test-db.sh` quando mexer em `supabase/migrations`
- CI no GitHub (`.github/workflows/campia-ci.yml`) roda install, testes, build e typecheck
