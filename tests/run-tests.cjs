process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'commonjs' });
require('ts-node/register');
require('tsconfig-paths/register');
require('./application/transactions.test.ts');
require('./application/pairs.test.ts');
require('./application/transaction-groups.test.ts');
require('./application/client-data-bootstrap.test.ts');
