# Docker VPS com SQLite — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a aplicação em uma imagem Docker executável na VPS Debian, com SQLite persistente, configuração segura e procedimentos verificáveis de deploy, atualização, backup e restauração.

**Architecture:** Migrar do runtime Cloudflare/vinext para Next.js nativo em Node.js 22, preservando as consultas existentes por meio de um adaptador compatível com a pequena superfície D1 usada pelas rotas. Empacotar o build standalone em Docker Compose, publicar a porta 80 e armazenar o arquivo SQLite em volume nomeado.

**Tech Stack:** Next.js 16.2.6, React 19.2.6, Node.js 22, TypeScript, Vitest, better-sqlite3, Docker e Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-20-docker-vps-sqlite-design.md`

## Global Constraints

- O servidor alvo é uma única VPS Debian acessível por SSH.
- O primeiro deploy usa `http://<IP_DA_VPS>` e publica a aplicação na porta 80.
- O processo da aplicação escuta em `0.0.0.0:3000` dentro do contêiner.
- O banco de produção fica em `/app/data/hands-on.db` dentro de um volume Docker persistente.
- O runtime mínimo é Node.js 22.13.0.
- Credenciais reais e o arquivo SQLite nunca entram no Git nem na imagem.
- A aplicação roda como usuário não-root.
- Não executar `docker compose down -v` nos procedimentos operacionais.
- Domínio, HTTPS, proxy reverso, escala horizontal e CI/CD permanecem fora do escopo.

## Review Focus

- Caminho de banco cujo diretório ainda não existe: criar o diretório antes de abrir o SQLite e falhar com mensagem clara se não houver permissão.
- Duas chamadas concorrentes tentando ocupar a última vaga: manter a inscrição condicional atômica e nunca ultrapassar a capacidade.
- Reinício ou recriação do contêiner: preservar participantes, configurações e inscrições no mesmo volume.
- `.env` incompleto: healthcheck deve distinguir banco saudável de autenticação não configurada, e o login deve continuar negado sem expor segredo.
- Falha no meio de `batch`: reverter todas as instruções da transação, inclusive as que já foram executadas.

---

### Task 1: Adaptador SQLite compatível com as consultas atuais

**Files:**
- Create: `db/database.ts`
- Create: `db/sqlite.ts`
- Create: `db/sqlite.test.ts`
- Modify: `vitest.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: SQL posicional com `?` e valores `string | number | null` usados pelas rotas existentes.
- Produces: `DatabaseBinding`, `PreparedQuery`, `createSqliteDatabase(databasePath: string): DatabaseBinding` e `close(): void`.

- [ ] **Step 1: Expandir a descoberta de testes e instalar as dependências de runtime**

Alterar `vitest.config.ts` para incluir `db/**/*.test.ts` e `tests/**/*.test.ts` além de `app/**/*.test.ts`. Executar:

```bash
npm install next@16.2.6 better-sqlite3
npm install --save-dev @types/better-sqlite3
```

Expected: `package.json` e `package-lock.json` registram Next.js e better-sqlite3 sem remover ainda o runtime anterior.

- [ ] **Step 2: Escrever os testes que definem o contrato do adaptador**

Criar `db/sqlite.test.ts` usando um diretório de `mkdtemp` e casos separados que provem:

```ts
const db = createSqliteDatabase(join(directory, "nested", "test.db"));
await db.prepare("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT UNIQUE)").run();
await db.prepare("INSERT INTO items (name) VALUES (?)").bind("Primeiro").run();
expect(await db.prepare("SELECT name FROM items WHERE id = ?").bind(1).first()).toEqual({ name: "Primeiro" });
expect((await db.prepare("SELECT name FROM items ORDER BY id").all()).results).toEqual([{ name: "Primeiro" }]);
```

Adicionar um caso de rollback: criar duas inserções com o mesmo valor único em `batch`, esperar rejeição e confirmar contagem zero. Adicionar um caso que fecha e reabre o mesmo caminho e confirma persistência.

- [ ] **Step 3: Executar o teste e observar a falha esperada**

Run: `npm test -- db/sqlite.test.ts`

Expected: FAIL porque `./sqlite` e as interfaces ainda não existem.

- [ ] **Step 4: Implementar a menor interface necessária**

Definir em `db/database.ts`:

```ts
export type SqlValue = string | number | bigint | Buffer | null;

export interface PreparedQuery {
  bind(...values: SqlValue[]): PreparedQuery;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: true; changes: number; lastRowId: number | bigint }>;
}

