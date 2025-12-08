import { useState, useEffect } from 'react';

/**
 * Custom hook to load case data from the static folder
 * @param {string} fileName - The name of the JSON file in /data/ (e.g., 'fair-recruitment-ai.json')
 * @returns {Object} { data, isLoading, error }
 */
export const useCaseData = (fileName) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const basePath = window.location.pathname.split('/').slice(0, -1).join('/');
        const response = await fetch(`${basePath}/data/${fileName}`);
        if (!response.ok) {
          throw new Error(`Failed to load ${fileName}: ${response.statusText}`);
        }
        const jsonData = await response.json();
        setData(jsonData);
        setError(null);
      } catch (err) {
        console.error(`Error loading case data: ${err.message}`);
        setError(err.message);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [fileName]);

  return { data, isLoading, error };
};

export default useCaseData;
