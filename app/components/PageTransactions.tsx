import { useState } from "react";
import DTransactionCardContainer from "./DTransactionCardContainer";
import PairsAndPrices from "./PairsAndPrices";
import DTransactionGroupContainer from "./DTransactionGroupContainer";

const PageTransactions = () => {
  const [newDtransactionGroupEpoch, setNewDtransactionGroupEpoch] =
    useState<number>(0);
  const [pairsAndPrices, setPairsAndPrices] = useState<{
    [key: string]: {
      price: number;
      numOfTransactions: number;
    };
  }>({}); //TODO move symbolPrices to PairsAndPrices and rename it to pair
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);

  return (
    <div className="mx-auto">
      <PairsAndPrices
        pairsAndPricesCallback={setPairsAndPrices}
        selectedPairsCallback={setSelectedPairs}
      />

      <DTransactionCardContainer
        selectedPairs={selectedPairs}
        pairsAndPrices={pairsAndPrices}
        newDtransactionGroupEpochCallback={setNewDtransactionGroupEpoch}
      />

      <DTransactionGroupContainer
        newDtransactionGroupEpoch={newDtransactionGroupEpoch}
      />
    </div>
  );
};

export default PageTransactions;
