# Deploy em VPS com Docker e SQLite

## Objetivo

Executar o site Hands-on SAP Inside Track Fortaleza 2026 em uma única VPS, acessível inicialmente pelo IP público, com dados persistentes em SQLite e operação simples pela organização. O deploy deve preservar os fluxos públicos e administrativos existentes, sobreviver a reinícios do contêiner e permitir atualização e backup sem depender de serviços externos.

## Contexto e restrições

- O servidor é uma VPS Debian acessível por SSH.
- O acesso inicial será por `http://<IP_DA_VPS>`; domínio e HTTPS ficam fora deste primeiro deploy.
- A aplicação continuará sendo usada principalmente por smartphones.
- Participantes, Hands-on, inscrições e data final de inscrição precisam persistir após reinícios e atualizações.
- Credenciais administrativas não podem fazer parte da imagem Docker nem do repositório Git.
- A solução deve usar um único processo de aplicação e um único arquivo SQLite. Escala horizontal não faz parte deste escopo.
- O banco deve ficar em um volume Docker persistente e ser fácil de copiar para backup.

## Abordagens consideradas

### 1. Next.js nativo com adaptador SQLite compatível

Trocar o runtime Cloudflare/vinext pelo servidor Node do Next.js e fornecer uma pequena camada que mantenha a interface de banco já usada pelas rotas (`prepare`, `bind`, `first`, `all`, `run` e `batch`). Essa opção limita a mudança nas rotas existentes e permite usar um arquivo SQLite local.

É a abordagem escolhida porque reduz a superfície de regressão, produz uma imagem Docker convencional e elimina a dependência do D1 na VPS.

### 2. Reescrever todas as rotas com Drizzle e SQLite

Cada endpoint passaria a usar consultas Drizzle diretamente. O resultado seria mais tipado, mas exigiria reescrever e retestar todas as consultas e fluxos agora, aumentando o risco antes do evento.

### 3. Manter o runtime Cloudflare e emular D1 no servidor

Executar Wrangler/Miniflare em produção manteria o código quase intacto, mas levaria ferramentas de desenvolvimento e emulação para a VPS, tornando operação, observabilidade e backup menos previsíveis.

## Arquitetura

O contêiner executará Next.js em modo `standalone` sobre Node.js 22. A aplicação escutará em `0.0.0.0:3000`, enquanto o Docker Compose publicará a porta 80 da VPS.

Um adaptador SQLite local implementará somente a superfície D1 atualmente consumida pela aplicação. Ele abrirá o arquivo definido por `DATABASE_PATH`, habilitará chaves estrangeiras, `WAL` e tempo de espera para bloqueios. A inicialização existente continuará responsável por criar as tabelas, índices, configuração singleton e Hands-on padrão quando o banco estiver vazio.

O arquivo ficará, por padrão, em `/app/data/hands-on.db`. O Compose montará um volume nomeado nesse diretório. A imagem poderá ser substituída sem apagar o volume.

## Componentes e responsabilidades

### Runtime da aplicação

- `next.config.ts` habilitará a saída `standalone`.
- Os scripts `dev`, `build` e `start` usarão o Next.js nativo.
- Dependências exclusivas de Cloudflare/vinext serão removidas do caminho de produção.
- O servidor será explicitamente Node.js; execução em Edge Runtime não será suportada.

### Persistência SQLite

- Um módulo isolado abrirá uma única conexão por processo e exporá a interface de consultas esperada pelas rotas.
- `prepare(sql).bind(...values)` retornará um comando imutável com parâmetros próprios.
- `first<T>()` retornará a primeira linha ou `null`.
- `all<T>()` retornará `{ results: T[] }`, preservando o contrato atual.
- `run()` executará a instrução e retornará metadados mínimos compatíveis.
- `batch(statements)` executará todas as instruções em uma transação, revertendo tudo em caso de falha.
- `DATABASE_PATH` será obrigatório em produção e terá um padrão local seguro apenas no desenvolvimento.

### Inicialização e integridade

- A criação idempotente do esquema acontecerá antes das consultas que já chamam `ensureDatabase`.
- A conexão habilitará `PRAGMA foreign_keys = ON`, `journal_mode = WAL` e `busy_timeout`.
- A inscrição continuará usando uma única instrução condicional para respeitar a capacidade. A unicidade por participante continuará protegida por índice no banco.
- Um endpoint de saúde verificará processo e banco, retornando falha quando o SQLite não puder ser aberto ou consultado.

