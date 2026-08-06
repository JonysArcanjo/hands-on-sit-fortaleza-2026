# Correção da data do evento — Design

## Objetivo

Atualizar o Hands-on SAP Inside Track Fortaleza 2026 para a data correta: **31 de outubro de 2026**.

## Escopo aprovado

- Substituir o destaque público `19 SET` por `31 OUT`.
- Alterar os três Hands-on iniciais de `2026-09-19` para `2026-10-31`.
- Preservar os horários atuais: duas sessões às 10h30 e uma sessão às 14h, no fuso `America/Fortaleza`.
- Atualizar o card social para mostrar `31 OUT · FORTALEZA, CE`.
- Garantir por teste de renderização que a nova data aparece e a referência antiga não aparece.

## Arquitetura e dados

A mudança não altera rotas, esquema do banco, autenticação ou regras de inscrição. Somente o conteúdo da interface, as datas dos registros demonstrativos e o ativo social serão atualizados.

## Compatibilidade com bancos existentes

O seed é executado apenas quando a tabela de Hands-on está vazia. Portanto, a mudança corrige novas instalações. Dados já cadastrados no painel continuam sob controle da organização e não serão sobrescritos automaticamente.

## Verificação

- Teste de renderização falha antes da correção e passa depois.
- Testes de domínio, lint, TypeScript e build de produção permanecem aprovados.
- Busca final confirma que `19 SET` e `2026-09-19` não permanecem no produto.
