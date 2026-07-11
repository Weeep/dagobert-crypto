import React from "react";

interface Props {
  info: string;
}

const ProgressInfo: React.FC<Props> = ({ info }) => {
  return (
    <div>
      <div>{info}</div>
    </div>
  );
};

export default ProgressInfo;
