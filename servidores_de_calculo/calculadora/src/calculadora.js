const grpc = require('@grpc/grpc-js');
const protoLoader = require("@grpc/proto-loader");

const PROTO_PATH = __dirname + "/../../contrato/calculo.proto";

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    defaults: true,
    oneofs: true
})

const protos = grpc.loadPackageDefinition(packageDefinition);

const insecure = grpc.credentials.createInsecure();

const somarClient = new protos.SomarService("localhost:4001", insecure);
const subtrairClient = new protos.SubtrairService("localhost:4002", insecure);
const multiplicarClient = new protos.MultiplicarService("localhost:4003", insecure);
const dividirClient = new protos.DividirService("localhost:4004", insecure);

// A chamada gRPC é assíncrona: a resposta chega no callback, não no retorno da
// função. Envolvemos em uma Promise para poder usar await e só responder ao
// cliente depois que o microserviço realmente respondeu.
function chamar(client, metodo, request) {
    return new Promise((resolve, reject) => {
        client[metodo](request, (err, response) => {
            if (err) {
                reject(err);
            } else {
                resolve(response);
            }
        });
    });
}

async function OperacaoEscolhida(call, callback) {
    const { operacao, entrada1, entrada2 } = call.request;
    console.log("Request:", call.request);

    try {
        switch (operacao) {
            case "+": {
                const { resultado } = await chamar(somarClient, "Somar", {
                    parcela1: entrada1,
                    parcela2: entrada2,
                });
                return responder(callback, { saida1: resultado, saida2: 0 });
            }

            case "-": {
                const { resultado } = await chamar(subtrairClient, "Subtrair", {
                    minuendo: entrada1,
                    subtraendo: entrada2,
                });
                return responder(callback, { saida1: resultado, saida2: 0 });
            }

            case "*": {
                const { resultado } = await chamar(multiplicarClient, "Multiplicar", {
                    fator1: entrada1,
                    fator2: entrada2,
                });
                return responder(callback, { saida1: resultado, saida2: 0 });
            }

            case "/": {
                if (entrada2 === 0) {
                    return responder(callback, {
                        saida1: 0,
                        saida2: 0,
                        error: "Divisão por zero",
                    });
                }
                const { quociente, resto } = await chamar(dividirClient, "Dividir", {
                    dividendo: entrada1,
                    divisor: entrada2,
                });
                return responder(callback, { saida1: quociente, saida2: resto });
            }

            default:
                return responder(callback, {
                    saida1: 0,
                    saida2: 0,
                    error: "Operação Inválida",
                });
        }
    } catch (err) {
        return responder(callback, {
            saida1: 0,
            saida2: 0,
            error: "Falha ao chamar o serviço: " + (err.details || err.message),
        });
    }
}

function responder(callback, response) {
    console.log("Response:", response);
    callback(null, response);
}

async function main() {
    const server = new grpc.Server();
    server.addService(protos.CalculadoraService.service, {
        OperacaoEscolhida,
    });
    await server.bindAsync("0.0.0.0:4000",
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
            if (err) {
                console.error(err)
            } else {
                console.log("Server is running");
            }
        });
}

main();
