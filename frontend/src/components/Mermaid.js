import React from "react"
import mermaid from "mermaid"

class MermaidChart extends React.Component {

  componentDidMount() {
    mermaid.initialize({
      theme: 'base',
      logLevel: 1,
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'linear', //d3 styles: http://bl.ocks.org/d3indepth/b6d4845973089bc1012dec1674d3aff8
      },
      themeVariables: {
        primaryColor: "#ffffff",
        //background: "#ffffff",
        nodeBorder: "#000000",
        //nodeTextColor: "#274059",
        defaultLinkColor: "#004990",
        fontFamily: "arial",

      }
    });
    window.callback = e => this.props.viewLayerFunc(e)
    mermaid.contentLoaded();
  }

  render() {
    return <div className="mermaid">{this.props.chartmd}</div>
  }
}

export default MermaidChart;
