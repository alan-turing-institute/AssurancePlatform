import React, { Component } from 'react';
import { useParams } from "react-router-dom";
import { Grid, Box, DropButton, Menu, TextInput, Layer, Button } from 'grommet';
import { grommet } from 'grommet/themes';
//import { withRouter } from "react-router";

import CaseDetails from './CaseDetails.js'
import MermaidChart from './mermaid';
import configData from "../config.json";

import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

var input_json = { "id": 1, "name": "My Case", "description": "first test case", "created_date": "2021-11-15T17:52:41.675611Z", "goals": [{ "id": 1, "name": "The Goal", "short_description": "we should do this", "long_description": "A long description of what we should do", "keywords": "key", "assurance_case": 1, "context": [{ "id": 1, "name": "Context", "short_description": "context for The Goal", "long_description": "A longer description of the context", "created_date": "2021-11-15T17:52:41.698240Z", "goal": 1 }], "system_description": [{ "id": 1, "name": "Description", "short_description": "A short description of the system", "long_description": "a much longer description of the system", "goal": 1 }], "property_claims": [{ "id": 1, "name": "PropertyClaim 1", "short_description": "Goal 1 should be x", "long_description": "A long description of this property claim", "goal": 1, "arguments": [{ "id": 1, "name": "Argument 1", "short_description": "This is an argument", "long_description": "looong description of the argument", "property_claim": [1], "evidential_claims": [{ "id": 1, "name": "Evidential Claim 1", "short_description": "A short description of the first evidential claim", "long_description": "A longer description of the first evidential claim", "argument": 1, "evidence": [{ "id": 1, "name": "Evidence 1", "short_description": "Some evidence to support claim 1", "long_description": "Description of that evidence", "URL": "http://evidence1.com", "evidential_claim": [1] }, { "id": 2, "name": "Evidence 2", "short_description": "Some more evidence to support claim 1", "long_description": "Description of that evidence", "URL": "http://evidence2.com", "evidential_claim": [1] }] }] }, { "id": 2, "name": "Argument 2", "short_description": "This is also an argument", "long_description": "looong description of the second argument", "property_claim": [1], "evidential_claims": [{ "id": 2, "name": "Evidential Claim 2", "short_description": "A short description of the second evidential claim", "long_description": "A longer description of the second evidential claim", "argument": 2, "evidence": [{ "id": 3, "name": "Evidence 3", "short_description": "Some evidence to support claim 2", "long_description": "Description of that evidence", "URL": "http://evidence3.com", "evidential_claim": [2] }, { "id": 4, "name": "Evidence 4", "short_description": "Some more evidence to support claim 2", "long_description": "Description of that evidence", "URL": "http://evidence4.com", "evidential_claim": [2] }] }] }] }, { "id": 2, "name": "PropertyClaim 2", "short_description": "Goal 1 should probably be yz", "long_description": "A long description of this property claim", "goal": 1, "arguments": [{ "id": 3, "name": "Argument 3", "short_description": "Would you believe this is also an argument", "long_description": "looong description of the third argument", "property_claim": [2], "evidential_claims": [{ "id": 3, "name": "Evidential Claim 3", "short_description": "A short description of the third evidential claim", "long_description": "A longer description of the third evidential claim", "argument": 3, "evidence": [{ "id": 5, "name": "Evidence 5", "short_description": "Some evidence to support claim 3", "long_description": "Description of that evidence", "URL": "http://evidence5.com", "evidential_claim": [3] }, { "id": 6, "name": "Evidence 6", "short_description": "Some more evidence to support claim 3", "long_description": "Description of that evidence", "URL": "http://evidence6.com", "evidential_claim": [3] }] }, { "id": 4, "name": "Evidential Claim 4", "short_description": "A short description of the fourth evidential claim", "long_description": "A longer description of the fourth evidential claim", "argument": 3, "evidence": [{ "id": 7, "name": "Evidence 7", "short_description": "Some more evidence to support claim 4", "long_description": "Description of that evidence", "URL": "http://evidence7.com", "evidential_claim": [4] }] }] }] }] }] }


class CaseContainer extends Component {

  // caseId = useParams();


  state = {
    assurance_case: {
      id: 0,
      name: "",
      description: ""
    }
  };

  url = `${configData.BASE_URL}/cases/`;

  handleChange = async (id) => {

    console.log("change in CaseContainer ", this.url + id);

  };

  fetchData = async (id) => {
    const res = await fetch(this.url + id);
    console.log(" did some fetching ", res)
    const json_response = await res.json()

    console.log(json_response);
    this.setState({
      assurance_case: json_response
    });
  }

  componentDidMount() {
    const id = this.props.params.caseSlug;
    this.fetchData(id);
    console.log("In CaseContainer::componentDidMount ", id);
  }


  jsontoMermaid(in_json) {

    let arrow = "-->"
   // let outputmd = "A [" + in_json.goals[0]["name"] + "]";
   // outputmd += arrow + "B{" + in_json.goals[0]["context"][0]["name"] + "} \n";
   // outputmd += "A--> | keyword | E(<font color=white>" + in_json.goals[0]["property_claims"][0]["name"] + ") \n"
   // outputmd += "A--> D{" + in_json.goals[0]["system_description"][0]["name"] + "} \n"

    // A[${this.props.goals}] --> B{${this.props.context}}
    // B:::cs
    // A:::cs--> |key| E(${this.props.prop_claims})
    // A--> D{${this.props.syst_descr}}
    // D:::cs
    // E:::cs--> F(Argument)
    // F:::cs--> G(Evidential Claim)
    // G:::cs--> |${Similarity}| H[(Evidence)]
    // H:::cs

    //A--> D{System Description}
    //E--> F(Argument)
    //F--> G(Evidential Claim)
    //G--> |${Similarity}| H[(Evidence)]
    //style A fill:#f9f, stroke:#333, stroke-width:3px,  padding:250px
    //  `
    let outputmd = `graph TB;
    A[Goal] --> B{Context}
  B:::cs
  A:::cs--> |key| E(Property Claim)
  A--> D{System Description}
  D:::cs
  E:::cs--> F(Argument)
  F:::cs--> G(Evidential Claim)
  G:::cs--> |60%| H[(Evidence)]
  H:::cs
  classDef cs stroke-width:2px;
  click A call callback("I am a tooltip") "Tooltip for a callback"
  `
    return (outputmd)
  }


