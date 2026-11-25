# Fotos de Expedição

Arquivo das fotos tiradas na hora de embalar cada pedido (produto + DANFE + etiqueta de transporte), para provar o dia e o conteúdo da embalagem em contestações de devolução.

- **Página** (`index.html`): hospedada no GitHub Pages. Não guarda dado nenhum, só o código.
- **Fotos**: pasta privada no Google Drive, uma subpasta por mês.
- **Índice**: Planilha Google (pedido, NF, loja, produto, operador, data e hora da foto).
- **Ponte** (`apps-script/Codigo.gs`): Google Apps Script que liga a página ao Drive e à planilha. Só responde a quem digita a senha.

## Como usar

1. **Adicionar fotos**: escolha as fotos do dia (várias de uma vez). A página lê a data e a hora gravadas na foto, tenta ler o código de barras do pedido e da NF, e você confere os campos antes de salvar. Se a foto não trouxer data (por exemplo, veio pelo WhatsApp), a página avisa e usa a data do arquivo.
2. **Buscar**: digite o número do pedido (ou só os últimos dígitos), a NF, o produto ou a loja. A busca olha todo o histórico. Sem busca, a tela mostra o período escolhido (Hoje, Ontem, 7 dias, 30 dias, Tudo ou datas).
3. **Abrir uma foto**: mostra a foto completa e os dados. Dá para copiar os dados, baixar a foto e corrigir pedido, NF, loja e produto. A data e a hora da foto não mudam depois de salvas, e toda correção fica registrada na planilha.

Não existe botão de apagar foto, de propósito: é um arquivo de prova.

## Instalação (uma vez)

### 1. Apps Script (conta Google que vai guardar as fotos)

1. Acesse <https://script.google.com> e clique em **Novo projeto**.
2. Apague o conteúdo de `Code.gs`, cole o de `apps-script/Codigo.gs` e salve.
3. No topo do arquivo, troque `TROQUE-ESTA-SENHA` por uma senha de pelo menos 8 caracteres. Essa é a senha que a equipe digita na página.
4. No menu de funções escolha `configurar` e clique em **Executar**. Autorize o acesso ao Drive e às Planilhas. Isso cria a pasta **Fotos de Expedição** e a planilha **Fotos de Expedição - Índice** no Drive.
5. **Implantar > Nova implantação > Tipo: App da Web**. Em *Executar como*, escolha **Eu**. Em *Quem pode acessar*, escolha **Qualquer pessoa**. Clique em **Implantar** e copie a **URL do app da Web** (termina em `/exec`).

A URL fica aberta para quem a tiver, mas toda ação exige a senha. Não publique a senha.

Se mudar o código do script, use **Implantar > Gerenciar implantações > editar > Nova versão**. A URL continua a mesma.

### 2. Página

Cole a URL do passo anterior na constante `WEB_APP_URL` no começo do script de `index.html` (assim ninguém precisa digitar) e publique no GitHub. Ative o GitHub Pages em *Settings > Pages > Deploy from a branch > main > / (root)*.

### 3. Cada aparelho

Abra a página, clique em **Configurar**, informe a senha e o seu nome, e use **Testar conexão**. Isso é gravado no próprio navegador do aparelho.

## Espaço e limites

- Cada foto é reduzida para no máximo 1800 px no maior lado, JPEG qualidade 80 (em torno de 300 a 600 KB), o bastante para ler a etiqueta e a nota. Para mudar, ajuste `LADO_MAX` e `QUALIDADE` em `index.html`.
- Estimativa: 200 fotos por dia ocupam algo como 2 a 3 GB por mês no Drive. O limite real é o espaço da conta Google que guarda as fotos.
- A leitura de código de barras é uma ajuda. O código do pedido costuma ser lido; o da NF, só às vezes. Cole a chave de 44 dígitos no campo NF e a página extrai o número da nota sozinha. Um leitor de código de barras USB digita direto no campo Pedido.
- O Google limita o tempo de execução do Apps Script. Lotes de centenas de fotos funcionam, mas leva alguns minutos; a página envia 2 fotos por vez.

## Privacidade

As etiquetas mostram nome e endereço de clientes. Por isso as fotos ficam no Drive privado, nunca neste repositório. Quem receber a URL do Apps Script não consegue ler nada sem a senha. Se a senha vazar, troque `SENHA` no script e publique uma nova versão.
