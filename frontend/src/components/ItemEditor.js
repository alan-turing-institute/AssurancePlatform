/* General function that can create any type of object apart from the top-level Case */

import React, { useState, useEffect } from 'react';
import { useParams } from "react-router-dom"
import configData from "../config.json"

function ItemEditor(props) {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([
        { label: "Loading ...", value: "" }
    ]);
    // let parent_type = configData["navigation"][props.type]["parent_name"]
    const [name, setName] = useState("Name")
    const [sdesc, setShortDesc] = useState("Short description")
    const [ldesc, setLongDesc] = useState("Long description")
    const [keywords, setKeywords] = useState("Keywords (comma-separated)")
    const [url, setURL] = useState("http://some-evidence.com")

    useEffect(() => {
        let unmounted = false;
        let url = `${configData.BASE_URL}/${configData.navigation[props.type]["api_name"]}/${props.id}`;
        async function getCurrent() {
            const response = await fetch(url);
            const body = await response.json();
            console.log("in getCurrent got body", body)
            if (!unmounted) {
                setItems(body);
                setLoading(false);
            }
        }
        getCurrent();
        return () => {
            unmounted = true;
        };
    }, []);

    function handleChange(event) {
        //let parent = event.currentTarget.value
        // setParentId(parent);

    }

    function handleDelete(event) {
        console.log("in handleDelete ",props.type, props.id,event)
        deleteDBObject();
        props.updateView();
    }

    async function deleteDBObject() {
        let url = `${configData.BASE_URL}/${configData.navigation[props.type]["api_name"]}/${props.id}/`        
        const requestOptions = {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        };
        let response = {};
        console.log("request options for delete are ",requestOptions)
        fetch(url, requestOptions)
            .then(response => response.json());

        console.log("delete response was ", response);
    }

    function handleSubmit(event) {
        event.preventDefault()
        console.log("in handleSubmit, items are ", event)
        editDBObject();
        props.updateView();
    }

    async function editDBObject() {
        let backendURL = `${configData.BASE_URL}/${configData.navigation[props.type]["api_name"]}/${props.id}/`
        console.log("url is ", backendURL)

        let request_body = {}
        request_body["name"] = name;
        request_body["short_description"] = sdesc;
        request_body["long_description"] = ldesc;
        request_body["keywords"] = keywords;
        if (props.type === "Evidence") {
            request_body["URL"] = url;    
        }

        const requestOptions = {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request_body)
        };

        console.log("submit button pressed with state ", JSON.stringify(request_body))
        let response = {};

        fetch(backendURL, requestOptions)
            .then(response => response.json());

        console.log("response was ", response);
    }

    function setItem(key, value) {
        items[key] = value
    }

    return (
        <div className="dropdown">
            <h2>Edit {props.type} {props.id}</h2>
            <form>
                <li>
                    <input
                        type="text"
                        value={items.name}
                        onChange={e => setItem("name", e.target.value)}
                        name="name"
                    />
                </li>
                <li>
                    <input
                        type="text"
                        value={items.short_description}
                        name="short_description"
                        onChange={e => setItem("short_description", e.target.value)}
                    />
                </li>
                <li>
                    <input
                        type="text"
                        value={items.long_description}
                        name="long_description"
                        onChange={e => setItem("long_description", e.target.value)}
                    />
                </li>
                <li>
                    <input
                        type="text"
                        value={items.keywords}
                        name="keywords"
                        onChange={e => setItem("keywords", e.target.value)}
                    />
                </li>
                {(props.type === "Evidence") && <li>
                    <input
                        type="text"
                        value={items.URL}
                        name="URL"
                        onChange={e => setItem("URL", e.target.value)}
                    />
                </li>}
                <button onClick={e => handleSubmit(e)}>Submit</button>
                <div>
                {configData.navigation[props.type]["children"].map((childType) => (
                <button onClick={(e) => props.createItemLayer(childType, props.id, e)}>Create new {childType}</button>
                ))}
                </div>
                <div>
                    <button onClick={e => handleDelete(e)}>Delete</button>
                </div>
            </form>
        </div>
    );
}

export default (props) => (
    <ItemEditor
        {...props}
        params={useParams()}
    />
);

