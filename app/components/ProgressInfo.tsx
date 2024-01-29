import React from 'react';

interface Props {
  info: string;
}

const ProgressInfo: React.FC<Props> = ({ info }) => {
  return (
    <div>
      <h1>Progress Info</h1>
      <pre>{info}</pre>
    </div>
  );
};

export default ProgressInfo;
