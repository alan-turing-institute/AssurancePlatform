 import React, {Component} from 'react';
 //import CaseDetails from './CaseDetails.js'

 class CaseSelector extends Component {
  state = {
    json_response: []
  };
  url = 'http://localhost:8000/api/cases'

  async componentDidMount() {
    try {
      const res = await fetch(this.url); // fetching the data from api, before the page loaded
      const json_response = await res.json(); //getting the json response
      this.setState({
        json_response
      });
    } catch (e) {
      console.log(e);
    }
  }

  handleChange = (e) => {
      this.setState({selectValue:e.target.value});
      console.log("change in CaseSelector ",e.target.value);
      this.props.handleChangeProps(e.target.value);
  }


  render() {

    return (
      <div className="dropdown">
        <p>Select Assurance Case</p>
            <select onChange={this.handleChange} value={this.state.selectValue}>
                {this.state.json_response.map(function(item){  return (
                  <option key={item.id} value={item.id}>{item.name}</option> )
                })}

              </select>


        {/* {this.state.json_response.map((item, key) => (
          <div key={key}>
            <h1>{item.name}</h1>
            <span>{item.description}</span>
          </div>
        ))} */}
      </div>
      );
  }
}

export default CaseSelector;
