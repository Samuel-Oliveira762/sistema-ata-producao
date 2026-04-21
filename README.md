# Gestao de Atas de Reuniao de Producao

MVP funcional feito apenas com `HTML`, `CSS` e `JavaScript` puro para:

- importar uma planilha Excel `.xlsx`
- ler os dados diretamente no navegador
- classificar criticidade
- editar acoes durante a reuniao
- registrar pendencias gerais
- visualizar a ata em tempo real
- exportar para PDF
- salvar historico local no navegador
- consultar, reabrir, reexportar e excluir atas salvas
- manter memoria automatica por OP
- fazer backup e restauracao dos dados locais

## Estrutura

```text
project/
  css/
    style.css
  js/
    app.js
    backup.js
    excel.js
    pdf.js
    storage.js
    ui.js
  index.html
  README.md
```

## Bibliotecas usadas por CDN

- `SheetJS` para leitura de arquivos `.xlsx`
- `html2canvas`
- `jsPDF`

## Como executar

1. Mantenha a estrutura de pastas do projeto.
2. Abra o arquivo `index.html` no navegador.
3. Se preferir, rode com um servidor local simples para evitar limitacoes de alguns navegadores com arquivos locais.

Exemplo de servidor simples:

```powershell
python -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000
```

### Limitacao importante

O site fica online, mas os dados continuam locais em cada navegador porque o projeto usa `localStorage`.

Isso significa:

- o sistema abre de qualquer PC
- mas historico, participantes, memoria por OP e configuracoes nao sincronizam automaticamente entre maquinas
- para transferir os dados de um computador para outro, use `Exportar dados` e depois `Importar dados`

```text
https://seu-usuario.github.io/nome-do-repositorio/
```
## Fluxo de uso

1. Faca upload da planilha `.xlsx`.
2. O sistema tenta localizar automaticamente a linha de cabecalho.
3. Os registros validos sao convertidos e classificados por criticidade.
4. Se uma OP ja existir na memoria local, os campos editaveis sao preenchidos automaticamente.
5. Use os filtros para focar nos itens relevantes.
6. Preencha os dados gerais da reuniao.
7. Edite diretamente na tabela os campos de acao, responsavel, prazo e status.
8. Preencha a secao de pendencias gerais da reuniao.
9. Veja a ata montada na pre-visualizacao.
10. Clique em `Salvar ata` para gravar no `localStorage` e atualizar a memoria por OP.
11. Clique em `Exportar PDF` para gerar o documento.
12. Use `Exportar dados` e `Importar dados` para backup e restauracao local.
13. Consulte o historico para abrir detalhes, reexportar, excluir ou carregar novamente para edicao.

## Estrutura esperada da planilha

O sistema procura colunas equivalentes a:

- Cliente
- Producao
- Data
- Entrega
- Lead
- Produto
- Descricao
- Planejado
- Realizado
- Saldo
- %
- Setores

Ele tenta tolerar:

- diferencas de acentuacao
- variacao entre maiusculas e minusculas
- pequenos espacos extras
- alguns nomes alternativos simples

## Onde ajustar regras de negocio

### Criticidade

No arquivo `js/app.js`, ajuste o objeto:

```js
const CRITICAL_RULES = {
  attentionDaysBeforeDue: 5
};
```

### Mapeamento de colunas

No arquivo `js/excel.js`, ajuste o objeto:

```js
const REQUIRED_COLUMNS = {
  ...
};
```

Ali voce pode adicionar novos nomes equivalentes para cada coluna da planilha.

### Armazenamento local

No arquivo `js/storage.js`, as chaves principais atuais sao:

```js
const STORAGE_KEY = "production_minutes_history_v1";
const PARTICIPANTS_KEY = "production_minutes_participants_v1";
const OP_DATABASE_KEY = "opDatabase";
```

### Backup

No arquivo `js/backup.js`, voce pode ajustar:

- versao do backup
- chaves persistidas exportadas
- validacoes da estrutura JSON

## Decisoes principais

### Historico e memoria por OP

Foi usado `localStorage` porque:

- atende bem ao MVP
- e simples de manter
- nao exige backend
- ja permite persistencia entre sessoes do navegador

### Exportacao em PDF

A exportacao continua 100% no front-end e usa o fluxo ja integrado ao sistema.

### Organizacao do codigo

- `css/style.css`: tema, layout e componentes visuais
- `js/excel.js`: leitura, normalizacao e conversao da planilha
- `js/storage.js`: persistencia local do historico, participantes e memoria por OP
- `js/backup.js`: backup e restauracao dos dados locais
- `js/pdf.js`: exportacao para PDF
- `js/ui.js`: geracao do HTML da pre-visualizacao
- `js/app.js`: estado da aplicacao, eventos, filtros e renderizacao principal

## Observacoes

- O historico fica salvo localmente no navegador da maquina.
- A memoria por OP tambem fica salva localmente.
- Se o navegador limpar os dados locais, o historico e a memoria por OP tambem serao removidos.
- O backup em JSON permite transferir esses dados para outro computador.
- O sistema foi pensado para um arquivo diario com mesma estrutura logica, nao para um layout fixo e rigido.
