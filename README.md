# Calculadora distribuída com gRPC

Trabalho de sistemas distribuídos: uma calculadora dividida em microserviços que
se comunicam por **gRPC**, com um contrato Protocol Buffers compartilhado.

---

## Arquitetura

São cinco servidores gRPC independentes e um cliente.

```
                          ┌──────────────────────┐
                          │  cliente (exemplos)  │
                          └──────────┬───────────┘
                                     │ OperacaoEscolhida("+", 10, 5)
                                     ▼
                          ┌──────────────────────┐
                          │  calculadora  :4000  │   fachada / roteador
                          └──────────┬───────────┘
                 ┌──────────┬────────┴────────┬──────────┐
                 ▼          ▼                 ▼          ▼
            ┌─────────┐┌──────────┐┌───────────────┐┌──────────┐
            │somar    ││subtrair  ││multiplicar    ││dividir   │
            │  :4001  ││  :4002   ││    :4003      ││  :4004   │
            └─────────┘└──────────┘└───────────────┘└──────────┘
```

O **cliente** nunca fala com os serviços de cálculo diretamente na operação
normal: ele envia a operação (`+`, `-`, `*`, `/`) e os dois operandos para a
**calculadora**, que funciona como fachada. A calculadora é, ao mesmo tempo,
*servidor* (atende o cliente) e *cliente gRPC* (chama o microserviço
correspondente à operação pedida).

O serviço de **dividir** faz divisão inteira e devolve dois valores: quociente e
resto. Por isso a resposta da calculadora tem dois campos de saída (`saida1` e
`saida2`) — nas outras operações `saida2` volta `0`.

### Estrutura de pastas

```
servidores_de_calculo/
├── contrato/
│   └── calculo.proto        contrato compartilhado por todos os serviços
├── calculadora/src/         fachada, porta 4000
├── somar/src/               porta 4001
├── subtrair/src/            porta 4002
├── multiplicar/src/         porta 4003
├── dividir/src/             porta 4004
└── cliente/src/             exemplos de uso
```

### Contrato (`calculo.proto`)

Cinco serviços. O da calculadora é o único que o cliente usa no fluxo normal:

```protobuf
service CalculadoraService {
    rpc OperacaoEscolhida (OperacaoEscolhidaRequest) returns (OperacaoEscolhidaResponse) {};
}

message OperacaoEscolhidaRequest {
    string operacao = 1;   // "+", "-", "*" ou "/"
    int32 entrada1 = 2;
    int32 entrada2 = 3;
}

message OperacaoEscolhidaResponse {
    int32 saida1 = 1;          // resultado (ou quociente, na divisão)
    int32 saida2 = 2;          // resto, apenas na divisão
    optional string error = 3; // preenchido em operação inválida ou divisão por zero
}
```

Os outros quatro serviços (`SomarService`, `SubtrairService`,
`MultiplicarService`, `DividirService`) têm cada um seu próprio par
request/response, com nomes de campo específicos do domínio (`parcela1`,
`minuendo`, `fator1`, `dividendo`…).

---

## Como executar

**Pré-requisito:** Node.js instalado (`node -v` para conferir). O projeto não
depende de nada específico do Windows — roda igual em Linux e macOS.

Todos os caminhos abaixo são **relativos à raiz do repositório**, então funcionam
em qualquer máquina, independente de onde o projeto foi clonado.

### 1. Clonar o repositório

```bash
git clone https://github.com/viniciuscotinha/gRPC_calculadora.git
cd gRPC_calculadora
```

### 2. Instalar as dependências

Cada serviço é um projeto Node independente, então o `npm install` é feito em
cada uma das seis pastas. A partir da raiz do repositório:

<details open>
<summary>Windows (PowerShell)</summary>

```powershell
cd servidores_de_calculo
foreach ($p in "somar","subtrair","multiplicar","dividir","calculadora","cliente") {
    Push-Location $p; npm install; Pop-Location
}
```
</details>

<details>
<summary>Linux / macOS (bash)</summary>

```bash
cd servidores_de_calculo
for p in somar subtrair multiplicar dividir calculadora cliente; do
    (cd "$p" && npm install)
done
```
</details>

As dependências são apenas `@grpc/grpc-js` e `@grpc/proto-loader`.

### 3. Subir os servidores

