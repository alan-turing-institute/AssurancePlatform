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