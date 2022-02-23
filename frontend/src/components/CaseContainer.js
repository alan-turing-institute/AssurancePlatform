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
import ItemCreator from './ItemCreator.js'

class CaseContainer extends Component {
  constructor(props) {
    super(props)
    this.state = {
      showEditLayer: false,
      showCreateLayer: false,
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

   // console.log(json_response);
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
   // console.log("in jsonToMermaid ", in_json)
    let alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    let letterIndex = 0;
    function getNextLetter() {
      let nextLetter = alphabet[letterIndex]
      letterIndex++;
      return nextLetter;
    }

    function getNodeName(itemType,itemId) {
      return itemType+"_"+itemId;
    }

    function makeBox(text, shape) {
      if (shape === "square") return "[" + text + "]";
      else if (shape === "diamond") return "{" + text + "}";
      else if (shape === "rounded") return "(" + text + ")";
      else if (shape === "circle") return "((" + text + "))";
      else if (shape === "data") return "[(" + text + ")]";
      else return "";
    }

    let arrow = " --> "
    /// Recursive function to go down the tree adding components
    function addTree(itemType, parent, parentNode, outputmd) {
      // look up the 'API name', e.g. "goals" for "TopLevelNormativeGoal"
      let thisType = configData.navigation[itemType]["db_name"]
      let boxShape = configData.navigation[itemType]["shape"]
     
    //  console.log("thisType is ", thisType, "parent is ", parent)
      for (let i = 0; i < parent[thisType].length; i++) {
        let thisObj = parent[thisType][i]
        let thisNode = getNodeName(itemType, thisObj.id);
        if (parentNode != null) {
          outputmd += parentNode + arrow + thisNode + makeBox(thisObj.name, boxShape) + "\n"
        } else {
          outputmd += thisNode + makeBox(thisObj.name, boxShape) + "\n";
        }
        // add a click link to the node
        outputmd += "\n click " + thisNode + " callback" + "\n";
        for (let j=0; j < configData.navigation[itemType]["children"].length; j++) {
          let childType = configData.navigation[itemType]["children"][j]
          outputmd = addTree(childType, thisObj, thisNode, outputmd)
        }

      }
     // console.log(outputmd)
      return outputmd;
    }

    let outputmd = "graph TB; \n"
    outputmd = addTree("TopLevelNormativeGoal", in_json, null, outputmd)
  
    return (outputmd)
  }


  showEditLayer(e) {
    let chunks = e.split("_");
    if (chunks.length === 2) {
      let itemType = chunks[0];
      let itemId = chunks[1];
      
      this.setState({editItemType: itemType, editItemId: itemId})
      
    }
    if (this.state.editItemType && this.state.editItemId) this.setState({ showEditLayer: true })
  }

  showCreateLayer(itemType, parentId, event) {
    console.log("in showCreateLayer", this, parentId)
    event.preventDefault()
    this.setState(
      {createItemType: itemType, 
      createItemParentId: parentId}
    )
    this.setState({ showCreateLayer: true})
  }

  hideEditLayer() {
    this.setState(
      {showEditLayer: false,
        editItemType: null,
        editItemId: null
      })
  }

  hideCreateLayer() {
    this.setState(
      {showCreateLayer: false,
        createItemType: null,
        createItemParentType: null,
        createItemParentId: null
      })
  }

  editLayer() {
    return (
      <Box >
          <Layer
            full="vertical"//"false"
            position="right"//"bottom-left"
            onEsc={() => this.hideEditLayer()}
            onClickOutside={() => this.hideEditLayer()}
          >
            <Box
              pad="medium"
              gap="small"
              width={{ min: 'medium' }}
              height={{ min: 'small' }}
              fill
            >
              <Button alignSelf="end" icon={<FormClose />} onClick={() => this.hideEditLayer()} />
              <Box >
                <ItemEditor 
                  type={this.state.editItemType} 
                  id={this.state.editItemId} 
                  createItemLayer={this.showCreateLayer.bind(this)}/>
              </Box>
            </Box>
          </Layer>
      </Box>
    );
  }

  createLayer() {
    return (
      <Box >
          <Layer
            full="false"
            position="bottom-right"//"bottom-left"
            onEsc={() => this.hideCreateLayer()}
            onClickOutside={() => this.hideCreateLayer()}
          >
            <Box
              pad="medium"
              gap="small"
              width={{ min: 'medium' }}
              height={{ min: 'small' }}
              fill
            >
              <Button alignSelf="end" icon={<FormClose />} onClick={() => this.hideCreateLayer()} />
              <Box >
                <ItemCreator 
                type={this.state.createItemType} 
                parentId={this.state.createItemParentId} 
                />
              </Box>
            </Box>
          </Layer>
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
          { this.state.showEditLayer && this.state.editItemType && this.state.editItemId && this.editLayer()}
          { this.state.showCreateLayer && this.state.createItemType && this.state.createItemParentId && this.createLayer()}
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
                        editLayerFunc={(e) => this.showEditLayer(e)}
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
