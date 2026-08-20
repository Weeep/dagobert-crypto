import type { StrategyDto } from "@/src/modules/strategy/dto/StrategyDto";
import type { StrategyDefinitionV1, StrategyValidationIssue } from "@/src/modules/strategy/domain/StrategyDefinition";

type StrategyVersionDto = StrategyDto["versions"][number];
type ApiError = { error?: { message?: string } };

export class StrategyApiClient {
  constructor(private readonly fetchImplementation: typeof fetch = globalThis.fetch) {}

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImplementation.call(globalThis, url, {
      ...init, headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    });
    const body = (response.status === 204 ? {} : await response.json()) as T & ApiError;
    if (!response.ok) throw new Error(body.error?.message ?? `Strategy API request failed (${response.status})`);
    return body;
  }

  async list() {
    return (await this.request<{ strategies: StrategyDto[] }>("/api/strategies")).strategies;
  }

  async validate(definition: StrategyDefinitionV1) {
    const response = await this.fetchImplementation.call(globalThis, "/api/strategies/validate", {
      method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ schemaVersion: definition.schemaVersion, definition }),
    });
    const body = await response.json() as { valid: boolean; definition: StrategyDefinitionV1 | null;
      issues: StrategyValidationIssue[]; error?: { message: string } };
    if (response.status === 401 || response.status >= 500) throw new Error(body.error?.message ?? "Validation failed");
    return body;
  }

  async create(name: string, description: string, definition: StrategyDefinitionV1) {
    return (await this.request<{ strategy: StrategyDto }>("/api/strategies", {
      method: "POST", body: JSON.stringify({ name, description, schemaVersion: 1, definition }),
    })).strategy;
  }

  async addVersion(strategyId: string, definition: StrategyDefinitionV1) {
    return (await this.request<{ version: StrategyVersionDto }>(`/api/strategies/${encodeURIComponent(strategyId)}/versions`, {
      method: "POST", body: JSON.stringify({ schemaVersion: 1, definition }),
    })).version;
  }

  async update(strategyId: string, patch: { name?: string; description?: string; archived?: boolean }) {
    return (await this.request<{ strategy: StrategyDto }>(`/api/strategies/${encodeURIComponent(strategyId)}`, {
      method: "PATCH", body: JSON.stringify(patch),
    })).strategy;
  }

  async delete(strategyId: string) {
    await this.request<unknown>(`/api/strategies/${encodeURIComponent(strategyId)}`, { method: "DELETE" });
  }
}
