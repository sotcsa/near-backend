import NearFetch from "../Models/NearFetch";
import { config } from "dotenv";

config();

const near = new NearFetch(
  process.env.RPC_ADDRESS!.split(","),
  process.env.ARPC_ADDRESS!.split(",")
);

export default near;
