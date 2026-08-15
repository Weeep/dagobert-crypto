process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: "commonjs" });
require("dotenv/config");
require("ts-node/register");
require("tsconfig-paths/register");
require("./integration/prisma-connection.test.ts");

require("./integration/prisma-pair-repository.test.ts");
require("./integration/prisma-transaction-repository.test.ts");
require("./integration/prisma-transaction-group-repository.test.ts");
require("./integration/prisma-bot-lifecycle.test.ts");
require("./integration/prisma-bot-budget-concurrency.test.ts");
require("./integration/prisma-candle-ingestion.test.ts");
require("./integration/prisma-market-data-polling.test.ts");
require("./integration/prisma-strategy-evaluation.test.ts");
require("./integration/prisma-backtest-persistence.test.ts");
