import React, {Component} from 'react';
import CaseSelector from './CaseSelector.js'
import CaseDetails from './CaseDetails.js'


class CaseContainer extends Component {
    state = {
	assurance_case: {
	    id: 0,
	    name: "",
	    description: ""
	}
    };
    url = 'http://localhost:8000/api/cases/';

    handleChange = async (id) => {

	console.log("change in CaseContainer ", this.url +id);
	const res = await fetch(this.url + id);
	console.log(" did some fetching ", res)
	const json_response = await res.json()

	console.log(json_response);
	this.setState({
	    assurance_case: json_response
      });
    };


  render() {

    return (
      <div>
        <CaseSelector selector handleChangeProps={this.handleChange} />
	      <CaseDetails acase={this.state.assurance_case} />
      </div>
      );
  }
}

export default CaseContainer;