Cada servidor ocupa uma porta e fica rodando, então **cada um precisa do seu
próprio terminal**. Suba os quatro serviços de cálculo primeiro e a calculadora
por último.

Em cada terminal, entre na pasta do serviço a partir da raiz do repositório e
rode o comando correspondente:

| Terminal | Pasta (a partir da raiz) | Comando | Porta |
|---|---|---|---|
| 1 | `servidores_de_calculo/somar` | `node src/somar.js` | 4001 |
| 2 | `servidores_de_calculo/subtrair` | `node src/subtrair.js` | 4002 |
| 3 | `servidores_de_calculo/multiplicar` | `node src/multiplicar.js` | 4003 |
| 4 | `servidores_de_calculo/dividir` | `node src/dividir.js` | 4004 |
| 5 | `servidores_de_calculo/calculadora` | `node src/calculadora.js` | 4000 |

Exemplo do terminal 1:

```bash
cd servidores_de_calculo/somar
node src/somar.js
```

Cada um imprime `Server is running` e fica parado aguardando chamadas — é o
comportamento esperado. Para encerrar, `Ctrl+C` em cada terminal.

### 4. Rodar o cliente

Com os cinco servidores de pé, em um sexto terminal:

```bash
cd servidores_de_calculo/cliente
node src/cliente.js
```

O cliente executa os exemplos em sequência e encerra sozinho.

### Problemas comuns

**`EADDRINUSE: address already in use 0.0.0.0:4001`** — a porta ficou ocupada
por uma execução anterior que não foi encerrada. Para descobrir e encerrar o
processo:

<details open>
<summary>Windows (PowerShell)</summary>

```powershell
Get-NetTCPConnection -State Listen -LocalPort 4000,4001,4002,4003,4004 | Select-Object LocalPort, OwningProcess
Stop-Process -Id <PID> -Force
```
</details>

<details>
<summary>Linux / macOS</summary>

```bash
lsof -i :4000-4004
kill <PID>
```
</details>

Confira o processo antes de encerrá-lo, para não derrubar outro programa seu que
esteja usando a mesma porta.

**`UNAVAILABLE ... ECONNREFUSED`** — algum servidor não está rodando. O cliente
lista no início quais responderam (`[ok]`) e quais não (`[offline]`).

> Observação: o `package.json` das seis pastas ainda traz os scripts
> `"server"` e `"client"` apontando para caminhos de uma atividade anterior
> (`src/server/server.js`). Por isso `npm run server` não funciona — use os
> comandos `node src/<nome>.js` da tabela acima.

---

## O que o cliente demonstra

O `cliente/src/cliente.js` traz 10 exemplos, executados em sequência. Cada um
roda dentro de um `try/catch` próprio, então uma falha não interrompe os demais.

| # | Exemplo | O que demonstra |
|---|---|---|
| 1 | As quatro operações pela calculadora | fluxo básico da fachada |
| 2 | Somas com positivos, negativos, zero e limite do `int32` | faixa de valores do tipo declarado no proto |
| 3 | Divisão inteira | resposta com dois campos (quociente e resto) |
| 4 | Operação inválida, operação vazia, divisão por zero | erro de domínio no campo `error` da resposta |
| 5 | Chamadas diretas a cada microserviço (4001–4004) | os serviços funcionam isoladamente, sem a fachada |
| 6 | 10 chamadas em paralelo (`Promise.all`) | o servidor atende requisições concorrentes |
| 7 | `(4 + 6) * 3 - 5` encadeado | resultado de uma chamada alimenta a próxima |
| 8 | Chamada com `deadline` de 2 s | prazo máximo de resposta do gRPC |
| 9 | Chamada a uma porta inexistente | erro de transporte: `err.code` = `14 UNAVAILABLE` |
| 10 | A mesma chamada com callback puro | comparação com a versão `async/await` |

A distinção entre os exemplos 4 e 9 é o ponto mais interessante: **erro de
domínio** (divisão por zero) volta como resposta bem-sucedida com o campo
`error` preenchido, enquanto **erro de transporte** (serviço fora do ar) volta
como erro do próprio gRPC, com um código de status padronizado.

### Saída esperada (trecho)

```
10 + 5  -> {"saida1":15,"saida2":0}
10 / 3  -> quociente 3, resto 1
"^"     -> {"saida1":0,"saida2":0,"error":"Operação Inválida"}
10 / 0  -> {"saida1":0,"saida2":0,"error":"Divisão por zero"}
(4+6)*3-5 = 25
10 chamadas em paralelo concluídas em 18ms
Código : 14 (UNAVAILABLE)
```

