import React, { Component } from 'react';
import { useParams } from "react-router-dom";
import { Grid, Box, DropButton, Menu, TextInput, Layer, Button } from 'grommet';
import { grommet } from 'grommet/themes';
import { FormSearch, AddCircle, Trash, StatusGood, FormClose } from 'grommet-icons';
import { deepMerge } from 'grommet/utils';


import RoundLayer from './Layer.js';
import MermaidChart from './mermaid';
import configData from "../config.json";

import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import ItemEditor from './ItemEditor.js';

class CaseContainer extends Component {
  constructor(props) {
    super(props)
    this.state = {
      showlayer: false,
      loading: true,
      assurance_case: {
        id: 0,
        name: "",
        description: "",
        goals: []
      },
      mermaid_md: "graph TB; \n"
    }

    this.url = `${configData.BASE_URL}/cases/`;

    console.log("In CaseContainer::constructor ");
  };


  handleChange = async (id) => {

    console.log("change in CaseContainer ", this.url + id);

  };

  fetchData = async (id) => {
    const res = await fetch(this.url + id);
    const json_response = await res.json()

    console.log(json_response);
    this.setState({
      assurance_case: json_response
    });
    this.setState({
      mermaid_md: this.jsonToMermaid(this.state.assurance_case)
    })
    this.setState({ loading: false })
  }

  componentDidMount() {
    const id = this.props.params.caseSlug;
    this.fetchData(id);
  }

  jsonToMermaid(in_json) {
    console.log("in jsonToMermaid ", in_json)
    let alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    let letterIndex = 0;
    function getNextLetter() {
      let nextLetter = alphabet[letterIndex]
      letterIndex++;
      return nextLetter;
    }

    function squareBox(text) {
      return "[" + text + "]"
    }
    function diamondBox(text) {
      return "{" + text + "}"
    }
    function roundedBox(text) {
      return "(" + text + ")"
    }
    function circleBox(text) {
      return "((" + text + "))"
    }
    function dataBox(text) {
      return "[(" + text + ")]"
    }

    let arrow = " --> "

    /// Recursive function to go down the tree adding components
    function addTree(thisType, parent, parentLetter, outputmd) {
      let hierarchy = ["property_claims", "arguments", "evidential_claims", "evidence"]
      const thisIndex = hierarchy.findIndex(ind => ind === thisType);
      let childType = "";
      if (thisIndex < (hierarchy.length - 1)) {
        childType = hierarchy[thisIndex + 1]
      }
      for (let i = 0; i < parent[thisType].length; i++) {
        let thisObj = parent[thisType][i]
        let thisObjLetter = getNextLetter();
        if (thisType === "evidence") { /// different shaped box, and no children
          outputmd += parentLetter + arrow + thisObjLetter + dataBox(thisObj.name) + "\n"
        } else {
          outputmd += parentLetter + arrow + thisObjLetter + roundedBox(thisObj.name) + "\n"
          outputmd = addTree(childType, thisObj, thisObjLetter, outputmd)
        }
      }
      return outputmd;
    }

    let outputmd = "graph TB; \n"
    /// Loop over all the goals in the AssuranceCase
    for (let i = 0; i < in_json.goals.length; i++) {
      /// Add a box for the Goal itself
      let goal = in_json.goals[i]
      let goalLetter = getNextLetter()
      outputmd += goalLetter + squareBox(goal["name"])
      /// Add a box for the Context - only one per goal
      let contextLetter = getNextLetter();

      if (goal["context"].length > 0) {
        outputmd += arrow + contextLetter + diamondBox(goal["context"][0]["name"]) + "\n"
      }
      /// now start the recursive process of adding PropertyClaims and descendents
      outputmd = addTree("property_claims", goal, goalLetter, outputmd)
      /// Add SystemDescription to the right of all the PropertyClaims and descendants
      let descriptionLetter = getNextLetter();
      if (goal["system_description"].length > 0) {
        outputmd += goalLetter + arrow + descriptionLetter + diamondBox(goal["system_description"][0]["name"]) + "\n"
      }
    }
    outputmd += " \n"

    return (outputmd)
  }

  setShow() {
    this.setState({ showlayer: !this.state.showlayer })
  }


  editLayer() {

    return (
      <Box >
        <Button label="show" onClick={() => this.setShow()} />
        {this.state.showlayer && (
          <Layer
            full="vertical"//"false"
            position="right"//"bottom-left"
            onEsc={() => this.setShow()}
            onClickOutside={() => this.setShow()}
          >
            <Box

              pad="medium"
              gap="small"
              width={{ min: 'medium' }}
              height={{ min: 'small' }}
              fill
            >
              <Button alignSelf="end" icon={<FormClose />} onClick={() => this.setShow()} />
              <Box >
                <ItemEditor type="TopLevelNormativeGoal" id="1" />
              </Box>

            </Box>
          </Layer>

        )
        }
      </Box>

    );

  }




  render() {
    if (this.state.loading) {
      return (
        <div>loading</div>
      )
    } else {

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
              {this.editLayer()}

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
              <Box width={"flex"} height={'30px'} >  <h2> &nbsp;{this.state.assurance_case.name}</h2>  </Box>
              <TransformWrapper
                initialScale={1}
                initialPositionX={25}
                initialPositionY={40}
              >
                {({ zoomIn, zoomOut, resetTransform, ...rest }) => (
                  <React.Fragment>
                    <TransformComponent >
                      <MermaidChart
                        chartmd={this.state.mermaid_md}
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
              <Box direction="row" width={"flex"} height={'50px'} background="light-2" >
                <Box width={"15%"} height={"flex"} background="light-2"><FormSearch color='plain' size='large' /></Box>
                <Box width={"80%"} height={"flex"} background="light-2"><TextInput
                  placeholder="Search" /></Box>
              </Box>


              <DropButton
                label="Add Goal"
                dropAlign={{ top: 'bottom', right: 'right' }}
                dropContent={
                  <Box pad="large" background="light-2" gap={'8px'}>
                    <TextInput
                      placeholder="Goal name"
                    //value={value}
                    //onChange={event => setValue(event.target.value)}
                    />
                    <TextInput
                      placeholder="Goal description"
                    />
                    <Box direction="row" gap={"15px"}>
                      <Box alignContent='start' width={"flex"}>
                        <StatusGood color='green' size='medium' />
                      </Box>
                      <Box alignContent='end' width={"flex"}>
                        <Trash color='plain' size='medium' />
                      </Box>
                    </Box>
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
      )
    }
  }
}

export default (props) => (
  <CaseContainer
    {...props}
    params={useParams()}
  />
);
