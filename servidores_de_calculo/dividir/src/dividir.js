const grpc = require('@grpc/grpc-js');
const protoLoader = require("@grpc/proto-loader");

const PROTO_PATH = __dirname + "/../../contrato/calculo.proto";

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    defaults: true,
    oneofs: true
})

const protos = grpc.loadPackageDefinition(packageDefinition);

function dividir(call, callback) {
    const { dividendo, divisor } = call.request;
    const quociente = Math.floor(dividendo / divisor);
    const resto = dividendo % divisor;
    console.log(`Operação Realizada ${dividendo} / ${divisor}`);
    callback(null, { quociente, resto });
}

async function main() {
    const server = new grpc.Server();
    server.addService(protos.DividirService.service, {
        dividir,
    });
    await server.bindAsync("0.0.0.0:4004",
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