  Example() {
    const [show, setShow] = "React.useState()";
    return (
      <Box>
        <Button label="show" onClick={() => setShow(true)} />
        {show && (
          <Layer
            onEsc={() => setShow(false)}
            onClickOutside={() => setShow(false)}
          >
            <Button label="close" onClick={() => setShow(false)} />
          </Layer>
        )}
      </Box>
    );
  }

  render() {
    console.log(this.jsontoMermaid(input_json));
    return (
      <div>

        <Grid
          rows={['3px', 'flex', 'xxsmall']} //{['xxsmall', 'flex', 'xxsmall']}
          columns={['flex', "20%"]}
          gap="medium"
          areas={[
            { name: 'header', start: [0, 0], end: [0, 0] },
            { name: 'main', start: [0, 1], end: [0, 1] },
            { name: 'right', start: [1, 1], end: [1, 1] },
            { name: 'footer', start: [0, 2], end: [1, 2] },
          ]}
        >
          <Box gridArea="header" background="#ffffff" >
            {/* <CaseDetails acase={this.state.assurance_case} /> */}
          </Box>
          {/* <Box gridArea="title" background="light-2" >
            <h2>{input_json.name}</h2>
          </Box> */}
          {/* <div class="flex flex-wrap">

            <div class="w-25pc h-1by1 pattern-dots-md slategray-lighter"></div>
          </div> */}
          <Box gridArea="main" background={{ color: "white", size: "20px 20px", image: "radial-gradient(#999999 0.2%, transparent 10%)", height: "200px", width: "100%", repeat: "repeat-xy" }}>
            {/* {this.Example()} */}
            <Box width={"flex"} height={'30px'} >  <h2> &nbsp;{input_json.name}</h2>  </Box>
            <TransformWrapper
              initialScale={1}
              initialPositionX={25}
              initialPositionY={40}
            >
              {({ zoomIn, zoomOut, resetTransform, ...rest }) => (
                <React.Fragment>
                  <TransformComponent >
                    <MermaidChart
                      chartmd={this.jsontoMermaid(input_json)}
                      goals={input_json.goals[0]["name"]}
                      context={input_json.goals[0]["context"][0]["name"]}
                      prop_claims={input_json.goals[0]["property_claims"][0]["name"]}
                      syst_descr={input_json.goals[0]["system_description"][0]["name"]}
                      assurance_name={input_json.name}
                    />
                  </TransformComponent>
                  <div className="tools">
                    <button onClick={() => zoomIn()}>+</button>
                    <button onClick={() => zoomOut()}>-</button>
                    <button onClick={() => resetTransform()}>x</button>
                  </div>
                </React.Fragment>
              )}
            </TransformWrapper>
          </Box>
          {/* {{ color: "#ff0000" }} */}

          <Box direction="column" gap={'4px'} gridArea="right" background="light-2">


            <Box width={"flex"} height={'50px'} background="light-2" ><h4> &nbsp; Blocks </h4></Box>
            <Menu
              label="Select Assurance Case"
              items={[
                { label: 'First Assurance Case', onClick: () => { } },
                { label: 'Second Assurance Case', onClick: () => { } },
              ]}
            />
            <DropButton
              label="Add Goal"
              dropAlign={{ top: 'bottom', right: 'right' }}
              dropContent={
                <Box pad="large" background="light-2">
                  <TextInput
                    placeholder="Goal name"
                  //value={value}
                  //onChange={event => setValue(event.target.value)}
                  />
                  <TextInput
                    placeholder="Goal description"
                  />
                </Box>
              }
            />
            <DropButton
              label="Add Context"
              dropAlign={{ top: 'bottom', right: 'right' }}
              dropContent={
                <Box pad="large" background="light-2" />
              }
            />
            <DropButton
              label="Add Property Claim"
              dropAlign={{ top: 'bottom', right: 'right' }}
              dropContent={
                <Box pad="large" background="light-2" />
              }
            />
            <DropButton
              label="Add System Description"
              dropAlign={{ top: 'bottom', right: 'right' }}
              dropContent={
                <Box pad="large" background="light-2" />
              }
            />
            <DropButton
              label="Add Argument"
              dropAlign={{ top: 'bottom', right: 'right' }}
              dropContent={
                <Box pad="large" background="light-2" />
              }
            />
            <DropButton
              label="Add Evidential Claim"
              dropAlign={{ top: 'bottom', right: 'right' }}
              dropContent={
                <Box pad="large" background="light-2" />
              }
            />
            <DropButton
              label="Add Evidence"
              dropAlign={{ top: 'bottom', right: 'right' }}
              dropContent={
                <Box pad="large" background="light-2" />
              }
            />

          </Box>

          <Box gridArea="footer" background="light-5"> &copy; credits </Box>

        </Grid >

      </div >
    );
  }
}

export default (props) => (
  <CaseContainer
    {...props}
    params={useParams()}
  />
);