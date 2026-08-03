import type { ReadApiError, ReadApiSuccess } from "../../dto/ReadApiResponse";

export type FetchLike = typeof fetch;
const DATA_SOURCE_STORAGE_KEY = "dagobert-read-data-source";

export class HttpReadError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "HttpReadError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class HttpReadClient {
  constructor(private readonly fetchImplementation: FetchLike = globalThis.fetch) {}

  async get<T>(url: string): Promise<T> {
    const dataSource =
      typeof window !== "undefined" &&
      window.localStorage.getItem(DATA_SOURCE_STORAGE_KEY) === "postgres"
        ? "postgres"
        : "redis";
    const response = await this.fetchImplementation.call(globalThis, url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Dagobert-Data-Source": dataSource,
      },
    });
    const body = (await response.json()) as ReadApiSuccess<T> | ReadApiError;

    if (!response.ok) {
      const message = "error" in body ? body.error.message : `Read failed: ${url}`;
      throw new HttpReadError(message, response.status);
    }
    if (!("data" in body)) {
      throw new HttpReadError(`Invalid read response: ${url}`, response.status);
    }

    return body.data;
  }
}
