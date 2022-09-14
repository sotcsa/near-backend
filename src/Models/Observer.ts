import WebSocket from "ws";
import { Block, BlockInfo, TxInfo } from "@terra-money/terra.js";
import { workerUrl } from "..";
import Collection from "@discordjs/collection";
import axios from "axios";
import { encodeBase64 } from "../Utils";
import near from "../Utils/near";

require("dotenv").config();

export default class Observer {
  public latestFetchedBlock?: number;
  public latestProcessedBlock?: number;
  public lastestDate: number;
  public enabled: boolean = true;
  private queue: Collection<number, any | undefined> = new Collection<
    number,
    any | undefined
  >();
  private txInfos: Collection<number, any[]> = new Collection<number, any[]>();
  private behind: number[] = [];
  private fetching: number[] = [];
  private sending: number[] = [];
  // private timer?: NodeJS.Timer;
  private headers = { "Content-Type": "application/json" };
  private failedPosts: number = 0;

  constructor(latestBlock?: number) {
    this.lastestDate = Date.now();
    this.latestProcessedBlock = latestBlock;

    setInterval(() => {
      this.handleObserverDown();
    }, 1000);
    setInterval(() => {
      this.handleBlocks();
    }, 1000);
    setInterval(() => {
      this.handleFetchBehind();
    }, 1000);
  }

  async handleObserverDown() {
    let block: any;
    try {
      block = await near.fetchBlock();
    } catch (error) {
      console.log("Failed to get latest block:", error);
      return;
    }
    const blockHeight = parseInt(block.header.height);
    console.log(`Fetched latest block (${blockHeight})`);

    if (!this.latestFetchedBlock || blockHeight > this.latestFetchedBlock) {
      this.queue.set(blockHeight, block);
      this.latestFetchedBlock = blockHeight;
    }
  }

  async handleBlocks() {
    if (this.queue.size !== 0) {
      this.queue = this.queue.sort((_, __, a, b) => a - b);
      const first = this.queue.first();
      if (first === undefined) {
        const firstKey = this.queue.firstKey()!;
        if (this.txInfos.has(firstKey)) {
          this.txInfos.delete(firstKey);
        }
        this.queue.delete(firstKey);
        this.latestProcessedBlock = firstKey;
        this.sending = this.sending.filter((v: number) => v !== firstKey);
        console.log(`[${firstKey}] Skipping block`);
      }
      const firstQueueHeight = parseInt(this.queue.first()!.header.height);
      if (
        this.latestProcessedBlock &&
        firstQueueHeight <= this.latestProcessedBlock
      )
        this.queue.delete(firstQueueHeight);
      if (
        !this.latestProcessedBlock ||
        firstQueueHeight === this.latestProcessedBlock + 1
      ) {
        if (this.sending.includes(firstQueueHeight)) return;
        this.sending.push(firstQueueHeight);
        let txs: any[];
        if (this.txInfos.has(firstQueueHeight)) {
          txs = this.txInfos.get(firstQueueHeight)!;
        } else {
          try {
            console.log(`[${firstQueueHeight}] Fetching txs`);
            txs = await near.fetchBlock(firstQueueHeight);
            console.log(`[${firstQueueHeight}] Fetched txs`);
            this.txInfos.set(firstQueueHeight, txs);
          } catch (error) {
            this.sending = this.sending.filter(
              (v: number) => v !== firstQueueHeight
            );
            console.log(
              `[${firstQueueHeight}] Failed to get Tx from block:`,
              error
            );
            return;
          }
        }
        try {
          const chunkList =
            first.chunks.map((chunk: any) => chunk.shard_id) ?? [];
          const chunks = chunkList.map((shardId: number) => {
            return near.fetchChunk(firstQueueHeight, shardId);
          });
          const values = await Promise.all(chunks);
          console.log(`[${firstQueueHeight}] Sending block`);
          await axios.post(`${workerUrl}api/logs`, {
            headers: this.headers,
            data: {
              height: firstQueueHeight,
              txs: encodeBase64(JSON.stringify(values)),
            },
          });
          console.log(`[${firstQueueHeight}] Posted block`);
          // process.exit(0);
        } catch (error) {
          this.sending = this.sending.filter(
            (v: number) => v !== firstQueueHeight
          );
          console.log(`[${firstQueueHeight}] Failed to post block:`, error);
          // process.exit(0);
          this.failedPosts++;
          if (this.failedPosts >= 3) {
            this.failedPosts = 0;
          } else {
            return;
          }
        }
        if (this.txInfos.has(firstQueueHeight)) {
          this.txInfos.delete(firstQueueHeight);
        }
        this.queue.delete(firstQueueHeight);
        this.latestProcessedBlock = firstQueueHeight;
        this.sending = this.sending.filter(
          (v: number) => v !== firstQueueHeight
        );
      } else {
        const pending =
          (this.latestFetchedBlock ?? this.latestProcessedBlock) -
          this.latestProcessedBlock;
        this.fetchBehind(
          this.latestProcessedBlock + 1,
          this.latestFetchedBlock ?? 0 - 1
        );
        console.log(`Running ${pending} blocks behind`);
      }
    }
    if (this.behind.length !== 0)
      console.log(`Running ${this.behind.length} blocks behind`);
  }

  async handleFetchBehind() {
    const height = this.behind.shift();
    if (!height) return;
    this.fetching.push(height);
    let block: any;
    try {
      block = await near.fetchBlock(height);
    } catch (error) {
      console.log(`[${height}] Failed to get block:`, error);
      try {
        block = await near.fetchBlock(height, true);
      } catch (error) {
        console.log(`[${height}] Failed to get archival:`, error);
        this.queue.set(height, undefined);
        return;
      }
    }
    this.fetching = this.fetching.filter((v) => v !== height);
    let blockHeight;
    try {
      blockHeight = parseInt(block.header.height);
    } catch (error) {
      return;
    }
    if (height === blockHeight) {
      this.queue.set(blockHeight, block);
      console.log(`[${height}] Fetched behind block`);
    }
  }

  fetchBehind(start: number, finish: number) {
    for (let index = start; index < finish; index++) {
      if (
        !this.behind.includes(index) &&
        !this.queue.has(index) &&
        !this.fetching.includes(index)
      )
        this.behind.push(index);
    }
  }
}
