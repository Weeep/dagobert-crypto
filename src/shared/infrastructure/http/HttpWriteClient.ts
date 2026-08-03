import type { ReadApiError, ReadApiSuccess } from "../../dto/ReadApiResponse";
import { HttpReadError, type FetchLike } from "./HttpReadClient";

export class HttpWriteClient {
  constructor(private readonly fetchImplementation: FetchLike = globalThis.fetch) {}

  async put<T>(url: string, body: unknown): Promise<T> {
    return this.request<T>(url, "PUT", body);
  }

  async delete<T>(url: string): Promise<T> {
    return this.request<T>(url, "DELETE");
  }

  private async request<T>(url: string, method: "PUT" | "DELETE", body?: unknown) {
    const dataSource =
      typeof window !== "undefined" &&
      window.localStorage.getItem("dagobert-read-data-source") === "postgres"
        ? "postgres"
        : "redis";
    const response = await this.fetchImplementation.call(globalThis, url, {
      method,
      headers: {
        Accept: "application/json",
        "X-Dagobert-Data-Source": dataSource,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const responseBody = (await response.json()) as ReadApiSuccess<T> | ReadApiError;

    if (!response.ok) {
      const message =
        "error" in responseBody ? responseBody.error.message : `Write failed: ${url}`;
      throw new HttpReadError(message, response.status);
    }
    if (!("data" in responseBody)) {
      throw new HttpReadError(`Invalid write response: ${url}`, response.status);
    }
    return responseBody.data;
  }
}
