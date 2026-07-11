"use client";

import React, { useEffect, useState } from "react";
import { ClientDataBootstrapService } from "@/src/shared/application/client-data-bootstrap/ClientDataBootstrapService";
import { KvPairRepository, ListPairsUseCase } from "@/src/modules/pair";
import {
  KvTransactionRepository,
  ListOpenTransactionsUseCase,
} from "@/src/modules/transaction";
import {
  KvTransactionGroupRepository,
  ListTransactionGroupsUseCase,
} from "@/src/modules/transaction-group";

const pairRepository = new KvPairRepository();
const transactionRepository = new KvTransactionRepository();
const transactionGroupRepository = new KvTransactionGroupRepository();
const clientDataBootstrapService = new ClientDataBootstrapService();
const listPairsUseCase = new ListPairsUseCase(pairRepository);
const listOpenTransactionsUseCase = new ListOpenTransactionsUseCase(
  transactionRepository
);
const listTransactionGroupsUseCase = new ListTransactionGroupsUseCase(
  transactionGroupRepository
);

const DTransAdminPage: React.FC = () => {
  const [infoStr, setInfoStr] = useState<string>("Loading admin diagnostics...");

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const loadDiagnostics = async () => {
    const bootstrapResult = await clientDataBootstrapService.bootstrap();
    if (!bootstrapResult.ok) {
      setInfoStr(bootstrapResult.error);
      return;
    }

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
  };

  return (
    <div className="flex space-x-5 flex-wrap">
      <pre>{infoStr}</pre>
    </div>
  );
};

export default DTransAdminPage;
