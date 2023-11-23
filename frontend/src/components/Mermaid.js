import React from "react";
import mermaid from "mermaid";

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

  renderChart() {
    try {
      const mermaidDiv = document.querySelector(".mermaid");
      if (mermaidDiv) {
        mermaidDiv.innerHTML = ''; // Clear the existing content
        mermaidDiv.innerHTML = this.props.chartmd; // Set new markdown content
        mermaid.contentLoaded(); // Inform Mermaid to process the new content
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
