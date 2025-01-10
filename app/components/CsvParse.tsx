import React, { useState } from "react";
import Papa from "papaparse";
import { BnceTradeHisFromCsv } from "@/utils/typesAndEnums";
import Dtransactions from "./dtransactions";

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
        if (result.errors.length > 0) {
          setInfo("Error parsing CSV file.");
        } else {
          Dtransactions.post(
            "binancecsv",
            result.data as BnceTradeHisFromCsv[]
          );
          /*
          try {
            const dbResponse = await fetch("/api/dbapi/dtransactions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "binanceCsv",
                data: result.data as BnceTradeHisFromCsv[],
              }),
            });

            if (!dbResponse.ok) {
              const resp = await dbResponse.json();
              throw dbResponse.status + ": " + JSON.stringify(resp);
            } else {
              setInfo(
                "Database update done." +
                  JSON.stringify(await dbResponse.json())
              );
            }
          } catch (error) {
            setInfo("Failed to store dtransaction from csv");
            console.error("Failed to store dtransaction from csv", error);
          }
            */

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
