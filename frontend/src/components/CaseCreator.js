import React from "react"

import configData from "../config.json"

class CaseCreator extends React.Component {

    state = {
        name: "",
        description: "",

    }
    url = `${configData.BASE_URL}/cases/`;

    onChange = e => {
        //  console.log("hello")
          this.setState({
              [e.target.name]: e.target.value
          })
          console.log("state is now ",this.state);
      };


    handleSubmit = e => {
        e.preventDefault()
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.state)
        };    
        console.log("submit button pressed with state ",JSON.stringify(this.state))
        let response = {};

        fetch(this.url, requestOptions)
        .then(response => response.json());

        console.log("response was ", response);
        //.then(data => this.setState({ postId: data.id }));
    }

    render() {
        return (
            <div>
            <h2>Create a new assurance case</h2>
            <form>
                <input 
                    type="text" 
                    placeholder="Name" 
                    value={this.state.name}
                    name="name"
                    onChange={this.onChange}
                />
                <input 
                    type="text" 
                    placeholder="Description" 
                    value={this.state.description}
                    name="description"
                    onChange={this.onChange}
                />
                <button onClick={this.handleSubmit}>Submit</button>
            </form>
            </div>
        )
    }

}

export default CaseCreator;