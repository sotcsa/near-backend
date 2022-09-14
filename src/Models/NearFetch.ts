import axios from "axios";

export default class NearFetch {
  private urls: {
    common: string[];
    archival: string[];
  };
  private urlIdx = {
    common: 0,
    archival: 0,
  };

  constructor(url: string[], archivalUrl: string[]) {
    this.urls = {
      common: url,
      archival: archivalUrl,
    };
  }

  private url(archivalUrl: boolean = false) {
    if (archivalUrl) {
      this.urlIdx.archival++;
      if (this.urlIdx.archival >= this.urls.archival.length) {
        this.urlIdx.archival = 0;
      }
      return this.urls.archival[this.urlIdx.archival];
    } else {
      this.urlIdx.common++;
      if (this.urlIdx.common >= this.urls.common.length) {
        this.urlIdx.common = 0;
      }
      return this.urls.common[this.urlIdx.common];
    }
  }

  fetchChunk(
    block: number,
    shardId: number,
    archival: boolean = false
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      axios
        .post(`${this.url(archival)}http/near`, {
          jsonrpc: "2.0",
          id: "dontcare",
          method: "chunk",
          params: {
            block_id: block,
            shard_id: shardId,
          },
        })
        .then((response) => {
          if (response.data.error) {
            reject(response.data.error);
          }
          resolve(response.data.result);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  fetchBlock(block?: number, archival: boolean = false): Promise<any> {
    return new Promise((resolve, reject) => {
      axios
        .post(`${this.url(archival)}http/near`, {
          jsonrpc: "2.0",
          id: "dontcare",
          method: "block",
          params: block
            ? {
                block_id: block,
              }
            : {
                finality: "final",
              },
        })
        .then((response) => {
          if (response.data.error) {
            reject(response.data.error);
          }
          resolve(response.data.result);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }
}
