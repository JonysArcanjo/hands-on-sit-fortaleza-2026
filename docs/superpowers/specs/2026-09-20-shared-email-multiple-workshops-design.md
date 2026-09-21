# E-mail compartilhado e limite de Hands-on por participante

## Objetivo

Permitir que várias pessoas previamente cadastradas usem o mesmo e-mail sem perder a identidade individual. No site público, o participante informa somente o e-mail e, quando houver mais de um nome associado, escolhe o próprio nome antes de selecionar os Hands-on.

Cada nome mantém inscrições independentes. A organização define no painel administrativo o número máximo de Hands-on permitido por participante. A primeira versão será executada e validada localmente, com banco de teste separado; a VPS de produção não será alterada até nova aprovação explícita.

## Regras funcionais

- A identidade de um participante é a combinação normalizada `e-mail + nome`.
- Nomes diferentes podem compartilhar o mesmo e-mail.
- Uma repetição da mesma combinação de e-mail e nome não cria outra pessoa.
- O participante digita apenas o e-mail no site público.
- Se o e-mail estiver ligado a um único nome, esse nome é selecionado automaticamente.
- Se estiver ligado a vários nomes, o site exibe as opções e exige a escolha de uma delas.
- Cada nome possui sua própria lista de inscrições e seu próprio consumo do limite.
- A mesma pessoa não pode se inscrever duas vezes no mesmo Hands-on.
- O limite máximo é global, inteiro, maior ou igual a 1 e editável no painel administrativo.
- O valor inicial do limite é 1, preservando o comportamento atual até que a organização o altere.
- Alterar o limite não remove inscrições existentes. Se o novo valor ficar abaixo da quantidade já inscrita, a pessoa conserva as inscrições e não pode criar outras.
- Prazo de inscrição, estado do Hands-on e disponibilidade de vagas continuam sendo validados normalmente.

## Fluxo público

1. A pessoa informa o e-mail.
2. O servidor normaliza o e-mail e localiza todos os participantes associados.
3. Nenhum nome encontrado mantém a mensagem atual de e-mail não localizado.
4. Um único nome segue automaticamente para a situação do participante.
5. Vários nomes exibem botões ou cartões com os nomes cadastrados, adequados para toque em smartphone.
6. Depois da seleção, o servidor confere que o identificador escolhido realmente pertence ao e-mail informado.
7. A tela apresenta as inscrições atuais, o limite total e quantas inscrições ainda podem ser feitas.
8. Os Hands-on nos quais a pessoa já está inscrita não podem ser escolhidos novamente.
9. Enquanto houver limite e vagas, a pessoa pode confirmar outro Hands-on.
10. Ao alcançar o limite, a tela conserva o resumo das inscrições e explica que não é possível incluir outra.
11. A opção de consultar outro e-mail limpa também o nome selecionado e as escolhas anteriores.

## Painel administrativo

O bloco atual de configurações passa a conter o campo `Máximo de Hands-on por participante`, próximo à data final das inscrições. O valor é persistido no SQLite e continua editável após o deploy.

A mensagem da importação informa separadamente quantos registros foram criados, atualizados, rejeitados, ignorados e identificados como repetição exata dentro do arquivo. Nomes distintos ligados ao mesmo e-mail contam como participantes distintos.

## Importação

- CSV e XLSX continuam usando as colunas `Nome` e `E-mail`.
- Nome tem espaços externos e sequências internas normalizados; e-mail é convertido para minúsculas e tem espaços externos removidos.
- A comparação de nomes para evitar duplicação ignora diferença entre letras maiúsculas e minúsculas.
- Uma combinação já existente é atualizada sem alterar seu identificador, preservando inscrições.
- Um novo nome com e-mail existente cria um novo participante.
- Linhas vazias e dados inválidos continuam sendo reportados sem impedir a importação das linhas válidas.

## Download de inscritos

O CSV administrativo contém uma linha para cada inscrição e mantém os dados pessoais em colunas distintas, com os cabeçalhos:

1. `Hands-on`
2. `Nome`
3. `E-mail`
4. `Data da inscrição`

Se uma pessoa estiver inscrita em dois Hands-on, ela aparece em duas linhas. Nome e e-mail nunca são combinados em uma única coluna.

