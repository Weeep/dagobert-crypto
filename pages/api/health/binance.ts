import { binanceClient } from "@/utils/binanceapiutil";
import { createBinanceHealthHandler } from "@/src/shared/infrastructure/http/binanceHealthHandler";
import { withAuth } from "@/utils/auth";

export default withAuth(createBinanceHealthHandler(binanceClient));
