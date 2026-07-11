"use client";

import { useState } from "react";
//import { motion, AnimatePresence } from "framer-motion";
//import { useDrag } from "react-use-gesture";

import { motion, AnimatePresence } from "framer-motion";
import { useDrag } from "@use-gesture/react";
import PageConfig from "../components/pageConfig/PageConfig";
import Charts from "../components/Charts";
import CircleInvasion from "../components/CircleInvasion";

const menuItems = [
  { name: "Config", component: <PageConfig /> },
  { name: "Charts", component: <Charts /> },
  { name: "CircleInvasion", component: <CircleInvasion /> },
];
export default function Home() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const swipeLeft = () => {
    setCurrentIndex((prev) => (prev + 1) % menuItems.length);
  };

  const swipeRight = () => {
    setCurrentIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
  };

  const bind = useDrag(({ velocity: [vx], direction: [xDir] }) => {
    if (vx > 0.2) {
      if (xDir > 0) swipeRight();
      else swipeLeft();
    }
  });

  return (
    <div className="flex flex-col items-center justify-center h-screen overflow-hidden">
      <div
        {...bind()}
        style={{ touchAction: "none" }}
        className="relative flex items-center justify-center w-4/5 h-1/2 overflow-hidden border border-gray-300 rounded-lg"
      >
        <AnimatePresence initial={false} custom={currentIndex}>
          <motion.div
            key={currentIndex}
            custom={currentIndex}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.5 }}
            className="absolute flex items-center justify-center w-full h-full text-2xl font-bold bg-gray-200 rounded-lg shadow-md"
          >
            {menuItems[currentIndex].component}{" "}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-5">
        <button
          onClick={swipeRight}
          className="px-4 py-2 mx-2 text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          Previous
        </button>
        <button
          onClick={swipeLeft}
          className="px-4 py-2 mx-2 text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          Next
        </button>
      </div>
    </div>
  );
}
