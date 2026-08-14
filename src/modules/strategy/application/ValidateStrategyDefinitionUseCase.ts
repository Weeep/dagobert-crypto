import { validateStrategyDefinition } from "../domain/StrategyDefinition";

export class ValidateStrategyDefinitionUseCase {
  execute(definition: unknown, schemaVersion = 1) {
    return validateStrategyDefinition(definition, schemaVersion);
  }
}
