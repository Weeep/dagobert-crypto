import type { StrategyDefinitionV1 } from "./StrategyDefinition";

export type StrategyVersion = {
  id: string;
  strategyId: string;
  version: number;
  schemaVersion: number;
  definition: StrategyDefinitionV1;
  createdAt: Date;
};

export type Strategy = {
  id: string;
  userId: string;
  name: string;
  description: string;
  versions: StrategyVersion[];
  createdAt: Date;
  updatedAt: Date;
};
