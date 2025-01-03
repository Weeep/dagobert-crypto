import React, { useState } from "react";
import Papa from "papaparse";

type BnceTrade = {
  "Date(UTC)": string; //"1/2/2025 7:34",
  Pair: string; //"POLUSDC",
  Side: string; //"BUY",
  Price: string; //"0.484",
  Executed: string; //"12POL",
  Amount: string; //"5.808USDC",
  Fee: string; //"0.00000615BNB"
};

//Record<string, string>; // Defines the type for each row in the CSV

const CsvParse: React.FC = () => {
  const [csvData, setCsvData] = useState<BnceTrade[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setError("No file selected");
      return;
    }

    setError(null); // Clear any previous errors

    Papa.parse(file, {
      header: true, // Use the first row as keys for the objects
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          setError("Error parsing CSV file.");
        } else {
          setCsvData(result.data as BnceTrade[]);
        }
      },
      error: (error) => {
        setError("Error reading file: " + error.message);
      },
    });
  };

  return (
    <div className="min-h-screen p-6 bg-gray-400">
      <h1 className="text-2xl font-bold mb-4">Upload and Read CSV</h1>
      <input
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="mb-4 p-2 border border-gray-400 rounded"
      />
      {error && <p className="text-red-500">{error}</p>}
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