export interface DatabaseBinding {
  prepare(sql: string): PreparedQuery;
  batch(statements: PreparedQuery[]): Promise<unknown[]>;
  close(): void;
}
```

Implementar em `db/sqlite.ts` uma conexão `better-sqlite3`, criação recursiva do diretório, `foreign_keys = ON`, `journal_mode = WAL`, `busy_timeout = 5000`, prepared queries imutáveis e `batch` dentro de `database.transaction`. Não aceitar uma instrução de outro banco no mesmo lote.

- [ ] **Step 5: Executar o ciclo verde e a suíte completa**

Run: `npm test -- db/sqlite.test.ts`

Expected: PASS com os testes de leitura, escrita, persistência e rollback.

Run: `npm test`

Expected: todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts db/database.ts db/sqlite.ts db/sqlite.test.ts
git commit -m "feat: add persistent SQLite adapter"
```

---

### Task 2: Migrar o runtime da aplicação para Node e inicializar o banco

**Files:**
- Create: `app/lib/runtime.test.ts`
- Modify: `app/lib/runtime.ts`
- Modify: `db/index.ts`
- Modify: `next.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Delete: `worker/index.ts`
- Delete: `vite.config.ts`
- Delete: `build/sites-vite-plugin.ts`

**Interfaces:**
- Consumes: `createSqliteDatabase(databasePath)` e `DatabaseBinding` da Task 1.
- Produces: `appEnv(): AppEnv`, `ensureDatabase(db: DatabaseBinding): Promise<void>` e `resetAppEnvForTests(): void`.

- [ ] **Step 1: Escrever testes de inicialização e configuração**

Criar `app/lib/runtime.test.ts` com banco temporário e ambiente restaurado em `afterEach`. Os testes devem:

```ts
const db = createSqliteDatabase(databasePath);
await ensureDatabase(db);
await ensureDatabase(db);
expect((await db.prepare("SELECT title FROM workshops ORDER BY id").all()).results).toHaveLength(2);
expect(await db.prepare("SELECT id, registration_deadline FROM event_settings").first()).toEqual({ id: 1, registration_deadline: null });
```

Adicionar persistência: inserir participante, fechar, reabrir e confirmar a linha. Adicionar configuração: definir `DATABASE_PATH`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` e `SESSION_SECRET`, chamar `appEnv()` e conferir os valores e a presença do banco.

- [ ] **Step 2: Executar o teste e observar a falha esperada**

Run: `npm test -- app/lib/runtime.test.ts`

Expected: FAIL porque `runtime.ts` ainda importa `cloudflare:workers` e usa `D1Database`.

- [ ] **Step 3: Implementar o runtime Node mínimo**

Substituir o ambiente Cloudflare por `process.env` e conexão SQLite singleton por caminho. Em desenvolvimento, usar `DATABASE_PATH || "./data/hands-on.db"`; em produção, lançar erro quando `DATABASE_PATH` estiver vazio. Tipar `AppEnv.DB` como `DatabaseBinding`. Manter `json()` e toda a SQL de `ensureDatabase`, alterando apenas o tipo do banco.

Atualizar `db/index.ts` para expor a conexão do runtime ou removê-lo se continuar sem consumidores, sem deixar import de `cloudflare:workers` no projeto.

- [ ] **Step 4: Executar os testes e confirmar compatibilidade**

Run: `npm test -- app/lib/runtime.test.ts`

Expected: PASS.

Run: `npm test`

Expected: todos os testes existentes e novos passam.

- [ ] **Step 5: Trocar scripts e configuração para Next.js nativo**

Definir scripts:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run",
  "lint": "eslint . --ignore-pattern .next"
}
```

Definir `output: "standalone"` em `next.config.ts`. Remover dependências exclusivamente Cloudflare/vinext e os três arquivos listados para exclusão. Manter arquivos `.openai` fora do caminho de build, sem usá-los em produção.

- [ ] **Step 6: Verificar build e lint**

Run: `npm run lint`

Expected: exit 0 sem importações Cloudflare restantes no código ativo.

Run: `DATABASE_PATH=$(mktemp -d)/build.db npm run build`

Expected: exit 0 e criação de `.next/standalone/server.js`.

- [ ] **Step 7: Commit**

```bash
git add app/lib/runtime.ts app/lib/runtime.test.ts db/index.ts next.config.ts package.json package-lock.json worker/index.ts vite.config.ts build/sites-vite-plugin.ts
git commit -m "refactor: run application on Node with SQLite"
```

---

### Task 3: Healthcheck e teste HTTP ponta a ponta

**Files:**
- Create: `app/api/health/route.ts`
- Create: `app/api/health/route.test.ts`
- Create: `tests/deploy-e2e.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `appEnv().DB`, `ensureDatabase()` e endpoints HTTP existentes.
- Produces: `GET /api/health` com `{ status: "ok", database: "ok" }` e script `npm run test:deploy-e2e`.

