import React, {Component} from 'react';
import { useParams } from "react-router-dom"
//import { withRouter } from "react-router";

import CaseDetails from './CaseDetails.js'
import Mermaid_Chart from './mermaid';
import configData from "../config.json"

class CaseContainer extends Component {

  state = {
	  assurance_case: {
	    id: 0,
	    name: "",
	    description: ""
	  }
  };
  url = `${configData.BASE_URL}/cases/`;

  handleChange = async (id) => {

	  console.log("change in CaseContainer ", this.url +id);
	  
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
	      <CaseDetails acase={this.state.assurance_case} />
        <Mermaid_Chart />
      </div>
      );
  }
}

export default (props) => (
  <CaseContainer
      {...props}
      params={useParams()}
  />
);