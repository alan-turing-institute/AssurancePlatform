import React from "react";
import mermaid from "mermaid";
import "./Mermaid.css";

class MermaidChart extends React.Component {
  componentDidMount() {
    this.initializeMermaid();
    this.renderChart();
  }

  componentDidUpdate(prevProps) {
    // Check if the chartmd prop has changed
    if (prevProps.chartmd !== this.props.chartmd) {
      this.renderChart();
    }
  }

  initializeMermaid() {
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

    window.callback = (e) => this.props.viewLayerFunc(e);
  }

  /** @param {MouseEvent} e  */
  onCollapseButtonClick(e) {
    const data = e.target?.dataset?.["key"];
    if (data == null) {
      return;
    }
    this.props.toggleCollapseLayerFunc(data);

    // don't fire click event on node itself
    e.stopPropagation();
  }

  renderChart() {
    try {
      const mermaidDiv = document.querySelector(".mermaid");
      if (mermaidDiv) {
        // make sure to use textContent and not innerHtml, as our markdown can contain html
        mermaidDiv.textContent = ""; // Clear the existing content
        mermaidDiv.textContent = this.props.chartmd; // Set new markdown content
        mermaid.contentLoaded(); // Inform Mermaid to process the new content

        var collapseButtons = document.querySelectorAll(".collapse-expand");
        collapseButtons.forEach((button) =>
          button.addEventListener("click", (e) =>
            this.onCollapseButtonClick(e),
          ),
        );
      } else {
        console.error("Mermaid div not found");
      }
    } catch (error) {
      console.error("Error rendering Mermaid chart:", error);
    }
  }

  render() {
    return (
      <div style={{ width: "100%", height: "100%" }} className="mermaid" />
    );
  }
}

export default MermaidChart;
