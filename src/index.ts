import Observer from "./Models/Observer";
import axios from "axios";
import { config } from "dotenv";

config();

const envVars = ["RPC_ADDRESS", "ARPC_ADDRESS", "WORKER_URL"];

const missingEnvVars = envVars
  .filter((v) => !(v in process.env) || process.env[v] === "")
  .map((v) => v);

if (missingEnvVars.length > 0) {
  console.error(`Missing the following ENV vars: ${missingEnvVars.join(", ")}`);
  process.exit(1);
}

const workerUrl = process.env.WORKER_URL!;

async function main() {
  let latestBlock: number | undefined;
  try {
    latestBlock = (await axios.get(`${workerUrl}api/latest-block`)).data;
    console.info(`Latest block: ${latestBlock}`);
  } catch (error) {
    console.error(`Failed to get last block processed:`, error);
  }
  new Observer(latestBlock);
}

main();

export { workerUrl };
