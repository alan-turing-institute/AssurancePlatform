import React, { Component } from 'react';
import { useParams } from "react-router-dom";
import { Grid, Box } from 'grommet';
//import { withRouter } from "react-router";

import CaseDetails from './CaseDetails.js'
import Mermaid_Chart from './mermaid';
import configData from "../config.json";

import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

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

  render() {

    return (
      <div>
        <Grid
          rows={['xxsmall', 'flex', 'xxsmall']}
          columns={['flex', 'medium']}
          gap="small"
          areas={[
            { name: 'header', start: [0, 0], end: [1, 0] },
            { name: 'main', start: [0, 1], end: [0, 1] },
            { name: 'right', start: [1, 1], end: [1, 1] },
            { name: 'footer', start: [0, 2], end: [1, 2] },
          ]}
        >
          <Box gridArea="header" background="brand" >
            <CaseDetails acase={this.state.assurance_case} />
          </Box>
          <Box gridArea="main" background="light-2" >
            <TransformWrapper>
              <TransformComponent>
                <Mermaid_Chart />
              </TransformComponent>
            </TransformWrapper>
          </Box>
          <Box direction="column" gap={'4px'} gridArea="right" background={{ color: "#ff0000" }}>
            <Box width={"flex"} height={'30px'} background={{ color: "blue" }}> askdfjalksdjlakjldkfjald lak  </Box>
            <Box width={"flex"} height={'30px'} background={{ color: "blue" }}> slkalskd</Box>
          </Box>
          <Box gridArea="footer" background="light-5" />

        </Grid>


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