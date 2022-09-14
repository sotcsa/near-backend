import { Block, TxInfo } from "@terra-money/terra.js";

export interface SavedBlockInfo {
  block: Block;
  txs: TxInfo[];
}
