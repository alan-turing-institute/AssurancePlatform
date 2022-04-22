/* General function that can create any type of object apart from the top-level Case */

import { Box, Button, Form, FormField, Heading, TextInput } from "grommet";
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getBaseURL } from "./utils.js";
import configData from "../config.json";

function ItemEditor(props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([{ label: "Loading ...", value: "" }]);

  useEffect(() => {
    let unmounted = false;
    let url = `${getBaseURL()}/${
      configData.navigation[props.type]["api_name"]
    }/${props.id}`;
    async function getCurrent() {
      const response = await fetch(url);
      const body = await response.json();
      console.log("in getCurrent got body", body);
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

  function handleDelete(event) {
    console.log("in handleDelete ", props.type, props.id, event);
    deleteDBObject().then((resolve) => props.updateView());
  }

  async function deleteDBObject() {
    let url = `${getBaseURL()}/${
      configData.navigation[props.type]["api_name"]
    }/${props.id}/`;
    const requestOptions = {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    };
    let response = {};
    console.log("request options for delete are ", requestOptions);
    fetch(url, requestOptions).then((response) => response.json());

    console.log("delete response was ", response);
  }

  function handleSubmit(event) {
    event.preventDefault();
    console.log("in handleSubmit, items are ", event);
    editDBObject().then(() => props.updateView());
  }

  async function editDBObject() {
    let backendURL = `${getBaseURL()}/${
      configData.navigation[props.type]["api_name"]
    }/${props.id}/`;
    console.log("url is ", backendURL);

    let request_body = {};
    request_body["name"] = items.name;
    request_body["short_description"] = items.short_description;
    request_body["long_description"] = items.long_description;
    request_body["keywords"] = items.keywords;
    if (props.type === "Evidence") {
      request_body["URL"] = items.URL;
    }

    const requestOptions = {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request_body),
    };

    console.log(
      "submit button pressed with state ",
      JSON.stringify(request_body)
    );
    return fetch(backendURL, requestOptions);
  }

  function setItem(key, value) {
    console.log("in setItem", key, value);
    items[key] = value;
  }

  return (
    <Box className="dropdown">
      <Heading level={3}>
        Edit {props.type} {props.id}
      </Heading>
      <Form onSubmit={handleSubmit}>
        <FormField>
          <TextInput
            placeholder={items.name}
            name="name"
            onChange={(e) => setItem("name", e.target.value)}
          />
        </FormField>
        <FormField>
          <TextInput
            placeholder={items.short_description}
            name="short_description"
            onChange={(e) => setItem("short_description", e.target.value)}
          />
        </FormField>
        <FormField>
          <TextInput
            placeholder={items.long_description}
            name="long_description"
            onChange={(e) => setItem("long_description", e.target.value)}
          />
        </FormField>
        <FormField>
          <TextInput
            placeholder={items.keywords}
            name="keywords"
            onChange={(e) => setItem("keywords", e.target.value)}
          />
        </FormField>
        {props.type === "Evidence" && (
          <FormField>
            <TextInput
              placeholder={items.URL}
              name="URL"
              onChange={(e) => setItem("URL", e.target.value)}
            />
          </FormField>
        )}
        <Button type="submit" label="Submit" />
      </Form>
      <Box gap="small" pad={{ top: "small" }} direction="row">
        {configData.navigation[props.type]["children"].map((childType) => (
          <Button
            pad="small"
            key={childType}
            onClick={(e) => props.createItemLayer(childType, props.id, e)}
            label={"Create new " + childType}
          />
        ))}
      </Box>
      <Box pad={{ top: "small" }}>
        <Button onClick={(e) => handleDelete(e)} label="Delete" />
      </Box>
    </Box>
  );
}

export default (props) => <ItemEditor {...props} params={useParams()} />;
