import React, { useState } from "react";
import Papa from "papaparse";
import type { BnceTradeHisFromCsv } from "@/src/modules/transaction/dto/legacy/BnceTradeHisFromCsv";
import { TradeType } from "@/src/modules/transaction";
import { clientUseCases } from "@/src/shared/composition/clientUseCases";
import { isBnceTradeHisFromCsvArray } from "@/utils/helper";

const importTransactionsFromLegacyCsvUseCase =
  clientUseCases.importTransactionsFromLegacyCsv;

//Record<string, string>; // Defines the type for each row in the CSV

const CsvParse: React.FC = () => {
  const [csvData, setCsvData] = useState<BnceTradeHisFromCsv[]>([]);
  const [info, setInfo] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setInfo("No file selected");
      return;
    }

    setInfo(null); // Clear any previous errors

    Papa.parse(file, {
      header: true, // Use the first row as keys for the objects
      skipEmptyLines: true,
      complete: async (result) => {
        if (
          result.errors.length > 0 ||
          !isBnceTradeHisFromCsvArray(result.data)
        ) {
          setInfo("Error parsing CSV file.");
        } else {
          await importTransactionsFromLegacyCsvUseCase.execute(
            result.data as BnceTradeHisFromCsv[],
            TradeType.Spot //TODO
          );

          setCsvData(result.data as BnceTradeHisFromCsv[]);
        }
      },
      error: (error) => {
        setInfo("Error reading file: " + error.message);
      },
    });
  };

  return (
    <div className="min-h-screen p-6 bg-gray-400">
      <h1 className="text-2xl font-bold mb-4">Upload and Read CSV</h1>
      <div>Only SPOT order history supported</div>
      <input
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="mb-4 p-2 border border-gray-400 rounded"
      />
      {info && <p className="text-black">{info}</p>}
      {csvData.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Parsed Data:</h2>
          <pre className="bg-black p-4 rounded shadow">
            {JSON.stringify(csvData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default CsvParse;
