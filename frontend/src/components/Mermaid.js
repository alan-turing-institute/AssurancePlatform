import React from "react"
//import Mermaid from "mermaid"
import mermaid from "mermaid"


class Mermaid extends React.Component {

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
    window.callback = e => this.props.editLayerFunc(e)
    mermaid.contentLoaded();
  }
  render() {
    return <div className="mermaid">{this.props.chart}</div>;
  }
}

const keywords = [
  "Goal",
  "Context",
  "System Description",
  "Property Claim",
  "Argument"
];

class MermaidChart extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      keywords: [],
      keyphrases: []
    };
  }

  componentDidMount() {

    for (let kwrd of keywords) {
      if (kwrd.indexOf(" ") >= 0) {
        this.setState((prevState) => ({
          keyphrases: [...prevState.keyphrases, kwrd]
        }));
      } else {
        this.setState((prevState) => ({
          keywords: [...prevState.keywords, kwrd]
        }));
      }
    }
  }
  callback(message) {
    console.log(message)
    alert('For example you can display an alert!');
  }

  render() {
    return (
      <div className="App" >
        <Mermaid
          editLayerFunc={e => this.props.editLayerFunc(e)}
          chart={this.props.chartmd}
        />
      </div >
    );
  }
}


//example mermaid graph:
// `graph TB;
// A[${this.state.keywords.length > 0 ? this.state.keywords[0] : "Goal"
// }] --> B{Context}
// A--> |keyword| E(<font color=white> System or Project Property Claim)
// A--> D{System Description}
// E--> F(Argument)
// F--> G(Evidential Claim)
// G--> |${Similarity}| H[(Evidence)]
// style A fill:#f9f, stroke:#333, stroke-width:3px,  padding:250px
// `

export default MermaidChart;

