# Shared Email and Multiple Workshops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir vários participantes por e-mail, seleção do nome no fluxo público e múltiplas inscrições por pessoa até um limite global editável.

**Architecture:** Uma migração SQLite versionada substitui as duas restrições de unicidade antigas e adiciona o limite ao registro de configurações. As rotas públicas usam e-mail mais `participantId`, sempre revalidando a associação no servidor, e uma inclusão SQL condicional protege limite pessoal e capacidade contra concorrência. A interface mantém uma máquina de estados simples — e-mail, nome, Hands-on e resumo — e a VPS permanece inalterada durante a validação local.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, SQLite com `better-sqlite3`, Vitest, Node.js 22 e Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-20-shared-email-multiple-workshops-design.md`

## Global Constraints

- O participante informa somente o e-mail e escolhe um nome apenas quando houver mais de um associado.
- A identidade persistida é `e-mail normalizado + nome normalizado`, sem distinção de maiúsculas/minúsculas no nome.
- Cada nome possui inscrições e limite independentes.
- O limite global é inteiro, mínimo 1, editável no painel e começa em 1.
- Uma pessoa não pode repetir o mesmo Hands-on; prazo, atividade e capacidade continuam obrigatórios.
- A migração preserva IDs e dados existentes e falha com rollback se a integridade não puder ser comprovada.
- O CSV administrativo usa colunas separadas `Hands-on`, `Nome`, `E-mail` e `Data da inscrição`.
- A versão é validada localmente em banco separado; nenhum deploy na VPS faz parte deste plano.
- A interface continua responsiva para smartphone e não informa horário dos Hands-on.

## Review Focus

- E-mail com maiúsculas/espaços e nome repetido apenas por diferença de caixa deve localizar uma única identidade; Task 2 adiciona teste literal.
- Migração de banco com inscrições existentes deve conservar IDs, referências e contagens; Task 1 executa `foreign_key_check` em teste real.
- Duas solicitações simultâneas na última vaga ou no último espaço do limite devem produzir apenas uma inclusão; Task 3 fixa ambos os casos no E2E.
- Reduzir o limite para menos que a quantidade atual não apaga dados e bloqueia somente novas inscrições; Tasks 1 e 3 cobrem persistência e resposta.
- E-mail inexistente, e-mail com um nome e e-mail com vários nomes precisam gerar estados públicos distintos e utilizáveis por toque; Tasks 3, 4 e 5 cobrem API, estado da interface e viewport móvel.

---

### Task 1: Migração SQLite versionada e novo modelo

**Files:**
- Create: `db/migrations.ts`
- Create: `db/migrations.test.ts`
- Modify: `app/lib/runtime.ts`
- Modify: `app/lib/runtime.test.ts`
- Modify: `db/schema.ts`

**Interfaces:**
- Consumes: `DatabaseBinding` e `PreparedQuery` de `db/database.ts`.
- Produces: `migrateDatabase(db: DatabaseBinding): Promise<void>` e esquema versão 2 com `event_settings.max_workshops_per_participant`.
- Preserva: IDs de `participants`, `registrations`, `workshops` e `event_settings`.

- [ ] **Step 1: Escrever o teste de migração que falha**

Criar um banco temporário com o esquema legado, dois participantes, duas inscrições e prazo configurado. O teste deve chamar a API desejada e comprovar dados, novos índices e integridade:

```ts
await legacy.prepare("INSERT INTO participants (id, name, email) VALUES (7, 'Ana', 'ana@example.com')").run();
await legacy.prepare("INSERT INTO registrations (id, participant_id, workshop_id) VALUES (11, 7, 1)").run();

await migrateDatabase(legacy);

expect(await legacy.prepare("SELECT id, name, email FROM participants WHERE id = 7").first())
  .toEqual({ id: 7, name: "Ana", email: "ana@example.com" });
expect(await legacy.prepare("SELECT id, participant_id FROM registrations WHERE id = 11").first())
  .toEqual({ id: 11, participant_id: 7 });
expect(await legacy.prepare("SELECT max_workshops_per_participant AS maximum FROM event_settings WHERE id = 1").first())
  .toEqual({ maximum: 1 });
