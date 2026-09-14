const grpc = require('@grpc/grpc-js');
const protoLoader = require("@grpc/proto-loader");

const PROTO_PATH = __dirname + "/../../contrato/calculo.proto";

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    defaults: true,
    oneofs: true
})

const protos = grpc.loadPackageDefinition(packageDefinition);

function escolherOperacao(call, callback) {
    const { operacao, entrada1, entrada2 } = call.request;
    const saida1 = 0;
    const saida2 = 0;

    switch(operacao){
        case "+":
            const somarClient = new protos.SomarService(
                "localhost:4001",
                grpc.credentials.createInsecure()
            );
            saida1 = somarClient.somar(
                entrada1,
                entrada2,
                function (err, response) {
                    console.log("Response:", response);
                }
            );
        break;
        case "-":
            const subtrairClient = new protos.SubtrairService(
                "localhost:4002",
                grpc.credentials.createInsecure()
            );
            saida1 = subtrairClient.subtrair(
                entrada1,
                entrada2,
                function (err, response) {
                    console.log("Response:", response);
                }
            );
        break;
        case "*":
            const multiplicarClient = new protos.MultiplicarService(
                "localhost:4003",
                grpc.credentials.createInsecure()
            );
            saida1 = multiplicarClient.multiplicar(
                entrada1,
                entrada2,
                function (err, response) {
                    console.log("Response:", response);
                }
            );
        break;
        case "/":
            const dividirClient = new protos.DividirService(
                "localhost:4004",
                grpc.credentials.createInsecure()
            );
            const {resultado1, resultado2} = dividirClient.dividir(
                entrada1,
                entrada2,
                function (err, response) {
                    console.log("Response:", response);
                }
            );
            saida1 = resultado1;
            saida2 = resultado2;
        break;
        default:
            error = "Operação Inválida"
    }

    callback(null, { saida1, saida2, error });
}

async function main() {
    const server = new grpc.Server();
    server.addService(protos.CalculadoraService.service, {
        escolherOperacao,
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