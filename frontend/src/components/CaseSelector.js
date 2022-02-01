 import React, {Component} from 'react';
 //import { withRouter } from 'react-router' 
 //import { useNavigate } from "react-router-dom";
 import configData from "../config.json"

 class CaseSelector extends Component {

  constructor(props) {
    super(props)
  }

  state = {
    json_response: []
  };
  url = `${configData.BASE_URL}/cases`

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
    //let navigate = useNavigate();
      this.setState({selectValue:e.target.value});
      console.log("change in CaseSelector ",e.target.value);
      //this.props.router.push("/cases/"+e.target.value)
      this.props.navigation.navigate("/cases/"+e.target.value)
      //this.props.handleChangeProps(e.target.value);
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
      </div>
      );
  }
}

export default CaseSelector;
