import test from "node:test";
import assert from "node:assert/strict";

import { ClientDataBootstrapService } from "@/src/shared/application/client-data-bootstrap/ClientDataBootstrapService";

test("ClientDataBootstrapService sikeres inicializálásnál ok resultot ad", async () => {
  const service = new ClientDataBootstrapService(async () => true);

  const result = await service.bootstrap();

  assert.deepEqual(result, { ok: true, error: "" });
});

test("ClientDataBootstrapService sikertelen inicializálást stabil hibává alakít", async () => {
  const service = new ClientDataBootstrapService(async () => false);

  const result = await service.bootstrap();

  assert.equal(result.ok, false);
  assert.match(result.error, /Failed to initialize client data/);
});

test("ClientDataBootstrapService inicializálási kivételt stabil hibává alakít", async () => {
  const service = new ClientDataBootstrapService(async () => {
    throw new Error("network down");
  });

  const result = await service.bootstrap();

  assert.equal(result.ok, false);
  assert.match(result.error, /Exception during client data bootstrap/);
});
