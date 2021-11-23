 import React, {Component} from 'react';
 import Case_details from './case.js'

 class App extends Component {
  state = {
    json_response: []
  };
  url = 'http://127.0.0.1:8000/api/cases'

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
    const select_case = new Case_details();
    console.log(select_case)

    //var value = Case_details.state.json_response.filter(function(item) {
      
    //  return item.key == e.target.value
    //})

    //console.log(value[0].value);
  }


  render() {
    //console.log("type one:", this.state.json_response.length);
    
    return (
      <div className="dropdown">
        <p>Select Assurance Case</p>
              <select onChange={this.handleChange}>
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

export default App;
