/* General class that can create any type of object apart from the top-level Case */

import React from "react"

import configData from "../config.json"

class ItemCreator extends React.Component {

    state = {
        name: "",
        short_description: "",
        long_description: "",
        keywords: ""
    }
    url = `${configData.BASE_URL}/${this.state.type}/`;

    onChange = e => {
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
        
    }

    render() {
        return (
            <div>
            <h2>Create a new {this.props.type}</h2>
            <form>
                <li>
                <input 
                    type="text" 
                    placeholder="Name" 
                    value={this.state.name}
                    name="name"
                    onChange={this.onChange}
                />
                </li>
                <li>
                <input 
                    type="text" 
                    placeholder="Short description" 
                    value={this.state.short_description}
                    name="short_description"
                    onChange={this.onChange}
                />
                </li>
                <li>
                <input 
                    type="text" 
                    placeholder="Long description" 
                    value={this.state.long_description}
                    name="long_description"
                    onChange={this.onChange}
                />
                </li>
                <li>
                <input 
                    type="text" 
                    placeholder="Keywords (comma-separated)" 
                    value={this.state.keywords}
                    name="keywords"
                    onChange={this.onChange}
                />
                </li>
                <p>Select {configData["navigation"][this.props.type]["parent_name"]}</p>
                <select 
       //             disabled={loading}
         //           value={value}
           //         onChange={handleChange} 
                    >
                            <option value="first">first </option>
                            <option value="second">second</option>
                            <option value="third">third</option>
                </select>
                <button onClick={this.handleSubmit}>Submit</button>
            </form>
            </div>
        )
    }

}

export default ItemCreator;