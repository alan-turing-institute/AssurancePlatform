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
    // Clear the existing content of the Mermaid div before rendering the new chart
    const mermaidDiv = document.querySelector(".mermaid");
    if (mermaidDiv) {
      mermaidDiv.innerHTML = this.props.chartmd;
      mermaid.contentLoaded();
    } else {
      console.error("Mermaid div not found");
    }
  }

  render() {
    return (
      <div style={{ width: "100%", height: "100%" }} className="mermaid">
        {this.props.chartmd}
      </div>
    );
  }
}

export default MermaidChart;