### Empacotamento e execução

- `Dockerfile` multiestágio instalará dependências, executará o build e copiará somente o artefato standalone, arquivos estáticos e dependências nativas necessárias.
- O processo final rodará como usuário não-root.
- `.dockerignore` excluirá dependências locais, builds, banco, credenciais e arquivos de desenvolvimento.
- `compose.yaml` publicará `80:3000`, montará o volume SQLite, carregará `.env` local e usará política `restart: unless-stopped`.
- Um `healthcheck` consultará o endpoint de saúde.

## Configuração e segredos

O deploy usará as seguintes variáveis:

- `ADMIN_EMAIL`: e-mail autorizado a entrar no painel.
- `ADMIN_PASSWORD_HASH`: SHA-256 hexadecimal da senha administrativa.
- `SESSION_SECRET`: segredo aleatório longo para assinatura da sessão.
- `DATABASE_PATH`: caminho do SQLite, em produção `/app/data/hands-on.db`.
- `HOSTNAME`: `0.0.0.0` dentro do contêiner.
- `PORT`: `3000` dentro do contêiner.

O repositório conterá somente `.env.example`. O arquivo `.env` real será criado diretamente na VPS, terá permissão restrita e permanecerá ignorado pelo Git.

## Fluxo de deploy

1. As mudanças validadas são enviadas à branch `main` no GitHub.
2. Na VPS, a organização instala Docker e o plugin Compose.
3. O repositório público é clonado e o `.env` é criado localmente.
4. `docker compose up -d --build` monta a imagem, cria o volume e inicia a aplicação.
5. A saúde é confirmada localmente e pelo IP público.
6. O fluxo público e o painel administrativo são testados em viewport de smartphone.

Atualizações futuras usarão `git pull` e `docker compose up -d --build`. O volume não será removido durante atualizações.

## Backup e restauração

O README documentará comandos para:

- parar brevemente a aplicação ou executar checkpoint antes da cópia;
- copiar o banco do volume para um arquivo datado fora do volume;
- verificar que o arquivo de backup existe e tem tamanho não zero;
- restaurar somente com a aplicação parada e mantendo uma cópia do banco substituído.

Nenhum comando operacional usará `docker compose down -v`, pois isso removeria o volume de dados.

## Tratamento de erros

- Configuração administrativa ausente continuará impedindo autenticação e produzirá erro explícito no servidor.
- Caminho do banco inválido ou sem permissão fará o healthcheck falhar e será visível nos logs do contêiner.
- Falhas de migração/inicialização não serão ocultadas; a requisição falhará sem continuar com estado parcial.
- Transações em lote serão revertidas integralmente quando qualquer instrução falhar.
- Conflitos de inscrição continuarão retornando as mensagens de negócio existentes, sem expor detalhes do SQLite.

## Segurança inicial

- Somente as portas SSH e HTTP precisam ficar abertas.
- A chave privada SSH permanece exclusivamente no Mac do responsável.
- O contêiner não conterá o arquivo `.env` nem o banco na imagem.
- Cookies continuarão `HttpOnly` e `SameSite=Lax`. Sem HTTPS, eles não receberão `Secure`; essa limitação é aceita apenas para a fase inicial por IP.
- O painel deve receber uma senha forte mesmo durante a fase por IP.
- Domínio, TLS, proxy reverso, rate limiting e endurecimento adicional serão uma etapa posterior, antes de uso prolongado em produção.

## Testes e critérios de aceite

- Testes unitários do adaptador cobrirão `bind`, leitura de primeira linha, lista de resultados, escrita e rollback de lote.
- Testes de integração usarão um banco temporário para validar criação idempotente, dados padrão e persistência após reabrir a conexão.
- A suíte funcional existente deverá permanecer verde.
- Lint e build de produção deverão concluir sem erros.
- A imagem Docker deverá ser construída com sucesso.
- O contêiner deverá iniciar com volume vazio, responder saudável e manter dados após reinício/recriação.
- Um teste ponta a ponta deverá cobrir login administrativo, alteração da data final, importação ou criação de dados de teste, inscrição pública e exportação por Hands-on.
- A interface pública e administrativa deverá permanecer utilizável em largura de smartphone.

## Fora de escopo

- Domínio e certificado HTTPS.
- Proxy reverso dedicado.
- Banco remoto ou replicação.
- Múltiplas instâncias simultâneas da aplicação.
- Pipeline automático de CI/CD.
- Monitoramento externo e alertas.
