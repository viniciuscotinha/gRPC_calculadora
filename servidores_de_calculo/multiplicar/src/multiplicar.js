const grpc = require('@grpc/grpc-js');
const protoLoader = require("@grpc/proto-loader");

const PROTO_PATH = __dirname + "/../contrato/calculo.proto";

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  defaults: true,
  oneofs: true
})

const protos = grpc.loadPackageDefinition(packageDefinition);

function multiplicar(call, callback) {
  const { fator1, fator2 } = call.request;
  const resultado = fator1 * fator2;

  callback(null, { resultado });
}

async function main() {
  const server = new grpc.Server();
  server.addService(protos.MultiplicarService.service, {
    multiplicar,
  });
  await server.bindAsync("0.0.0.0:4003",
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