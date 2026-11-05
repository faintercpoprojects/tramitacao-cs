# Tramitação CS · UniCPO

Plataforma do time de CS para acompanhar a documentação dos alunos: **CPF, RNM e CRO**.
Substitui o uso direto da planilha `Tramitação.xlsx` (que continua funcionando, sincronizada).

## O que tem

- **Painel**: alunos em execução, leads, promessas, pagamentos pendentes, % de CPF/RNM/CRO concluídos, onde os processos estão parados (por etapa), próximas janelas de agendamento, renovações e países.
- **Alunos**: busca (nome, CPF, protocolo, telefone) e filtros (turma, país, status, pagamento, documento, etapa). Edição em lote ("marcar 15 alunos da ORTOT62 com GRUs pagos = OK"). Exportar para planilha (CSV).
- **Ficha do aluno**: as 31 etapas com lista de status colorida, dados do trâmite, observações, o mesmo aluno em outras turmas e histórico de quem mudou o quê.
- **Turmas**: progresso por turma e as janelas de agendamento (antiga aba "QT de alunos").
- **Agenda**: quem está pronto para agendar a Polícia Federal (antiga aba "Agendamentos da semana") e renovações de RNM.
- **Atualizações**: tudo que a equipe mudou, no site ou na planilha.
- **Equipe** (só administrador): convidar, mudar permissão, definir senha, remover.

## Regra de pendências (definida pelo time de CS em 05/11/2026)

**Leads não entram em nenhuma conta.** Só estas colunas da planilha decidem:

| Documento | Coluna | Concluído | Em execução (pendência) |
|---|---|---|---|
| CPF | U · Protocolo | tem o número do CPF (11 dígitos) | sem o número |
| RNM | AF · Agendamiento | OK | Pendiente |
| CRO | AT · Certificado enviado | OK | Pendiente |
| Formulários | AA (Protocolo RNM) + AD (Dec. pesquisa) + AE (Dec. ausencia) | AA com número e AD/AE OK | cada coluna Pendiente = 1 formulário pendente |

Aparece no Painel (bloco "Pendências" e tabela de próximos módulos), em Turmas, na Pesquisa e no filtro **Pendência** da lista de Alunos. Os chips de etapas (ex.: "CRO 3/14") continuam mostrando o detalhe das etapas.

Permissões: **Visualizador** (só vê/exporta) · **Editor** (altera) · **Administrador** (altera e cuida da equipe).

## Onde fica

- Banco e login: Supabase, projeto `tramitacao-cs` (ref `exoxsuandjekzhcmqeso`, São Paulo, plano grátis), org do guilhermesalina01.
- Site: arquivos estáticos (`index.html`, `app.js`, `style.css`, `config.js`).
- Rodar no computador: `node servir.mjs` → http://localhost:5060

## Arquivos

| Arquivo | Para quê |
|---|---|
| `supabase.sql` | Tabelas, regras de acesso, histórico, funções de sincronização. Pode rodar de novo. |
| `supabase/functions/equipe` | Função que convida/remove pessoas (só admin). |
| `importacao/limpar.cjs` | Lê o `.xlsx` original e padroniza (relatório em `importacao/saida/relatorio.md`). |
| `importacao/importar.cjs` | Envia os dados limpos ao banco (não duplica se rodar de novo). |
| `importacao/segredo.txt` | Chave de sincronização. **Não publicar** (está no `.gitignore`). |
| `planilha/sincronizar.gs` | Apps Script da planilha (sincronização nos dois sentidos). |
| `planilha/COMO-INSTALAR.md` | Passo a passo para ligar a planilha. |

## Padronização feita na importação (4/11/2026)

- 1.313 linhas de alunos (1.136 alunos diferentes; o mesmo aluno pode estar em mais de uma turma).
- Status unificados: "Stand by / Standby / Estand by / Standy!" → **Stand by**; "Executado / OK / Encerrado" → **Concluído**; "pendiente" → **Pendiente**; o "!" final foi removido.
- Países unificados (Colombia/Colômbia, Mexico/México, Equador/Ecuador, PERU…). Telefones que estavam na coluna País foram movidos.
- CPF, protocolo do RNM e data de nascimento que estavam escritos dentro das colunas de status viraram campos próprios, e a etapa ficou **OK**.
- CRO › RNM mantém o tipo: **RNM oficial / RNM provisório / Registro**.
- O que não deu para encaixar foi para **Observações** do aluno (15 linhas).
