# Correção da data do evento — Design

## Objetivo

Atualizar o Hands-on SAP Inside Track Fortaleza 2026 para a data correta: **31 de outubro de 2026**.

## Escopo aprovado

- Substituir o destaque público `19 SET` por `31 OUT`.
- Alterar os três Hands-on iniciais de `2026-09-19` para `2026-10-31`.
- Não informar horários dos Hands-on em nenhuma interface.
- Remover o horário dos cards, da confirmação, das tabelas administrativas e do formulário de gestão.
- Tratar o campo persistido como data operacional para compatibilidade com o esquema atual, sem apresentá-lo como data/hora.
- Atualizar o card social para mostrar `31 OUT · FORTALEZA, CE`.
- Garantir por teste de renderização que a nova data aparece e a referência antiga não aparece.

## Arquitetura e dados

A mudança não altera rotas, esquema do banco, autenticação ou regras de inscrição. O campo `starts_at` será preservado para compatibilidade, recebendo a data do evento sem significado de horário. A interface pública e a administrativa passam a tratar esse valor somente como data.

## Compatibilidade com bancos existentes

O seed é executado apenas quando a tabela de Hands-on está vazia. Portanto, a mudança corrige novas instalações. Dados já cadastrados no painel continuam sob controle da organização e não serão sobrescritos automaticamente.

## Verificação

- Teste de renderização falha antes da correção e passa depois.
- Testes garantem que nenhuma interface apresenta horário dos Hands-on.
- Testes de domínio, lint, TypeScript e build de produção permanecem aprovados.
- Busca final confirma que `19 SET` e `2026-09-19` não permanecem no produto.
