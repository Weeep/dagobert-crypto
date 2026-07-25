"use client";

import React, { useEffect, useState } from "react";
import { clientUseCases } from "@/src/shared/composition/clientUseCases";

const listPairsUseCase = clientUseCases.listPairs;
const listOpenTransactionsUseCase = clientUseCases.listOpenTransactions;
const listTransactionGroupsUseCase = clientUseCases.listTransactionGroups;

const DTransAdminPage: React.FC = () => {
  const [infoStr, setInfoStr] = useState<string>("Loading admin diagnostics...");

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const loadDiagnostics = async () => {
    try {
      const [pairs, openTransactions, transactionGroups] = await Promise.all([
        listPairsUseCase.execute(),
        listOpenTransactionsUseCase.execute(),
        listTransactionGroupsUseCase.execute(),
      ]);

      setInfoStr(
        JSON.stringify(
          {
            pairs: pairs.length,
            openTransactions: openTransactions.length,
            transactionGroups: transactionGroups.length,
            pairSymbols: pairs.map((pair) => pair.pair),
          },
          null,
          2
        )
      );
    } catch (error) {
      setInfoStr(
        error instanceof Error ? error.message : "Failed to load admin diagnostics"
      );
    }
  };

  return (
    <div className="flex space-x-5 flex-wrap">
      <pre>{infoStr}</pre>
    </div>
  );
};

export default DTransAdminPage;
