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
        curve: "linear", //d3 styles: http://bl.ocks.org/d3indepth/b6d4845973089bc1012dec1674d3aff8
      },
      themeVariables: {
        primaryColor: "#ffffff",
        //background: "#ffffff",
        nodeBorder: "#000000",
        //nodeTextColor: "#274059",
        defaultLinkColor: "#004990",
        fontFamily: "arial",
      },
    });
    window.callback = (e) => this.props.viewLayerFunc(e);
    mermaid.contentLoaded();
    // This is the height-equivalent of the above `useMaxWidth: true` bit.
    // It gets the div created in `render` and its first (and only) child node, which is
    // the SVG figure.
    // TODO The document.getElementsByClassName certainly isn't elegant. I tried using a
    // ref, but that failed because componentDidMount gets called before the first
    // render. Better ideas welcome.
    document.getElementsByClassName("mermaid")[0].childNodes[0].style[
      "max-height"
    ] = "100%";
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
