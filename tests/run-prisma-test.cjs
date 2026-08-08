process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: "commonjs" });
require("dotenv/config");
require("ts-node/register");
require("tsconfig-paths/register");
require("./integration/prisma-connection.test.ts");

require("./integration/prisma-pair-repository.test.ts");
require("./integration/prisma-transaction-repository.test.ts");
require("./integration/prisma-transaction-group-repository.test.ts");
require("./integration/prisma-bot-lifecycle.test.ts");
