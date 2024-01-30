import React, { useCallback, useEffect, useMemo, useState } from "react";
import mermaid from "mermaid";
import "./Mermaid.scss";
import { jsonToMermaid } from "./utils";

function MermaidChart({
  caseId,
  assuranceCase,
  selectedId,
  selectedType,
  setSelected,
  setMermaidFocus,
}) {
  const [collapsedNodes, setCollapsedNodes] = useState([]);

  const chartmd = useMemo(() => {
    return jsonToMermaid(
      assuranceCase,
      selectedType,
      selectedId,
      collapsedNodes,
    );
  }, [assuranceCase, selectedType, selectedId, collapsedNodes]);

  // refresh state
  useEffect(() => {
    setCollapsedNodes([]);
  }, [caseId]);

  // initialise mermaid
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

  // set click callback
  useEffect(() => {
    window.callback = (e) => {
      setMermaidFocus((tog) => !tog);
      let chunks = e.split("_");
      if (chunks.length === 2) {
        const [itemType, itemId] = chunks;

        setSelected([itemId, itemType]);
      }
    };
  }, [setSelected, setMermaidFocus]);

  const onCollapseButtonClick = useCallback(
    /** @param {MouseEvent} e  */ (e) => {
      const nodeKey = e.target?.dataset?.key;
      if (nodeKey == null) {
        return;
      }

      setCollapsedNodes((collapsedNodes) => {
        let newArray = collapsedNodes.filter((k) => k !== nodeKey);
        if (newArray.length === collapsedNodes.length) {
          newArray.push(nodeKey);
        }
        return newArray;
      });

      // don't fire click event on node itself
      e.stopPropagation();
    },
    [],
  );

  // trigger mermaid reload
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
