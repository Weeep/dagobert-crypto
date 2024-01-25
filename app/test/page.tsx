'use client'

import React, { useState, useEffect } from 'react';

const TestPage: React.FC = () => {
    console.log('test')
  const [apiResponse, setApiResponse] = useState<string | null>(null);

  useEffect(() => {
    setApiResponse("5");
    /*
    const fetchData = async () => {
      try {
        const response = await fetch('/api/hello');
        const data = await response.json();
        console.log(data)
        setApiResponse(data.message);
      } catch (error: any) {
        console.error('Error fetching data:', error.message);
      }
    };

    fetchData();*/
  }, []); // Empty dependency array ensures the effect runs only once, similar to componentDidMount

  return (
    <div>
      <h1>API Response:</h1>
      <p>{apiResponse}</p>
    </div>
  );
};

export default TestPage;
