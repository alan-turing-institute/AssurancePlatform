import React, { useState, useEffect } from 'react';
import InteractiveCaseViewer from './InteractiveCaseViewer';

/**
 * Wrapper component that loads case data from static folder and renders InteractiveCaseViewer
 * This solves the issue of JSON imports not working in Docusaurus
 */
const CaseViewerWrapper = ({
  caseFile = 'fair-recruitment-ai.json',
  showAllNodes = false,
  enableExploration = true,
  onNodeClick = null,
  guidedPath = [],
  highlightedNodes = []
}) => {
  const [caseData, setCaseData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadCaseData = async () => {
      try {
        // Get the base path from the current location
        // In Docusaurus, static files are served from /documentation/data/
        const response = await fetch(`/documentation/data/${caseFile}`);
        if (!response.ok) {
          throw new Error(`Failed to load case data: ${response.statusText}`);
        }
        const data = await response.json();
        setCaseData(data);
        setError(null);
      } catch (err) {
        console.error(`Error loading case file '${caseFile}':`, err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadCaseData();
  }, [caseFile]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-96 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <div className="inline-block mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
          </div>
          <p className="text-gray-600 dark:text-gray-400">Loading assurance case...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg">
        <h3 className="font-bold text-red-700 dark:text-red-400 mb-2">Error Loading Case Data</h3>
        <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
        <p className="text-red-500 dark:text-red-400 text-xs mt-2">
          Tried to load: /documentation/data/{caseFile}
        </p>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="w-full p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-800 rounded-lg">
        <h3 className="font-bold text-yellow-700 dark:text-yellow-400">No Data Available</h3>
        <p className="text-yellow-600 dark:text-yellow-300 text-sm">
          No case data was loaded.
        </p>
      </div>
    );
  }

  return (
    <InteractiveCaseViewer
      caseData={caseData}
      showAllNodes={showAllNodes}
      enableExploration={enableExploration}
      onNodeClick={onNodeClick}
      guidedPath={guidedPath}
      highlightedNodes={highlightedNodes}
    />
  );
};

export default CaseViewerWrapper;