## Modelo de dados e migração

### Participantes

A restrição de unicidade exclusiva do campo `email` será substituída por um índice único composto por `email` e `name` com comparação de nome sem distinção entre maiúsculas e minúsculas. Os identificadores existentes serão preservados.

### Inscrições

A unicidade atual somente por `participant_id` será removida. Permanecerá uma restrição única composta por `participant_id + workshop_id`, permitindo várias inscrições da mesma pessoa, mas nunca duas no mesmo Hands-on.

### Configuração

`event_settings` receberá `max_workshops_per_participant`, obrigatório e com padrão 1.

### Estratégia de migração

O início da aplicação executará uma migração idempotente e versionada. Como o SQLite não remove restrições inline diretamente, a migração reconstruirá as tabelas afetadas dentro de uma transação, copiará os dados preservando IDs e referências, recriará os índices e validará integridade e contagens antes de concluir.

O deploy futuro na VPS exigirá backup consistente do banco antes da atualização. Falha em qualquer etapa da migração causa rollback e impede o serviço de operar sobre um esquema parcialmente migrado.

## Contratos de API

`POST /api/eligibility` recebe `email` e, opcionalmente, `participantId`.

- Sem `participantId`, retorna a lista de nomes associados ao e-mail.
- Com um único nome, pode devolver diretamente a situação completa desse participante.
- Com vários nomes e sem seleção, retorna `kind: "choose-participant"` e candidatos contendo somente `id` e `name`.
- Com `participantId`, valida a associação ao e-mail e retorna inscrições atuais, limite, quantidade restante e Hands-on disponíveis.

`POST /api/register` passa a receber `email`, `participantId` e `workshopId`. O servidor valida novamente a associação e executa a inclusão de forma atômica, considerando:

- prazo aberto;
- participante existente e ligado ao e-mail;
- Hands-on ativo;
- ausência da mesma combinação participante/Hands-on;
- quantidade atual abaixo do limite administrativo;
- vaga disponível.

A resposta de sucesso contém a inscrição criada e a situação atualizada do participante, permitindo que a interface ofereça outro Hands-on sem reiniciar o fluxo.

## Concorrência e integridade

A decisão final acontece no servidor e na mesma operação protegida que grava a inscrição. Duas solicitações simultâneas não podem ultrapassar nem a capacidade do Hands-on nem o limite pessoal. Restrições únicas continuam sendo a última defesa contra repetição.

## Segurança e privacidade

O fluxo mantém o modelo atual de identificação por conhecimento do e-mail. A lista retornada expõe somente os nomes vinculados ao e-mail informado, sem revelar outros e-mails. Toda tentativa de seleção e inscrição revalida no servidor a relação entre e-mail e participante; não se confia apenas no identificador enviado pelo navegador.

## Interface responsiva

As opções de nome serão apresentadas como controles com área de toque de pelo menos 44 px, foco visível e texto completo. O resumo de limite e inscrições deve caber em uma única coluna no smartphone, sem rolagem horizontal. O site continua sem informar horário dos Hands-on.

## Testes e aceitação

A versão local será considerada pronta para avaliação quando comprovar:

- migração de um banco no esquema atual sem perda de participantes, inscrições ou configurações;
- importação de dois nomes com o mesmo e-mail e deduplicação da repetição exata;
- retorno e seleção de múltiplos nomes por e-mail;
- seleção automática quando houver um único nome;
- inscrições independentes para pessoas que compartilham o e-mail;
- várias inscrições para a mesma pessoa até o limite;
- bloqueio atômico acima do limite e de repetição no mesmo Hands-on;
- manutenção das regras de prazo, atividade e capacidade;
- edição do limite no painel;
- CSV com `Nome` e `E-mail` em colunas separadas;
- fluxo ponta a ponta e inspeção em viewport de smartphone;
- build de produção e testes existentes sem regressão.

## Fora do escopo desta versão

- envio de códigos por e-mail;
- criação pública de participantes;
- limites diferentes por pessoa;
- alteração ou cancelamento público de inscrições;
- deploy automático na VPS antes da aprovação da versão local.
