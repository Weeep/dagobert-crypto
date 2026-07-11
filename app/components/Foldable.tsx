import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState, useEffect, ReactElement } from "react";

interface Props {
  children: React.ReactNode;
  title: ReactElement;
  isOpenByDefault: boolean;
  className?: string;
}

const Foldable: React.FC<Props> = ({
  children,
  title,
  isOpenByDefault,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(isOpenByDefault);

  return (
    <div className={`cursor-pointer ${className}`}>
      <h1
        onClick={() => setIsOpen(!isOpen)}
        className="flex flex-row items-center"
      >
        <FontAwesomeIcon
          icon={faChevronRight}
          className={`transform transition-transform duration-300 ${
            isOpen ? "rotate-90" : "rotate-0"
          }`}
        />{" "}
        {title}
      </h1>

      <div className={`${!isOpen ? "hidden" : ""}`}>{children} </div>
    </div>
  );
};

export default Foldable;
