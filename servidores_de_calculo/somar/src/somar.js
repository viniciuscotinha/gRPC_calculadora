const grpc = require('@grpc/grpc-js');
const protoLoader = require("@grpc/proto-loader");

const PROTO_PATH = __dirname + "/../../contrato/calculo.proto";

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  defaults: true,
  oneofs: true
})

const protos = grpc.loadPackageDefinition(packageDefinition);

function somar(call, callback) {
  const { parcela1, parcela2 } = call.request;
  const resultado = parcela1 + parcela2;

  callback(null, { resultado });
}

async function main() {
  const server = new grpc.Server();
  server.addService(protos.SomarService.service, {
    somar,
  });
  await server.bindAsync("0.0.0.0:4001",
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