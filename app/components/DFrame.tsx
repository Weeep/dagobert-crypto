import { useState, useEffect } from "react";

interface Props {
  children: React.ReactNode;
  errorMessage: string;
  errorEpoch: number;
  className?: string;
}

const DFrame: React.FC<Props> = ({
  children,
  errorMessage,
  errorEpoch,
  className = "",
}) => {
  const [isOpacity, setIsOpacity] = useState(false);
  const [isHidden, setHidden] = useState(true);

  useEffect(() => {
    if (errorMessage === "") {
      setIsOpacity(false);
      setHidden(true);
    } else {
      setHidden(false);
      const timeout = setTimeout(() => {
        setIsOpacity(true);
      }, 10); // Slight delay for animation
      return () => clearTimeout(timeout);
    }
  }, [errorEpoch]);

  const handleErrorXClick = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.stopPropagation();
    setIsOpacity(false);
    setHidden(true);
  };

  return (
    <div className={className}>
      {children}
      <div
        className={`fixed bottom-2 right-0 left-0 z-40 mx-auto w-3/4 p-6 rounded bg-red-500 text-white transition-opacity duration-500 ${
          isOpacity ? "opacity-100" : "opacity-0"
        } ${isHidden ? "hidden" : ""}`}
      >
        <div className="w-full text-right ">
          <button onClick={(event) => handleErrorXClick(event)}>X</button>
        </div>
        <div className="break-words">{errorMessage}</div>
      </div>
    </div>
  );
};

export default DFrame;
