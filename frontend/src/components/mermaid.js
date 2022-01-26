import React from "react"
//import Mermaid from "mermaid"
import mermaid from "mermaid"

class Mermaid extends React.Component {
  componentDidMount() {
    mermaid.initialize({
      theme: 'base',
      logLevel: 1,
      flowchart: { curve: 'linear' },
      themeVariables: {
        primaryColor:"#c7c7c7",
        //background: "#fff000",
        //nodeBorder:"#004990",
        //nodeTextColor: "#274059",
        defaultLinkColor: "#004990",
        fontFamily: "arial",

      }
    });
    mermaid.contentLoaded();

  }

  
  render() {
    return <div className="mermaid">{this.props.chart}</div>;
  }
}

const Similarity = "60%";

const keywords = [
  "Goal",
  "Context",
  "System Description",
  "Property Claim",
  "Argument"
];

class Mermaid_Chart extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      keywords: [],
      keyphrases: []
    };
  }

  componentDidMount() {
    //RESTAPI
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

  render() {
    console.log(this.state.keyphrases);
    console.log("this.state", this.state);
    return (
      <div className="App">
        <p>{JSON.stringify(this.state)}</p>
        <h1>react-mermaid</h1>

        <Mermaid
          chart={`graph TB; 
          A[${
          this.state.keywords.length > 0 ? this.state.keywords[0] : "Goal"
        }] --> B{Context}
        A--> |keyword| E(System or Project Property Claim)
        A--> D{System Description}
        click D "http://www.github.com" "This is a tooltip for a link"
        E--> F(Argument)
        F--> G(Evidential Claim)
        G--> |${Similarity}| H[(Evidence)]
        style A fill:#f9f, stroke:#333, stroke-width:3px,  padding:250px
        
      `}
        />
      </div>
    );
  }
}

export default Mermaid_Chart;

