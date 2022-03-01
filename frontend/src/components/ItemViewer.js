/* General function that can view any type of object apart from the top-level Case */

import React, { useState, useEffect } from 'react';
import { useParams } from "react-router-dom"
import configData from "../config.json"

function ItemViewer(props) {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([
        { label: "Loading ...", value: "" }
    ]);

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

    return (
        <div>
            <h2>{props.type} {props.id}</h2>
                <div><h4> Name </h4><p>{items.name}</p></div>
                <div><h4> Short description </h4><p>{items.short_description}</p></div>
                <div><h4> Long description </h4><p>{items.long_description}</p></div>
                <div><h4> Keywords </h4><p>{items.keywords}</p></div>
                {(props.type === "Evidence") && <div>
                <h4> URL </h4><p>{items.URL}</p>
                </div>}
                <div> 
                   <button onClick={(e) => props.editItemLayer(props.type, props.id, e)}>Edit</button>
                </div>
        </div>
    );
}

export default (props) => (
    <ItemViewer
        {...props}
        params={useParams()}
    />
);