expect((await legacy.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
```

Adicionar casos para:

- banco novo já nascer na versão 2;
- execução repetida ser idempotente;
- dois nomes com o mesmo e-mail serem aceitos;
- mesmo e-mail e mesmo nome com caixa diferente serem rejeitados;
- duas inscrições da mesma pessoa em Hands-on diferentes serem aceitas;
- segunda inscrição da mesma pessoa no mesmo Hands-on ser rejeitada.

- [ ] **Step 2: Executar e verificar a falha correta**

Run: `npm test -- db/migrations.test.ts`

Expected: FAIL porque `db/migrations.ts` e `migrateDatabase` ainda não existem.

- [ ] **Step 3: Implementar a migração mínima**

Em `db/migrations.ts`, criar:

```ts
export const CURRENT_SCHEMA_VERSION = 2;
export async function migrateDatabase(db: DatabaseBinding): Promise<void>;
```

O fluxo deve:

1. criar `schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
2. consultar `sqlite_master` para distinguir banco novo de banco legado;
3. no banco novo, criar diretamente as tabelas e índices versão 2;
4. no legado, desligar `foreign_keys` fora da transação, renomear `registrations` e `participants`, criar as tabelas novas, copiar IDs e dados, remover legados e adicionar a coluna de limite em uma única transação;
5. criar `UNIQUE INDEX idx_participants_email_name ON participants(email, name COLLATE NOCASE)`;
6. criar `UNIQUE INDEX idx_registrations_workshop_participant ON registrations(workshop_id, participant_id)` sem unicidade apenas em `participant_id`;
7. registrar versão 2, religar `foreign_keys` em `finally` e rejeitar se `PRAGMA foreign_key_check` retornar linhas.

Atualizar `ensureDatabase()` para chamar `migrateDatabase()` antes de seed/configuração e remover o DDL duplicado. Atualizar `db/schema.ts` para refletir o índice composto e `maxWorkshopsPerParticipant`.

- [ ] **Step 4: Executar testes focados e confirmar verde**

Run: `npm test -- db/migrations.test.ts app/lib/runtime.test.ts db/sqlite.test.ts`

Expected: PASS com migração, idempotência e persistência reais.

- [ ] **Step 5: Executar a suíte completa**

Run: `npm test`

Expected: todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add db/migrations.ts db/migrations.test.ts db/schema.ts app/lib/runtime.ts app/lib/runtime.test.ts
git commit -m "feat: migrate registrations for shared emails"
```

---

### Task 2: Importação por e-mail e nome

**Files:**
- Modify: `app/lib/import-participants.ts`
- Modify: `app/lib/import-participants.test.ts`
- Modify: `app/api/admin/participants/import/route.ts`
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: linhas `Record<string, unknown>[]` produzidas por `parseParticipantFile()`.
- Produces: `ImportResult` com `valid`, `errors`, `ignored` e `duplicates`; cada item válido possui `name`, `email` e `row`.
- Persistência: busca e atualiza por `email = ? AND name = ? COLLATE NOCASE`.

- [ ] **Step 1: Escrever testes falhos para identidades compartilhadas**

Substituir o teste que mantém apenas o último nome por e-mail por estes comportamentos:

```ts
it("keeps different registered names that share an email", () => {
  const result = parseParticipantRows([
    { Nome: "João Victor", Email: "arcanjocity@gmail.com" },
    { Nome: "Jonys Arcanjo", Email: "ARCANJOCITY@gmail.com" },
  ]);
  expect(result.valid).toEqual([
    { name: "João Victor", email: "arcanjocity@gmail.com", row: 2 },
    { name: "Jonys Arcanjo", email: "arcanjocity@gmail.com", row: 3 },
  ]);
});

it("counts an exact email and name repetition once", () => {
  const result = parseParticipantRows([
    { Nome: "Jonys Arcanjo", Email: "arcanjocity@gmail.com" },
    { Nome: "  JONYS   ARCANJO ", Email: " ARCANJOCITY@gmail.com " },
  ]);
  expect(result.valid).toEqual([{ name: "Jonys Arcanjo", email: "arcanjocity@gmail.com", row: 2 }]);
  expect(result.duplicates).toBe(1);
});
```

O segundo teste captura a quebra em que a mesma pessoa seria criada novamente por caixa ou espaços.

- [ ] **Step 2: Executar e verificar a falha correta**

Run: `npm test -- app/lib/import-participants.test.ts`

Expected: FAIL porque o mapa atual usa somente e-mail e `duplicates` não existe.

- [ ] **Step 3: Implementar chave composta normalizada**

Adicionar uma função privada que produza chave `email + "\0" + name.toLocaleLowerCase("pt-BR")` depois de `normalizeName`. Preservar a primeira grafia válida e incrementar `duplicates` nas ocorrências seguintes. Não tratar nomes distintos como repetição.

Na rota, trocar a busca por:

```sql
SELECT id FROM participants
WHERE email = ? AND name = ? COLLATE NOCASE
```

Inserir nomes novos mesmo quando o e-mail já existe. Retornar `duplicates` no JSON e exibi-lo na mensagem administrativa como `repetições no arquivo`.

- [ ] **Step 4: Testar parser e importação HTTP**

Run: `npm test -- app/lib/import-participants.test.ts app/lib/participant-file.test.ts`

Expected: PASS.

Acrescentar ao `tests/deploy-e2e.mjs` uma importação com João Victor e Jonys Arcanjo no mesmo e-mail e uma repetição exata; a resposta deve indicar dois participantes persistidos e uma repetição.

- [ ] **Step 5: Executar suíte completa**

Run: `npm test`

Expected: todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add app/lib/import-participants.ts app/lib/import-participants.test.ts app/api/admin/participants/import/route.ts app/admin/page.tsx tests/deploy-e2e.mjs
git commit -m "feat: import shared email participants"
```

---

### Task 3: Regras administrativas e APIs públicas

**Files:**
- Create: `app/lib/participant-status.ts`
- Create: `app/lib/participant-status.test.ts`
- Create: `app/api/admin/settings/max-workshops/route.ts`
- Create: `app/api/admin/settings/max-workshops/route.test.ts`
- Modify: `app/api/admin/dashboard/route.ts`
- Modify: `app/api/eligibility/route.ts`
- Modify: `app/api/register/route.ts`
- Modify: `tests/deploy-e2e.mjs`

**Interfaces:**
- Produces: `loadParticipantStatus(db, email, participantId)` retornando `{ participant, registrations, workshops, maximum, remaining }` ou `null` quando ID e e-mail não correspondem.
- `POST /api/eligibility`: `{ email, participantId? }` → `not-found`, `choose-participant` ou `eligible`.
- `POST /api/register`: `{ email, participantId, workshopId }` → situação atualizada ou erro específico.
- `PUT /api/admin/settings/max-workshops`: `{ maximum: number }`, inteiro entre 1 e 100.

- [ ] **Step 1: Escrever teste falho para o estado individual**

Com banco SQLite real, cadastrar duas pessoas no mesmo e-mail, duas oficinas e uma inscrição. Testar que `loadParticipantStatus(db, email, id)`:

- rejeita ID de outro e-mail;
- retorna apenas inscrições do nome escolhido;
- calcula `maximum` e `remaining` com literais;
- exclui da lista elegível o Hands-on já escolhido;
- retorna `remaining: 0` quando o limite é reduzido abaixo da quantidade atual sem apagar inscrições.

- [ ] **Step 2: Executar e observar falha por símbolo ausente**

Run: `npm test -- app/lib/participant-status.test.ts`

Expected: FAIL porque `loadParticipantStatus` não existe.

- [ ] **Step 3: Implementar o carregador de situação**

Criar tipos explícitos `ParticipantSummary`, `RegistrationSummary`, `WorkshopSummary` e `ParticipantStatus`. Usar consultas parametrizadas, calcular `remaining = Math.max(0, maximum - registrations.length)` e não misturar dados de outros nomes que compartilham o e-mail.

- [ ] **Step 4: Escrever testes falhos da configuração administrativa**

Testar a rota real com autenticação existente para:

```ts
expect(await putMaximum(0)).toMatchObject({ status: 400 });
expect(await putMaximum(1.5)).toMatchObject({ status: 400 });
expect(await putMaximum(2)).toMatchObject({ status: 200 });
```

Confirmar no banco que 2 foi persistido e que requisição sem sessão retorna 401.

- [ ] **Step 5: Implementar endpoint e dashboard**

Criar a rota `max-workshops`, validar inteiro de 1 a 100 e atualizar `event_settings`. Acrescentar `maxWorkshopsPerParticipant` ao objeto `settings` do dashboard.

- [ ] **Step 6: Escrever o E2E falho para seleção e limite**

No servidor standalone real:

1. configurar máximo 2;
2. importar João Victor e Jonys Arcanjo com o mesmo e-mail;
3. consultar apenas o e-mail e exigir `choose-participant` com os dois nomes;
4. selecionar João pelo ID e inscrevê-lo em dois Hands-on diferentes;
5. repetir o primeiro Hands-on e esperar 409 `already-registered`;
6. tentar um terceiro Hands-on e esperar 409 `limit-reached`;
7. selecionar Jonys e comprovar `remaining: 2`;
8. disparar duas inscrições simultâneas quando restar um espaço pessoal e esperar um 201 e um 409;
9. manter o teste existente da última vaga com um 201 e um 409.

- [ ] **Step 7: Executar o E2E e observar a falha de contrato**

Run: `npm run test:deploy-e2e`

Expected: FAIL porque as rotas ainda tratam o e-mail como uma única pessoa e bloqueiam toda segunda inscrição.

- [ ] **Step 8: Implementar eligibility e registro atômico**

Na elegibilidade, buscar todos por e-mail ordenados por nome. Sem `participantId` e com vários resultados, retornar apenas `{ id, name }`. Com um resultado, carregar situação automaticamente. Com seleção, validar `id + email` via `loadParticipantStatus`.

No registro, fazer pré-validações para mensagens claras e concluir com um único `INSERT ... SELECT` que somente insere quando:

```sql
NOT EXISTS (SELECT 1 FROM registrations WHERE participant_id = ? AND workshop_id = ?)
AND (SELECT COUNT(*) FROM registrations WHERE participant_id = ?)
    < (SELECT max_workshops_per_participant FROM event_settings WHERE id = 1)
AND (SELECT COUNT(*) FROM registrations WHERE workshop_id = ?)
    < (SELECT capacity FROM workshops WHERE id = ? AND active = 1)
```

Incluir `email` na validação da pessoa e, se `changes === 0`, reler o estado para distinguir repetição, limite e última vaga. A resposta 201 devolve a situação atualizada.

- [ ] **Step 9: Confirmar testes focados, E2E e regressão**

Run: `npm test -- app/lib/participant-status.test.ts app/api/admin/settings/max-workshops/route.test.ts`

Expected: PASS.

Run: `npm run test:deploy-e2e`

Expected: PASS incluindo concorrência de limite e capacidade.

Run: `npm test`

Expected: todos os testes passam.

- [ ] **Step 10: Commit**

```bash
git add app/lib/participant-status.ts app/lib/participant-status.test.ts app/api/admin/settings/max-workshops app/api/admin/dashboard/route.ts app/api/eligibility/route.ts app/api/register/route.ts tests/deploy-e2e.mjs
git commit -m "feat: enforce configurable workshop limits"
```

---

### Task 4: Interface pública, painel e exportação

**Files:**
- Create: `app/components/ParticipantChoice.tsx`
- Create: `app/components/RegistrationSummary.tsx`
- Modify: `app/components/PublicRegistration.tsx`
- Modify: `app/admin/page.tsx`
- Modify: `app/lib/registrations-csv.ts`
- Modify: `app/lib/registrations-csv.test.ts`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- `ParticipantChoice({ participants, onSelect, disabled })` recebe `{ id, name }[]` e emite o ID escolhido.
- `RegistrationSummary({ registrations, maximum, remaining })` apresenta inscrições atuais e saldo sem expor horários.
- `PublicRegistration` envia `email + participantId` e mantém estados separados para candidatos, pessoa selecionada, inscrições, oficinas e saldo.

- [ ] **Step 1: Escrever o teste falho do CSV**

Alterar a expectativa literal do cabeçalho:

```ts
expect(csv).toBe(
  '\uFEFFHands-on,Nome,E-mail,Data da inscrição\r\n' +
  '"Clean Core, na prática","Ana ""Bia""",ana@example.com,2026-08-25 13:29:53',
);
```

Este teste falha se nome e e-mail forem combinados ou se o cabeçalho continuar `Participante`.

- [ ] **Step 2: Executar e confirmar vermelho**

Run: `npm test -- app/lib/registrations-csv.test.ts`

Expected: FAIL mostrando `Participante` em vez de `Nome`.

- [ ] **Step 3: Implementar o cabeçalho mínimo e confirmar verde**

Run: `npm test -- app/lib/registrations-csv.test.ts`

Expected: PASS.

- [ ] **Step 4: Criar componentes de escolha e resumo**

`ParticipantChoice` deve renderizar um `fieldset` com legenda `Selecione seu nome`, botões reais com altura mínima de 44 px e nome completo. `RegistrationSummary` deve listar título, instrutor, data e sala de cada inscrição e anunciar `Você pode escolher mais N Hands-on` quando `remaining > 0` ou `Você atingiu o limite de inscrições` quando zero.

- [ ] **Step 5: Atualizar a máquina de estados pública**

O envio inicial do e-mail trata `choose-participant`. A escolha do nome repete a elegibilidade com `{ email, participantId }`. Após confirmação, substituir a situação inteira com a resposta do servidor, limpar somente o Hands-on selecionado e manter a pessoa ativa. Mostrar oficinas enquanto `remaining > 0`; não encerrar o fluxo depois da primeira inscrição.

Adicionar ações `Trocar nome` quando houver candidatos compartilhados e `Consultar outro e-mail` no resumo final. Ambas limpam os estados dependentes corretos.

- [ ] **Step 6: Adicionar campo administrativo do limite**

No tipo `Dashboard.settings`, incluir `maxWorkshopsPerParticipant: number`. No bloco `Prazo e relatório`, adicionar input numérico mínimo 1 e máximo 100 e botão `Salvar limite`, usando a nova rota. Não misturar seu submit com o formulário da data.

- [ ] **Step 7: Estilizar smartphone e acessibilidade**

Adicionar classes focadas para lista de nomes, resumo e saldo. Verificar `:focus-visible`, áreas de toque, quebra de nomes longos, coluna única abaixo de 720 px e ausência de largura fixa que provoque rolagem horizontal.

- [ ] **Step 8: Atualizar teste renderizado**

Manter as asserções que proíbem horários e acrescentar conteúdo estável da etapa de identificação e do painel sem testar estrutura privada de React.

Run: `npm run test:render`

Expected: PASS com HTML servido pelo standalone.

- [ ] **Step 9: Executar lint, testes e build**

Run: `npm run lint`

Expected: exit 0 sem avisos.

Run: `npm test`

Expected: todos os testes passam.

Run: `DATABASE_PATH=/tmp/sit-shared-email-build.db npm run build`

Expected: exit 0 e `.next/standalone/server.js` presente.

- [ ] **Step 10: Commit**

```bash
git add app/components/ParticipantChoice.tsx app/components/RegistrationSummary.tsx app/components/PublicRegistration.tsx app/admin/page.tsx app/lib/registrations-csv.ts app/lib/registrations-csv.test.ts app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: add participant selection and registration summary"
```

---

### Task 5: Versão local de teste e validação final

**Files:**
- Create: `tests/fixtures/shared-email-participants.csv`
- Modify: `README.md`
- Modify: `docs/deploy-vps.md`
- Modify: `tests/deploy-e2e.mjs` se a validação final expuser somente lacunas de cobertura, sem mudar requisitos.

**Interfaces:**
- Produces: banco local separado, fixture reproduzível e instruções de avaliação sem tocar a VPS.
- Fixture: João Victor e Jonys Arcanjo em `arcanjocity@gmail.com`, mais pessoas suficientes para testar limite e concorrência.

- [ ] **Step 1: Criar fixture de avaliação**

Adicionar CSV UTF-8 com cabeçalho `Nome,E-mail`, dois nomes compartilhando o e-mail de exemplo, uma repetição exata deliberada e participantes com e-mails únicos. Documentar na primeira linha de comentário não é permitido porque viraria dado; explicar a repetição no README.

- [ ] **Step 2: Atualizar documentação local e futura operação**

No README, documentar seleção por nome, limite e comando para iniciar com banco isolado:

```bash
DATABASE_PATH=./data/shared-email-test.db npm run dev
```

Em `docs/deploy-vps.md`, acrescentar somente a preparação futura: backup obrigatório antes de atualizar uma VPS existente e verificação de contagens após migração. Não executar nem instruir deploy nesta etapa.

- [ ] **Step 3: Verificação automatizada final**

Run: `npm test`

Expected: todos os testes passam.

Run: `npm run lint`

Expected: exit 0.

Run: `npm run test:deploy-e2e`

Expected: health, login, configuração, importação compartilhada, escolha de nome, limites, capacidade, dashboard e exportação passam.

Run: `npm run test:render`

Expected: PASS e nenhum horário de Hands-on aparece.

Run: `npm audit --omit=dev`

Expected: 0 vulnerabilidades de produção.

Run: `docker build -t hands-on-sit-fortaleza-2026:shared-email-test .`

Expected: imagem construída e configurada com usuário `nextjs`.

- [ ] **Step 4: Validação visual em smartphone**

Iniciar a versão local no banco isolado e usar viewport 390 × 844. Importar a fixture pelo painel e comprovar:

- sem rolagem horizontal;
- e-mail compartilhado apresenta João Victor e Jonys Arcanjo;
- controles possuem pelo menos 44 px de altura;
- trocar nome não mistura inscrições;
- limite restante atualiza após cada confirmação;
- painel edita o máximo;
- download contém colunas separadas `Nome` e `E-mail`;
- nenhum horário é exibido.

- [ ] **Step 5: Revisão final e commit**

Revisar `git diff` contra a especificação, confirmar ausência de `.env`, bancos e credenciais no índice, e então:

```bash
git add tests/fixtures/shared-email-participants.csv README.md docs/deploy-vps.md
git commit -m "docs: add shared email test workflow"
```

Manter a branch local pronta para avaliação. Não mesclar, enviar ao GitHub nem atualizar a VPS sem autorização explícita.
