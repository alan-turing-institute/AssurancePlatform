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
        curve: 'cardinal',
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
  callback(message) {
    console.log(message)
    alert('For example you can display an alert!');
  }

  render() {
    console.log(this.state.keyphrases);
    console.log("this.state", this.state);
    //console.log(this.jsontoMermaid(input_json));
    //console.log("json:", json);


    return (

      < div className="App" >

        {/* <h1>{this.props.assurance_name}</h1> */}
        <Mermaid

          chart={
            // `graph TB;
            // ${this.props.chartmd}`
            `graph TB;
              A[${this.props.goals}] --> B{${this.props.context}}
            B:::cs
            A:::cs--> |key| E(${this.props.prop_claims})
            A--> D{${this.props.syst_descr}}
            D:::cs
            E:::cs--> F(Argument)
            F:::cs--> G(Evidential Claim)
            G:::cs--> |${Similarity}| H[(Evidence)]
            H:::cs
            classDef cs stroke-width:2px;
            click A call callback("I am a tooltip") "Tooltip for a callback"
            `

          }
        />
        <p>{JSON.stringify(this.state)}</p>
        <p><span > ......................................
          ...............................................................
          ..............................................................
          ..............................................................
          ...............................................................
          ...............................................................
        </span></p>
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

export default Mermaid_Chart;

