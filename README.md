# Hands-on SAP Inside Track Fortaleza 2026

Aplicação responsiva para participantes previamente inscritos escolherem um único Hands-on. Inclui validação por e-mail, controle de vagas e painel administrativo para importação de participantes, programação e inscrições.

## Desenvolvimento

Requer Node.js 22.13 ou superior.

```bash
npm install
npm run dev
npm test
npm run build
```

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

O painel aceita arquivos CSV e XLSX de até 5 MB. A primeira planilha deve conter as colunas `Nome` e `E-mail`. Cabeçalhos ignoram acentos, espaços, hífens e diferenças entre maiúsculas e minúsculas. O e-mail é normalizado e funciona como identificador único.

## Persistência

O site usa a vinculação D1 `DB`. Migrações ficam em `drizzle/`; três Hands-on demonstrativos são inseridos quando o banco está vazio. Participantes reais entram apenas pela importação.
