# Event Date Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o evento para 31 de outubro de 2026 e remover horários dos Hands-on de todas as interfaces.

**Architecture:** Preservar o campo persistido `starts_at` para compatibilidade, gravando datas demonstrativas como `2026-10-31`. Tratar esse valor como data na interface e remover qualquer formatação ou entrada de horário. Atualizar o card social e publicar uma nova versão privada do Site existente.

**Tech Stack:** TypeScript, React, Vinext, Cloudflare D1, Node Test, Vitest, Sites.

## Global Constraints

- Data do evento: `31 de outubro de 2026`.
- Destaque curto: `31 OUT · FORTALEZA, CE`.
- Nenhuma interface pública ou administrativa informa horário dos Hands-on.
- O esquema do banco e as regras de inscrição permanecem inalterados.

---

### Task 1: Proteção por teste e atualização da data

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `app/components/PublicRegistration.tsx`
- Modify: `app/components/WorkshopCard.tsx`
- Modify: `app/lib/runtime.ts`
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: campo existente `startsAt: string`.
- Produces: interface que apresenta somente a data do evento e nunca apresenta horários de Hands-on.

- [ ] **Step 1: Escrever teste falho**

Adicionar ao teste renderizado asserções de que `31 OUT · FORTALEZA, CE` aparece e `19 SET`, `2026-09-19`, `10:30` e `14:00` não aparecem.

- [ ] **Step 2: Confirmar a falha**

Run: `npm run test:render`
Expected: FAIL porque a página ainda apresenta `19 SET`.

- [ ] **Step 3: Implementar a correção mínima**

Atualizar o destaque para `31 OUT`; usar `2026-10-31` nos dados iniciais; remover a data/hora dos cards e confirmações; trocar `datetime-local` por `date`; apresentar somente data no painel.

- [ ] **Step 4: Confirmar aprovação**

Run: `npm run test:render`
Expected: PASS.

### Task 2: Card social e verificação completa

**Files:**
- Replace: `public/og.png`

**Interfaces:**
- Consumes: identidade visual e título existentes.
- Produces: card social com o texto exato `31 OUT · FORTALEZA, CE`, sem horário.

- [ ] **Step 1: Gerar um único card social atualizado**

Usar ImageGen com o título exato do evento e a nova data, preservando a paleta azul/ciano e sem logotipos.

- [ ] **Step 2: Validar o texto da imagem e substituir o ativo**

Conferir visualmente os dois textos e salvar em `public/og.png`.

- [ ] **Step 3: Executar verificação integral**

Run: `npm test -- --run && npm run lint && npx tsc --noEmit && npm run build && node --test tests/rendered-html.test.mjs`
Expected: todos os comandos encerram com código 0.

- [ ] **Step 4: Confirmar remoção da data antiga**

Run: `rg -n "19 SET|2026-09-19|10:30|14:00" app tests README.md`
Expected: nenhuma ocorrência relacionada aos Hands-on.

### Task 3: Publicação

**Files:**
- Reuse: `.openai/hosting.json`

**Interfaces:**
- Consumes: build validado e projeto Sites existente.
- Produces: nova versão privada no mesmo endereço.

- [ ] **Step 1: Commitar o estado validado**

Run: `git add . && git commit -m "Update event date to October 31"`

- [ ] **Step 2: Enviar, empacotar e salvar nova versão**

Usar a credencial temporária do repositório Sites e o script oficial `package-site.sh`.

- [ ] **Step 3: Publicar privadamente e acompanhar até o estado terminal**

Expected: implantação `succeeded` e URL de produção preservada.
