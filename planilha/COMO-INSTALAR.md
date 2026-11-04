# Ligar a planilha à plataforma (sincronização nos dois sentidos)

Quem faz: o dono da planilha (hoje `unicpo.cs@gmail.com`). Leva uns 10 minutos, uma vez só.

## 1. Transformar o Excel em Planilha Google

A planilha hoje é um arquivo `.xlsx` no Drive. O Apps Script só funciona em Planilha Google.

1. Abra `Tramitação.xlsx` no Drive.
2. **Arquivo → Salvar como Planilhas Google.** Isso cria uma cópia nova.
3. A partir daí, o time passa a usar **só a cópia nova**. Avise o time e tire o `.xlsx` antigo de circulação (mova para uma pasta "antigo").

> Importante: não reorganize nem apague linhas da aba **Trâmites** antes do passo 3. A primeira ligação é feita pelo nome do aluno + turma.

## 2. Colar o script

1. Na planilha nova: **Extensões → Apps Script**.
2. Apague o que estiver no `Código.gs` e cole todo o conteúdo de `planilha/sincronizar.gs`.
3. Salve (ícone de disquete).

## 3. Colocar as chaves

No Apps Script: **Configurações do projeto** (engrenagem) → **Propriedades do script** → **Adicionar propriedade**:

| Propriedade     | Valor                                                 |
|-----------------|-------------------------------------------------------|
| `SUPABASE_URL`  | `https://exoxsuandjekzhcmqeso.supabase.co`            |
| `SUPABASE_KEY`  | `sb_publishable_AograzVEZL3XFnDKMgIZHA_hU401aYp`      |
| `CHAVE_SYNC`    | a chave do arquivo `importacao/segredo.txt` (no computador do Guilherme). Não mande por e-mail nem WhatsApp. |

## 4. Instalar

1. No editor, escolha a função **`instalar`** no menu do topo e clique em **Executar**.
2. O Google pede autorização (ver/editar a planilha, acessar serviço externo, rodar em segundo plano). Aceite com a conta dona da planilha.
3. No fim aparece um aviso na planilha: "N linhas ligadas à plataforma".

O que o `instalar` faz:
- cria a coluna **AU – "ID plataforma (não apagar)"**, que liga cada linha ao aluno na plataforma;
- liga a edição da planilha ao envio imediato para a plataforma;
- puxa, a cada 5 minutos, o que o time mudou na plataforma;
- coloca listas suspensas nas colunas de status.

## Como funciona no dia a dia

- **Editou na planilha** → vai para a plataforma na hora (aparece no histórico como "nome (planilha)").
- **Editou na plataforma** → aparece na planilha em até 5 minutos.
- **Aluno novo na planilha** → basta preencher a linha (com nome). Ele ganha um ID e aparece na plataforma.
- **Aluno novo na plataforma** → aparece no fim da aba Trâmites.
- Se as duas pessoas mexerem na **mesma linha** no mesmo intervalo de 5 minutos, vale a última alteração.
- Observações longas, o histórico e os dados extras (telefone, nº do RNM) ficam só na plataforma.

## Se algo der errado

- "Não sincronizou – Linha X": algum valor não é aceito (ex.: status digitado errado). Corrija a célula usando a lista suspensa.
- Para parar a sincronização: Apps Script → **Acionadores** (relógio) → apagar os dois acionadores.