---

## Participação do Claude (assistente de IA) no projeto

Esta seção declara o que foi feito com auxílio do Claude Code, para fins de
transparência acadêmica.

### O que foi feito por mim, sem IA

- A **concepção da arquitetura**: a decisão de separar a calculadora em cinco
  serviços gRPC independentes, com uma fachada roteando para os serviços de
  cálculo.
- O **contrato `calculo.proto`**: os cinco serviços, as mensagens e os nomes de
  campo de cada operação.
- A **implementação original** dos quatro serviços de cálculo (`somar`,
  `subtrair`, `multiplicar`, `dividir`), incluindo a decisão de a divisão
  devolver quociente e resto.
- A **estrutura de pastas** e a atribuição de portas.

Os commits `cb2671a`, `3fb534f`, `130111b` e `e27b646` são esse trabalho.

### O que foi feito com o Claude

Commits `bc32c4a` ("Feito Pelo Claude, Ajustes e Testes") e `f9ece7c`
("Correções feitas pelo Claude").

**1. Correção de erros de digitação no `calculo.proto`**

A palavra-chave `rpc` estava escrita como `rcp` em quatro dos cinco serviços, e
o `DividirService` estava sem a palavra-chave. O arquivo não era carregado por
nenhum dos programas. O Claude localizou e corrigiu.

**2. Correção do caminho do `.proto` em seis arquivos**

Todos usavam `__dirname + "/../contrato/calculo.proto"`, que aponta para
`<serviço>/contrato/` — mas o contrato fica em `servidores_de_calculo/contrato/`.
Corrigido para `/../../contrato/calculo.proto`.

**3. Correção de três defeitos no `calculadora.js`**

Este foi o trecho mais substancial. O servidor subia, mas toda chamada falhava:

- O handler estava registrado com a chave `escolherOperacao`, enquanto o rpc no
  `.proto` se chama `OperacaoEscolhida`. Como os nomes não batiam, o gRPC
  respondia `UNIMPLEMENTED` a todas as requisições.
- As variáveis `saida1` e `saida2` eram declaradas com `const` e reatribuídas
  dentro do `switch`, o que gera `TypeError`; a variável `error` nunca era
  declarada.
- As chamadas aos serviços de cálculo passavam os argumentos soltos
  (`somarClient.somar(entrada1, entrada2, callback)`) em vez do objeto de
  request que o gRPC espera (`{ parcela1, parcela2 }`), e tentavam usar o
  **retorno** da chamada como se fosse síncrono. Como a resposta gRPC chega pelo
  callback, o resultado sempre era `undefined`.

A correção do terceiro item exigiu reescrever o fluxo com `async/await`: cada
chamada ao microserviço é envolvida em uma `Promise` e aguardada, e só então a
calculadora responde ao cliente. Junto disso foram adicionados o tratamento de
divisão por zero e o `try/catch` que transforma um microserviço fora do ar em
mensagem no campo `error`.

**4. Reescrita do `cliente.js`**

O cliente ainda continha o código de uma atividade anterior (`AlunoService`,
cadastro de alunos) e não exercitava a calculadora. O Claude escreveu os 10
exemplos descritos acima, o utilitário `chamar()` que promisifica as chamadas
gRPC e a verificação `waitForReady` que lista quais servidores estão no ar.

**5. Execução e verificação**

O Claude subiu os cinco servidores localmente e executou o cliente de ponta a
ponta, confirmando que os 10 exemplos passam. Também diagnosticou um
`EADDRINUSE` que ele próprio havia causado ao deixar processos de teste em
execução.

### Como o Claude foi usado

Interativamente, via Claude Code no VS Code, em português, em uma conversa
única. O padrão de trabalho foi: descrever o que eu queria (por exemplo, "no
cliente.js crie vários exemplos usando nosso serviço novo"), revisar o que ele
produziu e pedir ajustes. Em vários momentos ele apontou um problema em código
que eu não havia pedido para mexer — os erros do `calculadora.js`, por exemplo —
e eu decidi se autorizava a correção.

Revisei todo o código gerado antes de commitar; o commit `a6e4fcb` é uma revisão
minha sobre o resultado, removendo comentários que julguei desnecessários.
