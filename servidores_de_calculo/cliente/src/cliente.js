const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

const PROTO_PATH = path.join(__dirname, "..", "..", "contrato", "calculo.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  defaults: true,
  oneofs: true,
});

const protos = grpc.loadPackageDefinition(packageDefinition);

const ENDERECOS = {
  calculadora: "localhost:4000",
  somar: "localhost:4001",
  subtrair: "localhost:4002",
  multiplicar: "localhost:4003",
  dividir: "localhost:4004",
};

const insecure = grpc.credentials.createInsecure();

const calculadora = new protos.CalculadoraService(ENDERECOS.calculadora, insecure);
const somar = new protos.SomarService(ENDERECOS.somar, insecure);
const subtrair = new protos.SubtrairService(ENDERECOS.subtrair, insecure);
const multiplicar = new protos.MultiplicarService(ENDERECOS.multiplicar, insecure);
const dividir = new protos.DividirService(ENDERECOS.dividir, insecure);

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

// Envolve a chamada gRPC (que usa callback) em uma Promise, para escrevermos
// os exemplos com async/await em vez de callbacks aninhados.
function chamar(client, metodo, request, opcoes = {}) {
  return new Promise((resolve, reject) => {
    client[metodo](request, opcoes, (err, response) => {
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
}

// Prazo máximo de resposta: se o servidor demorar mais que `ms`, o gRPC
// aborta a chamada com DEADLINE_EXCEEDED.
function prazo(ms) {
  return { deadline: new Date(Date.now() + ms) };
}

function titulo(texto) {
  console.log("\n" + "=".repeat(60));
  console.log(texto);
  console.log("=".repeat(60));
}

function mostrar(descricao, request, response) {
  console.log("\n" + descricao);
  console.log("  Request :", JSON.stringify(request));
  console.log("  Response:", JSON.stringify(response));
}

// Espera o servidor aceitar conexões antes de disparar os exemplos, assim um
// serviço desligado vira uma mensagem clara em vez de um erro genérico.
function esperarServidor(client, nome, ms = 3000) {
  return new Promise((resolve) => {
    client.waitForReady(new Date(Date.now() + ms), (err) => {
      if (err) {
        console.log("  [offline] " + nome + " (" + ENDERECOS[nome] + ")");
        resolve(false);
      } else {
        console.log("  [ok]      " + nome + " (" + ENDERECOS[nome] + ")");
        resolve(true);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Exemplo 1 - as quatro operações pela fachada (CalculadoraService)
// ---------------------------------------------------------------------------

async function exemploOperacoesBasicas() {
  titulo("1) Operações básicas via CalculadoraService (porta 4000)");

  const casos = [
    { operacao: "+", entrada1: 10, entrada2: 5 },
    { operacao: "-", entrada1: 10, entrada2: 5 },
    { operacao: "*", entrada1: 10, entrada2: 5 },
    { operacao: "/", entrada1: 10, entrada2: 5 },
  ];

  for (const request of casos) {
    const response = await chamar(calculadora, "OperacaoEscolhida", request);
    mostrar(
      request.entrada1 + " " + request.operacao + " " + request.entrada2,
      request,
      response
    );
  }
}

// ---------------------------------------------------------------------------
// Exemplo 2 - soma com vários pares de valores
// ---------------------------------------------------------------------------

async function exemploVariasSomas() {
  titulo("2) Várias somas (positivos, negativos, zero e limite do int32)");

  const pares = [
    [1, 2],
    [100, 250],
    [-7, 7],
    [-10, -20],
    [0, 0],
    [2147483646, 1],
  ];

  for (const [entrada1, entrada2] of pares) {
    const request = { operacao: "+", entrada1, entrada2 };
    const response = await chamar(calculadora, "OperacaoEscolhida", request);
    mostrar(entrada1 + " + " + entrada2, request, response);
  }
}

// ---------------------------------------------------------------------------
// Exemplo 3 - divisão inteira: quociente e resto
// ---------------------------------------------------------------------------

async function exemploDivisaoComResto() {
  titulo("3) Divisão inteira - saida1 = quociente, saida2 = resto");

  const pares = [
    [10, 3],
    [7, 2],
    [9, 3],
    [1, 4],
    [-7, 2],
  ];

  for (const [entrada1, entrada2] of pares) {
    const request = { operacao: "/", entrada1, entrada2 };
    const response = await chamar(calculadora, "OperacaoEscolhida", request);
    console.log(
      "\n" + entrada1 + " / " + entrada2 +
      " => quociente " + response.saida1 + ", resto " + response.saida2
    );
    console.log("  Response:", JSON.stringify(response));
  }
}

// ---------------------------------------------------------------------------
// Exemplo 4 - casos de erro tratados pelo próprio servidor
// ---------------------------------------------------------------------------

async function exemploCasosDeErro() {
  titulo("4) Casos de erro (campo `error` da resposta)");

  const casos = [
    {
      descricao: "operação que não existe",
      request: { operacao: "^", entrada1: 2, entrada2: 3 },
    },
    {
      descricao: "operação vazia",
      request: { operacao: "", entrada1: 2, entrada2: 3 },
    },
    {
      descricao: "divisão por zero",
      request: { operacao: "/", entrada1: 10, entrada2: 0 },
    },
  ];

  for (const { descricao, request } of casos) {
    const response = await chamar(calculadora, "OperacaoEscolhida", request);
    mostrar(descricao, request, response);
    if (response.error) {
      console.log("  -> servidor retornou erro:", response.error);
    }
  }
}

// ---------------------------------------------------------------------------
// Exemplo 5 - chamando cada microserviço diretamente, sem passar pela fachada
// ---------------------------------------------------------------------------

async function exemploServicosDiretos() {
  titulo("5) Chamando cada microserviço diretamente (4001 a 4004)");

  const somaReq = { parcela1: 8, parcela2: 12 };
  mostrar("SomarService.Somar", somaReq, await chamar(somar, "Somar", somaReq));

  const subReq = { minuendo: 30, subtraendo: 12 };
  mostrar("SubtrairService.Subtrair", subReq, await chamar(subtrair, "Subtrair", subReq));

  const multReq = { fator1: 6, fator2: 7 };
  mostrar(
    "MultiplicarService.Multiplicar",
    multReq,
    await chamar(multiplicar, "Multiplicar", multReq)
  );

  const divReq = { dividendo: 22, divisor: 7 };
  mostrar("DividirService.Dividir", divReq, await chamar(dividir, "Dividir", divReq));
}

// ---------------------------------------------------------------------------
// Exemplo 6 - várias chamadas em paralelo
// ---------------------------------------------------------------------------

async function exemploParalelo() {
  titulo("6) Dez chamadas disparadas em paralelo (Promise.all)");

  const requests = Array.from({ length: 10 }, (_, i) => ({
    operacao: "*",
    entrada1: i + 1,
    entrada2: i + 1,
  }));

  const inicio = Date.now();
  const respostas = await Promise.all(
    requests.map((request) => chamar(calculadora, "OperacaoEscolhida", request))
  );
  const duracao = Date.now() - inicio;

  respostas.forEach((response, i) => {
    const { entrada1, entrada2 } = requests[i];
    console.log("  " + entrada1 + " * " + entrada2 + " = " + response.saida1);
  });
  console.log("\n  10 chamadas concluídas em " + duracao + "ms");
}

// ---------------------------------------------------------------------------
// Exemplo 7 - encadeando operações: (4 + 6) * 3 - 5
// ---------------------------------------------------------------------------

async function exemploEncadeado() {
  titulo("7) Encadeando operações: (4 + 6) * 3 - 5");

  const soma = await chamar(calculadora, "OperacaoEscolhida", {
    operacao: "+",
    entrada1: 4,
    entrada2: 6,
  });
  console.log("  4 + 6 = " + soma.saida1);

  const produto = await chamar(calculadora, "OperacaoEscolhida", {
    operacao: "*",
    entrada1: soma.saida1,
    entrada2: 3,
  });
  console.log("  " + soma.saida1 + " * 3 = " + produto.saida1);

  const diferenca = await chamar(calculadora, "OperacaoEscolhida", {
    operacao: "-",
    entrada1: produto.saida1,
    entrada2: 5,
  });
  console.log("  " + produto.saida1 + " - 5 = " + diferenca.saida1);

  console.log("\n  Resultado final: " + diferenca.saida1);
}

// ---------------------------------------------------------------------------
// Exemplo 8 - deadline (prazo máximo de resposta)
// ---------------------------------------------------------------------------

async function exemploDeadline() {
  titulo("8) Chamada com deadline de 2 segundos");

  const request = { operacao: "+", entrada1: 40, entrada2: 2 };
  try {
    const response = await chamar(calculadora, "OperacaoEscolhida", request, prazo(2000));
    mostrar("respondeu dentro do prazo", request, response);
  } catch (err) {
    console.log("  Estourou o prazo:", err.details || err.message);
  }
}

// ---------------------------------------------------------------------------
// Exemplo 9 - erro de transporte: serviço em porta inexistente
// ---------------------------------------------------------------------------

async function exemploServicoIndisponivel() {
  titulo("9) Serviço indisponível - tratando o erro do gRPC");

  const clienteQuebrado = new protos.SomarService("localhost:9999", insecure);
  const request = { parcela1: 1, parcela2: 1 };

  try {
    const response = await chamar(clienteQuebrado, "Somar", request, prazo(2000));
    mostrar("não deveria chegar aqui", request, response);
  } catch (err) {
    console.log("  Código :", err.code, "(" + grpc.status[err.code] + ")");
    console.log("  Detalhe:", err.details || err.message);
  } finally {
    clienteQuebrado.close();
  }
}

// ---------------------------------------------------------------------------
// Exemplo 10 - a mesma chamada escrita com callback puro
// ---------------------------------------------------------------------------

function exemploCallbackPuro() {
  titulo("10) A mesma chamada usando callback direto (sem Promise)");

  const request = { operacao: "-", entrada1: 100, entrada2: 58 };
  console.log("  Request :", JSON.stringify(request));

  return new Promise((resolve) => {
    calculadora.OperacaoEscolhida(request, function (err, response) {
      if (err) {
        console.log("  Erro    :", err.details || err.message);
      } else {
        console.log("  Response:", JSON.stringify(response));
      }
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------

async function main() {
  titulo("Verificando os servidores");
  await Promise.all([
    esperarServidor(calculadora, "calculadora"),
    esperarServidor(somar, "somar"),
    esperarServidor(subtrair, "subtrair"),
    esperarServidor(multiplicar, "multiplicar"),
    esperarServidor(dividir, "dividir"),
  ]);

  const exemplos = [
    exemploOperacoesBasicas,
    exemploVariasSomas,
    exemploDivisaoComResto,
    exemploCasosDeErro,
    exemploServicosDiretos,
    exemploParalelo,
    exemploEncadeado,
    exemploDeadline,
    exemploServicoIndisponivel,
    exemploCallbackPuro,
  ];

  // Um exemplo que falha não derruba os demais.
  for (const exemplo of exemplos) {
    try {
      await exemplo();
    } catch (err) {
      console.log("\n  [falhou] " + exemplo.name + ":", err.details || err.message);
    }
  }

  console.log("\nFim dos exemplos.\n");

  [calculadora, somar, subtrair, multiplicar, dividir].forEach((c) => c.close());
}

main();
