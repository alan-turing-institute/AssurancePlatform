import React, { useCallback, useEffect, useMemo, useState } from "react";
import mermaid from "mermaid";
import "./Mermaid.scss";
import { jsonToMermaid } from "@/utils";

/**
 * MermaidChart is a component for rendering assurance case diagrams using the Mermaid library. It takes a JSON representation of an assurance case and renders it as a flowchart.
 *
 * @param {Object} props - Component props.
 * @param {string} props.caseId - The ID of the assurance case to render.
 * @param {Object} props.assuranceCase - The JSON representation of the assurance case to render.
 * @param {string} props.selectedId - The ID of the currently selected node in the assurance case.
 * @param {string} props.selectedType - The type of the currently selected node in the assurance case.
 * @param {Function} props.setSelected - A function to set the currently selected node in the assurance case.
 * @param {Function} props.setMermaidFocus - A function to set the focus state of the Mermaid chart.
 * @returns {JSX.Element} A Mermaid chart component.
 */
function MermaidChart({
  caseId,
  assuranceCase,
  selectedId,
  selectedType,
  setSelected,
  setMermaidFocus,
}: any) {
  const [collapsedNodes, setCollapsedNodes] = useState([]);

  /**
   * Convert the assurance case to a Mermaid markdown representation.
   *
   * @type {string}
   * @returns {string} The Mermaid markdown representation of the assurance case.
   */
  const chartmd = useMemo(() => {

    const json = jsonToMermaid(
      assuranceCase,
      selectedType,
      selectedId,
      collapsedNodes,
    );
    console.log('JSON', json)
    return json
  }, [assuranceCase, selectedType, selectedId, collapsedNodes]);

  /**
   * Refresh the state of the collapsed nodes when the assurance case changes.
   *
   * @returns {void}
   */
  useEffect(() => {
    setCollapsedNodes([]);
  }, [caseId]);

  /**
   * Initialize the Mermaid library.
   *
   * @returns {void}
   */
  useEffect(() => {
    mermaid.initialize({
      theme: "base",
      logLevel: 1,
      securityLevel: "loose",
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: "linear",
      },
      themeVariables: {
        primaryColor: "#ffffff",
        nodeBorder: "#000000",
        defaultLinkColor: "#004990",
        fontFamily: "arial",
      },
    });
  }, []);

  /**
   * Set the selected node when a node is clicked in the Mermaid chart.
   */
  // useEffect(() => {
  //   window.callback = (e: any) => {
  //     setMermaidFocus((tog: any) => !tog);
  //     let chunks = e.split("_");
  //     if (chunks.length === 2) {
  //       const [itemType, itemId] = chunks;

  //       setSelected([itemId, itemType]);
  //     }
  //   };
  // }, [setSelected, setMermaidFocus]);

  /**
   * Handle the collapse/expand button click event.
   *
   * @param {MouseEvent} e - The click event.
   * @returns {void}
   */
  const onCollapseButtonClick = useCallback((e: any) => {
    const nodeKey = e.target?.dataset?.key;
    if (nodeKey == null) {
      return;
    }

    setCollapsedNodes((collapsedNodes) => {
      let newArray: any = collapsedNodes.filter((k) => k !== nodeKey);
      if (newArray.length === collapsedNodes.length) {
        newArray.push(nodeKey);
      }
      return newArray;
    });

    // don't fire click event on node itself
    e.stopPropagation();
  }, []);

  /**
   * Trigger a re-render of the Mermaid chart when the markdown content changes.
   *
   * @returns {void}
   * @throws {Error} If the Mermaid div is not found.
   * @throws {Error} If there is an error rendering the Mermaid chart.
   */
  useEffect(() => {
    try {
      const mermaidDiv = document.querySelector(`.mermaid-${caseId}`);
      if (mermaidDiv) {
        // inject the markdown here, rather than via react
        // so in between render and the effect you don't see the text

        // make sure to use textContent and not innerHtml, as our markdown can contain html
        mermaidDiv.textContent = ""; // Clear the existing content
        mermaidDiv.textContent = chartmd; // Set new markdown content
        mermaid.contentLoaded(); // Inform Mermaid to process the new content

        const collapseButtons = document.querySelectorAll(".collapse-expand");
        collapseButtons.forEach((button) =>
          button.addEventListener("click", onCollapseButtonClick),
        );
      } else {
        console.error("Mermaid div not found");
      }
    } catch (error) {
      console.error("Error rendering Mermaid chart:", error);
    }
  }, [chartmd, onCollapseButtonClick]);

  return (
    <div
      key={chartmd}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        justifyContent: "start",
        alignItems: "start",
        overflow: "visible",
      }}
      className={`mermaid-${caseId} mermaid`}
    />
  );
}

export default MermaidChart;
