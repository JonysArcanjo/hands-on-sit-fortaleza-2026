# Hands-on SAP Inside Track Fortaleza 2026

Aplicação responsiva, otimizada para smartphones, para participantes previamente cadastrados escolherem seus Hands-on. Inclui validação por e-mail e nome, limite configurável de inscrições, controle de vagas e painel administrativo para importação de participantes, programação e inscrições.

## Desenvolvimento

Requer Node.js 22.13 ou superior.

```bash
npm install
npm run dev
npm test
npm run build
```

O desenvolvimento local usa Next.js com SQLite em `./data/hands-on.db`, salvo quando `DATABASE_PATH` for informado.

### Versão local isolada para avaliação

Para avaliar a seleção de nomes sem alterar o banco local principal, inicie a aplicação com outro arquivo SQLite:

```bash
DATABASE_PATH=./data/shared-email-test.db npm run dev
```

Use `tests/fixtures/shared-email-participants.csv` no painel administrativo. A fixture contém João Victor e Jonys Arcanjo com o mesmo e-mail (`arcanjocity@gmail.com`), além de uma repetição deliberada de Jonys com variações de espaços e maiúsculas. A importação deve manter os dois nomes e contabilizar essa repetição como duplicada.

## Configuração administrativa

Defina as seguintes variáveis no ambiente de implantação:

- `ADMIN_EMAIL`: e-mail do administrador.
- `ADMIN_PASSWORD_HASH`: SHA-256 hexadecimal da senha.
- `SESSION_SECRET`: segredo aleatório longo para assinar sessões.

Para gerar o hash da senha:

```bash
printf '%s' 'sua-senha' | shasum -a 256
```

## Importação

O painel aceita arquivos CSV e XLSX de até 5 MB. A primeira planilha deve conter as colunas `Nome` e `E-mail`. Cabeçalhos ignoram acentos, espaços, hífens e diferenças entre maiúsculas e minúsculas. Um mesmo e-mail pode pertencer a mais de um nome; na inscrição, o participante digita somente o e-mail e escolhe seu nome entre os resultados. A identidade e o limite de Hands-on são controlados pela combinação normalizada de e-mail e nome.

O painel também permite configurar o número máximo de Hands-on por participante. O valor inicial é 1. O relatório CSV usa uma linha por inscrição e colunas separadas `Nome` e `E-mail`.

## Persistência

O site usa SQLite. O esquema é criado de forma idempotente na primeira requisição; os dois Hands-on padrão são inseridos somente quando a tabela está vazia. Participantes reais entram apenas pela importação.

No Docker, o arquivo fica em `/app/data/hands-on.db`, dentro do volume nomeado `hands_on_data`, e sobrevive à recriação do contêiner.

## Deploy em VPS

O procedimento completo para Debian, Docker Compose, acesso pelo IP, atualização, logs, backup e restauração está em [docs/deploy-vps.md](docs/deploy-vps.md).

Resumo após configurar o `.env`:

```bash
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1/api/health
```

Nunca execute `docker compose down -v` no servidor: a opção `-v` remove o volume que contém participantes e inscrições.
