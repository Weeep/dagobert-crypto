import ClientSideDbCache from "@/app/lib/ClientSideDbCache";

export type ClientDataBootstrapResult =
  | { ok: true; error: "" }
  | { ok: false; error: string };

export type ClientDataInitializer = () => Promise<boolean>;

export class ClientDataBootstrapService {
  constructor(
    private readonly initializeClientData: ClientDataInitializer = () =>
      ClientSideDbCache.initializeCache()
  ) {}

  async bootstrap(): Promise<ClientDataBootstrapResult> {
    try {
      const success = await this.initializeClientData();
      if (!success) {
        return { ok: false, error: "Failed to initialize client data." };
      }

      return { ok: true, error: "" };
    } catch (error) {
      return {
        ok: false,
        error: "Exception during client data bootstrap: " + JSON.stringify(error),
      };
    }
  }
}
