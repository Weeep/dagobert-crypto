// components/TestComponent.tsx

import React from 'react';

interface TestComponentProps {
  result: any; // Adjust the type based on the actual structure of your result
}

const TestComponent: React.FC<TestComponentProps> = ({ result }) => {
  return (
    <div>
      <h1>Test Component</h1>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
};

export default TestComponent;
