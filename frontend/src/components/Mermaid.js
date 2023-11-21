import React from "react";
import mermaid from "mermaid";

class MermaidChart extends React.Component {
  componentDidMount() {
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
    mermaid.contentLoaded();

    // Observe changes to the Mermaid div and apply styles once the content is loaded
    const mermaidDiv = document.querySelector(".mermaid");
    if (mermaidDiv) {
      const observer = new MutationObserver((mutations, obs) => {
        for (let mutation of mutations) {
          if (mutation.addedNodes.length) {
            mutation.addedNodes[0].style["max-height"] = "100%";
            obs.disconnect(); // Stop observing after applying styles
            break;
          }
        }
      });

      observer.observe(mermaidDiv, { childList: true });
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
