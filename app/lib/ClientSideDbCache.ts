import {
  BnceTradeHisFromCsv,
  DagobertPair,
  DagobertTransaction,
  DagobertTransactionGroup,
  DbActionsViaApi,
  KVRoot,
} from "@/utils/typesAndEnums";

type dbParams = {
  method: string;
  key: string;
  value: any;
};

class ClientSideDbCache {
  private static cache: Record<string, any> = {};
  private static isInitialized = false;

  public static async initializeCache(): Promise<boolean> {
    if (this.isInitialized) return true;

    const response = await fetch(
      `/api/dbapi/admin?action=${DbActionsViaApi.getcache}`
    );
    if (response.ok) {
      this.cache = (await response.json()).response;
      this.isInitialized = true;
      return true;
    } else {
      throw new Error(
        "Failed to initialize cache! " + JSON.stringify(await response.json())
      );
    }
  }

  public static getCache(): Record<string, any> {
    return this.cache;
  }

  public static isCacheEmpty(): boolean {
    return Object.keys(this.cache).length === 0;
  }

  // ADD

  public static async set(key: string, value: string): Promise<boolean> {
    const input = { method: "set", key, value };
    return await this.handleOperation(() => this.dbAction(input), input);
  }

  public static async hset(
    key: KVRoot,
    value: { [field: string]: any }
  ): Promise<boolean> {
    const input = { method: "hset", key, value };
    return await this.handleOperation(() => this.dbAction(input), input);
  }

  public static async sadd(key: KVRoot, value: any): Promise<boolean> {
    const input = { method: "sadd", key, value };
    return await this.handleOperation(() => this.dbAction(input), input);
  }

  // GET

  public static get(key: string): string {
    return this.cache[key] ?? null;
  }

  public static hget(
    key: KVRoot,
    field: string
  ): DagobertTransaction | DagobertTransactionGroup | DagobertPair | null {
    switch (key) {
      case KVRoot.dtransactions:
        console.log(this.cache[key] === undefined);
        console.log(this.cache[key][field] === undefined);
        return (this.cache[key][field] as DagobertTransaction) ?? null;
      case KVRoot.dtransactionGroups:
        return (this.cache[key][field] as DagobertTransactionGroup) ?? null;
      case KVRoot.pairs:
        return (this.cache[key][field] as DagobertPair) ?? null;
      default:
        return null; // Only dtrans and dtransgroup supported
    }
  }

  public static hgetall(key: KVRoot): any {
    return this.cache[key] ?? null;
  }

  public static smembers(key: KVRoot): any {
    return this.cache[key] ?? null;
  }

  // DEL

  public static async del(key: string): Promise<boolean> {
    const input = { method: "del", key, value: "" };
    return await this.handleOperation(() => this.dbAction(input), input);
  }

  public static async srem(key: KVRoot, value: any): Promise<boolean> {
    const input = { method: "srem", key, value };
    return await this.handleOperation(() => this.dbAction(input), input);
  }

  public static async hdel(key: KVRoot, value: string) {
    const input = { method: "hdel", key, value };
    return await this.handleOperation(() => this.dbAction(input), input);
  }

  // Private funcs
  private static iii = 0;

  private static async dbAction(params: dbParams): Promise<boolean> {
    try {
      let value = params.value;
      if (typeof value === "string") {
        value = value.trim();
      } else {
        value = JSON.stringify(value);
      }

      const query =
        "/api/dbapi/admin" +
        "?action=" +
        encodeURIComponent(params.method.trim()) +
        "&key=" +
        encodeURIComponent(params.key.trim()) +
        "&value=" +
        encodeURIComponent(value);

      //console.log("dbAction called: " + query);

      const response = await fetch(query);

      return response.ok;
    } catch (error) {
      console.error("error happened", error); //TODO
      return false;
    }
  }

  private static async handleOperation<T>(
    operation: () => Promise<boolean>,
    params: dbParams
  ): Promise<boolean> {
    try {
      const success = await operation();
      if (success) {
        const key = params.key;
        const value = params.value;
        const method = params.method;

        switch (method) {
          case "set":
            this.cache[key] = value;
            break;
          case "hset":
            this.cache[key] = this.cache[key] ?? {};

            if (this.isKeySomeStringValueAny(value)) {
              Object.entries(value).forEach(([vKey, vValue]) => {
                this.cache[key][vKey] = this.cache[key][vKey] ?? {}; // TODO is this needed?
                this.cache[key][vKey] = vValue;
              });
            } else {
              throw new Error("Invalid value structure for hset");
            }
            break;
          case "sadd":
            if (!Array.isArray(this.cache[key])) {
              this.cache[key] = [];
            }
            if (!this.cache[key].includes(value)) {
              this.cache[key].push(value);
            }
            break;
          case "del":
            this.cache = this.cache.filter(
              (cachedItem: any) => cachedItem !== this.cache[key]
            );
            break;
          case "hdel":
            delete this.cache[key][value];
            break;
          case "srem":
            if (this.cache[key]) {
              this.cache[key] = this.cache[key].filter(
                (cachedItem: any) => cachedItem !== value
              );
            }
            break;
          default:
            console.error("Invalid method: " + params.method);
            return false;
        }
      }
      return success;
    } catch (error) {
      console.error("Error during client side cache operation:", error);
      return false;
    }
  }

  private static isKeySomeStringValueAny(
    variable: any
  ): variable is { [field: string]: any } {
    return (
      typeof variable === "object" &&
      variable !== null &&
      !Array.isArray(variable)
    );
  }
}

export default ClientSideDbCache;
