/* General function that can create any type of object apart from the top-level Case */

import React, {useState, useEffect} from 'react';
import configData from "../config.json"

function ItemCreator(props) {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([
      { label: "Loading ...", value: "" }
    ]);
    let parent_type = configData["navigation"][props.type]["parent_name"]
    const [parentId, setParentId] = useState(1);
    const [name, setName] = useState("Name")
    const [sdesc, setShortDesc] = useState("Short description")
    const [ldesc, setLongDesc] = useState("Long description")
    const [keywords, setKeywords] = useState("Keywords (comma-separated)")
    useEffect(() => {
        let unmounted = false;
        let url = `${configData.BASE_URL}/${configData.navigation[props.type]["parent_api_name"]}/`;
        async function getParents() {
            const response = await fetch(url);
            const body = await response.json();
            if (!unmounted) {
                setItems(body.map(({ id, name }) => ({ id: id, name: name })));
                 setLoading(false);
            }
        }
        getParents();
        return () => {
            unmounted = true;
        };
    }, []);

    function handleChange(event) {
      let parent = event.currentTarget.value
      setParentId(parent);
      
    }

    function handleSubmit(event) {
        event.preventDefault()
        console.log("in handleSubmit, parentId is ",parentId)
        createDBObject();
    }

    function createDBObject() {
        let url = `${configData.BASE_URL}/${configData.navigation[props.type]["api_name"]}/`
        console.log("url is ",url)

        let request_body = {}
        request_body["name"] = name;
        request_body["short_description"] = sdesc;
        request_body["long_description"] = ldesc;
        request_body["keywords"] = keywords;
        request_body[configData["navigation"][props.type]["parent_db_name"]] = parseInt(parentId);
       
/*
        let request_body = "{"
        request_body += "name: "+name+", "
        request_body += "short_description: "+sdesc+", "
        request_body += "long_description: "+ldesc+", "
        request_body += "keywords: "+keywords+", "
        request_body += configData["navigation"][props.type]["parent_db_name"]+": "+parentId
        request_body += "}"
        */
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request_body)
        };   
         
        console.log("submit button pressed with state ",JSON.stringify(request_body))
        let response = {};

        fetch(url, requestOptions)
        .then(response => response.json());

        console.log("response was ", response);
    }

    return (
        <div className="dropdown">    
            <h2>Create a new {props.type}</h2>
            <form>
                <li>
                <input 
                    type="text" 
                    value={name}
                    name="name"
                    onChange={e => setName(e.target.value)}
                />
                </li>
                <li>
                <input 
                    type="text" 
                    value={sdesc}
                    name="short_description"
                    onChange={e => setShortDesc(e.target.value)}
                />
                </li>
                <li>
                <input 
                    type="text" 
                    value={ldesc}
                    name="long_description"
                    onChange={e => setLongDesc(e.target.value)}
                />
                </li>
                <li>
                <input 
                    type="text" 
                    value={keywords}
                    name="keywords"
                    onChange={e => setKeywords(e.target.value)}
                />
                </li>
          <p>Select parent {parent_type}</p>
          <select 
          disabled={loading}
          value={parentId}
          onChange={handleChange} 
          >
            {items.map(({ id, name }) => (
            <option key={id} value={id}>
            {name}
            </option>
            ))}
          </select>
          <button onClick={e=>handleSubmit(e)}>Submit</button>
          </form>
      </div>
      );
}
    
export default ItemCreator;

/*
class ItemCreator extends React.Component {

    constructor(props) {
        super(props)
        this.state = { 
            name: "",
            short_description: "",
            long_description: "",
            keywords: "",
            parent_id: "",
            possible_parents: [{0:"loading"}],
            loading: true
        }
        this.url = `${configData.BASE_URL}/${this.props.type}/`;
    }

    componentWillMount() {
        let parent_url = `${configData.BASE_URL}/${configData.navigation[this.props.type]["parent_api_name"]}/`;
        //let possible_parents = []
        async function getParentChoices() {
            const response = await fetch(parent_url);
            const possible_parents = await response.json();
            console.log("got parent stuff", possible_parents)
            
        }
        getParentChoices();
        this.state.possible_parents = [{id: "1", name:"a case"},{id: "2", name:"another case"}]
       // this.setState((state, props) => ({possible_parents: possible_parents}));
        this.state.loading = false;
        console.log("at end of constructor, state is ", this.state)
    }
    

    onChange = e => {
          this.setState({
             [e.target.name]: e.target.value 
          })
          console.log("state is now ",this.state);
      };


    handleSubmit = e => {
        e.preventDefault()
        let request_body = "{"
        request_body += "id: "+this.state.id+", "
        request_body += "name: "+this.state.name+", "
        request_body += "short_description: "+this.state.short_description+", "
        request_body += "long_description: "+this.state.long_description+", "
        request_body += "keywords: "+this.state.keywords+", "
        request_body += configData["navigation"][this.props.type]["parent_db_name"]+": "+this.state.parent_id
        request_body += "}"
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: request_body
        };    
        console.log("submit button pressed with state ", request_body)
        let response = {};

        fetch(this.url, requestOptions)
        .then(response => response.json());

        console.log("response was ", response);
        
    }

    render() {



        console.log("in render, state is ", this.state)
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
                        disabled={this.state.loading}
                        onChange={this.handleChange} 
                        value={this.state.selectValue}>
                        {this.state.possible_parents.map(function(item){  return (
                            <option key={item.id} value={item.id}>{item.name}</option> )
                        })}

                    </select>
              
                <button onClick={this.handleSubmit}>Submit</button>
            </form>
            </div>
        )
    }

}

export default ItemCreator;
*/