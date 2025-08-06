import { useState } from "react";

const PageBot = () => {
  const [newDtransactionGroupEpoch, setNewDtransactionGroupEpoch] =
    useState<number>(0);
  const [pairsAndPrices, setPairsAndPrices] = useState<{
    [key: string]: {
      price: number;
      numOfTransactions: number;
    };
  }>({});
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);

  return <div className="mx-auto">Bot</div>;
};

export default PageBot;