- [ ] **Step 1: Escrever o teste de saúde antes da rota**

Criar `app/api/health/route.test.ts`, apontar `DATABASE_PATH` para diretório temporário, resetar o runtime e chamar `GET()` diretamente. Exigir status 200, cabeçalho `cache-control: no-store` e corpo:

```json
{ "status": "ok", "database": "ok" }
```

- [ ] **Step 2: Executar o teste e observar a falha esperada**

Run: `npm test -- app/api/health/route.test.ts`

Expected: FAIL porque `app/api/health/route.ts` não existe.

- [ ] **Step 3: Implementar a rota de saúde**

A rota deve inicializar o esquema, executar `SELECT 1 AS ok` e retornar 200 somente quando o resultado for `1`. Erros devem retornar status 503 com `{ status: "error", database: "unavailable" }`, sem incluir caminho, SQL ou mensagem interna.

- [ ] **Step 4: Executar teste da rota e suíte completa**

Run: `npm test -- app/api/health/route.test.ts`

Expected: PASS para banco saudável e para caso de falha controlada.

Run: `npm test`

Expected: todos os testes passam.

- [ ] **Step 5: Escrever o teste HTTP do deploy**

Criar `tests/deploy-e2e.mjs` usando somente módulos Node. O script deve iniciar `.next/standalone/server.js` em porta efêmera com banco temporário e credenciais de teste; aguardar `/api/health`; então verificar, por HTTP real:

1. health 200;
2. login administrativo e recebimento do cookie `sit_admin`;
3. atualização da data final com cookie;
4. importação CSV de um participante com cookie;
5. consulta de elegibilidade pública;
6. inscrição desse participante no primeiro Hands-on;
7. dashboard mostrando uma inscrição;
8. exportação CSV contendo nome, e-mail e Hands-on.

Adicionar um cenário concorrente separado: criar dois participantes e um Hands-on com capacidade 1, disparar duas inscrições com `Promise.all`, exigir uma resposta 201, uma resposta 409 e contagem final exatamente 1. Executar também o healthcheck sem variáveis administrativas e confirmar banco saudável enquanto o login retorna 401.

O `finally` deve encerrar o processo filho e remover o diretório temporário. Adicionar `"test:deploy-e2e": "npm run build && node tests/deploy-e2e.mjs"`.

- [ ] **Step 6: Executar o teste HTTP e corrigir somente incompatibilidades comprovadas**

Run: `npm run test:deploy-e2e`

Expected: exit 0 com todas as oito etapas confirmadas.

- [ ] **Step 7: Commit**

```bash
git add app/api/health/route.ts app/api/health/route.test.ts tests/deploy-e2e.mjs package.json
git commit -m "test: cover production HTTP workflow"
```

---

### Task 4: Empacotar Docker e provar persistência do volume

**Files:**
- Create: `.dockerignore`
- Create: `Dockerfile`
- Create: `compose.yaml`
- Create: `tests/docker-config.test.ts`
- Modify: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `.next/standalone/server.js`, `/api/health` e variáveis descritas na especificação.
- Produces: serviço Compose `app`, volume nomeado `hands_on_data` e porta pública 80.

- [ ] **Step 1: Escrever o teste estático da configuração Docker**

Criar `tests/docker-config.test.ts` para ler os três arquivos esperados e exigir:

- `Dockerfile` com estágios `deps`, `builder` e `runner`, base Node 22, `USER nextjs` e `CMD ["node", "server.js"]`;
- `.dockerignore` com `.env`, `node_modules`, `.next`, `data` e `*.db*`;
- `compose.yaml` com `80:3000`, `DATABASE_PATH=/app/data/hands-on.db`, volume em `/app/data`, `restart: unless-stopped` e healthcheck em `/api/health`.

- [ ] **Step 2: Executar o teste e observar a falha esperada**

Run: `npm test -- tests/docker-config.test.ts`

Expected: FAIL porque os arquivos Docker ainda não existem.

- [ ] **Step 3: Criar a imagem multiestágio e o Compose**

O `Dockerfile` deve usar `node:22-bookworm-slim`, `npm ci`, `npm run build`, copiar `.next/standalone`, `.next/static` e `public`, criar `/app/data`, atribuir o diretório ao usuário `nextjs` e iniciar `server.js`.

