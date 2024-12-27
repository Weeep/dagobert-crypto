import { useState } from "react";

export default function Config() {
  const [items, setItems] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");

  const handleAdd = () => {
    if (inputValue.trim()) {
      setItems([...items, inputValue]);
      setInputValue("");
    }
  };

  return (
    <div className="text-center">
      <h1 className="text-4xl font-semibold mb-4">Config</h1>
      <div className="mb-4">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="px-4 py-2 border border-gray-700 rounded bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="Add item"
        />
        <button
          onClick={handleAdd}
          className="ml-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-gray-100 rounded transition-colors"
        >
          Add
        </button>
      </div>
      <div className="flex space-x-2 ml-4 mt-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="bg-gray-300 text-gray-800 flex space-x-2 rounded-full p-2"
          >
            <div>{item}</div>
            <button className="text-red-400 font-bold">X</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// export default function Config() {
//   return (
//     <>
//       <h1 className="text-3xl font-bold mb-4">Config</h1>

//       <div>
//         <div className="text-2xl font-semibold">Followed pairs</div>
//         <div className="flex space-x-2 ml-4 mt-2">
//           <div className="bg-gray-300 text-gray-800 flex space-x-2 rounded-full p-2">
//             <div>DOTUSDT</div>
//             <button className="text-red-400 font-bold">X</button>
//           </div>
//           <div className="bg-gray-300 text-gray-800 flex space-x-2 rounded-full p-2">
//             <div>SOLUSDT</div>
//             <button>X</button>
//           </div>
//         </div>
//       </div>

//       <h2 className="text-1xl">almafa</h2>
//       <h2>almafa</h2>
//       <div>almafa</div>
//     </>
//   );
// }
