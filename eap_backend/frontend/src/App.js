 import React, {Component} from 'react';


 class App extends Component {
  state = {
    eap_backend: []
  };

  async componentDidMount() {
    try {
      const url = 'http://127.0.0.1:8000/api/home'
      const res = await fetch(url); // fetching the data from api, before the page loaded
      const json = await res.json(); //getting the json response
      const eap_backend= json.results; //getting the results from dict which contains the assurance case
      this.setState({
        eap_backend
      });
    } catch (e) {
      console.log(e);
    }
  }

  render() {
    console.log("type one:", this.state.eap_backend.length);
    
    return (
      <div>
        {this.state.eap_backend.map((item, key) => (
          <div key={key}>
            <h1>{item.name}</h1>
            <span>{item.description}</span>
          </div>
        ))}
      </div>
      );
  }
}

export default App;