O `compose.yaml` deve carregar `.env`, publicar `80:3000`, montar `hands_on_data:/app/data`, configurar `HOSTNAME`, `PORT` e `DATABASE_PATH`, reiniciar salvo parada explícita e testar `http://127.0.0.1:3000/api/health` com Node dentro do contêiner.

Atualizar `.env.example` com `DATABASE_PATH=/app/data/hands-on.db`, `HOSTNAME=0.0.0.0` e `PORT=3000`. Garantir que `.gitignore` exclua `data/` e `*.db*`.

- [ ] **Step 4: Executar teste estático, build e inspeção Compose**

Run: `npm test -- tests/docker-config.test.ts`

Expected: PASS.

Run: `docker compose config`

Expected: exit 0, sem valor de segredo impresso quando o comando usa um `.env` temporário de teste.

Run: `docker build -t hands-on-sit-fortaleza-2026:test .`

Expected: exit 0.

- [ ] **Step 5: Provar saúde e persistência em contêiner**

Subir o Compose com credenciais de teste e porta alternativa se a porta 80 local estiver ocupada. Importar um participante pela API, reiniciar ou recriar somente o serviço sem remover o volume, e confirmar pelo endpoint administrativo que o participante continua presente.

Run: `docker compose up -d --build && docker compose ps`

Expected: serviço `app` com status `healthy`.

Run: `docker compose restart app && docker compose ps`

Expected: o serviço volta a `healthy` e os dados permanecem.

- [ ] **Step 6: Commit**

```bash
git add .dockerignore Dockerfile compose.yaml tests/docker-config.test.ts .env.example .gitignore
git commit -m "feat: package application for Docker VPS"
```

---

### Task 5: Manual operacional, verificação final e preparação para envio

**Files:**
- Modify: `README.md`
- Create: `docs/deploy-vps.md`

**Interfaces:**
- Consumes: repositório público, `compose.yaml`, volume `hands_on_data` e VPS Debian.
- Produces: comandos completos de instalação, deploy, atualização, logs, backup, verificação e restauração.

- [ ] **Step 1: Atualizar a documentação local e escrever o runbook**

Atualizar o README para declarar Next.js/SQLite e apontar para `docs/deploy-vps.md`. O runbook deve conter, em ordem:

1. instalação oficial do Docker Engine e plugin Compose no Debian;
2. clone de `https://github.com/JonysArcanjo/hands-on-sit-fortaleza-2026.git`;
3. geração de `ADMIN_PASSWORD_HASH` e `SESSION_SECRET` sem registrar os valores no histórico;
4. criação de `.env` com permissão `600`;
5. `docker compose up -d --build`;
6. verificação por `docker compose ps`, logs e `/api/health`;
7. teste por `http://152.239.118.120`;
8. atualização via `git pull --ff-only` e rebuild;
9. backup consistente e restauração com aplicação parada;
10. diagnóstico de porta, permissão de volume e healthcheck.

Incluir avisos destacados para nunca publicar `.env`, nunca copiar a chave privada e nunca usar `docker compose down -v`.

- [ ] **Step 2: Executar toda a verificação fresca**

Run: `npm test`

Expected: todos os testes passam, sem falhas ou testes ignorados inesperados.

Run: `npm run lint`

Expected: exit 0.

Run: `npm run build`

Expected: exit 0 e artefato standalone presente.

Run: `npm run test:deploy-e2e`

Expected: exit 0 cobrindo saúde, autenticação, configuração, importação, inscrição, dashboard e exportação.

Run: `npm run test:render`

Expected: exit 0 e HTML público sem horários de Hands-on.

Run: `docker build -t hands-on-sit-fortaleza-2026:test .`

Expected: exit 0.

Run: `git diff --check && git status --short`

Expected: sem erros de whitespace; somente README e runbook pendentes antes do commit final.

- [ ] **Step 3: Revisar segurança e requisitos linha a linha**

Confirmar por inspeção que `.env`, `*.db`, chave SSH e credenciais reais não estão rastreados; que o contêiner final usa usuário não-root; que o volume não é removido; e que nenhum horário de Hands-on foi adicionado à interface pública. Abrir as páginas pública e administrativa em viewport 390 × 844, confirmar ausência de rolagem horizontal e operação dos botões e formulários por toque.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/deploy-vps.md
git commit -m "docs: add VPS deployment runbook"
```

- [ ] **Step 5: Revisão integral antes do push**

Gerar o pacote de revisão de toda a faixa de commits, verificar achados críticos/importantes, executar uma única rodada de correções com teste vermelho-verde quando necessário e repetir a verificação completa. O push para `origin/main` exige autorização explícita por ser efeito externo.
