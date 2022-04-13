/* General function that can create any type of object apart from the top-level Case */

import { Box, Button, Form, FormField, Heading, TextInput } from "grommet";
import React, { useState } from "react";
import configData from "../config.json";

function ItemCreator(props) {
  const [parentId, setParentId] = useState(1);
  const [name, setName] = useState("Name");
  const [sdesc, setShortDesc] = useState("Short description");
  const [ldesc, setLongDesc] = useState("Long description");
  const [keywords, setKeywords] = useState("Keywords (comma-separated)");
  const [url, setURL] = useState("www.some-evidence.com");

  function handleSubmit(event) {
    event.preventDefault();
    console.log("in handleSubmit, parentId is ", parentId);
    const res = createDBObject();
    console.log("db object created?", res);
    return res.then((resolve) => {
      props.updateView();
    });
  }

  async function createDBObject() {
    let backendURL = `${configData.BASE_URL}/${
      configData.navigation[props.type]["api_name"]
    }/`;
    console.log("url is ", backendURL);

    let request_body = {};
    request_body["name"] = name;
    request_body["short_description"] = sdesc;
    request_body["long_description"] = ldesc;
    request_body["keywords"] = keywords;
    if (props.type === "Evidence") {
      request_body["URL"] = url;
    }
    console.log(
      "creating a ",
      props.type,
      configData.navigation[props.type]["parent_relation"]
    );
    if (
      configData.navigation[props.type]["parent_relation"] === "many-to-many"
    ) {
      request_body[configData.navigation[props.parentType]["id_name"]] = [
        parseInt(props.parentId),
      ];
    } else {
      request_body[configData.navigation[props.parentType]["id_name"]] =
        parseInt(props.parentId);
    }
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request_body),
    };

    console.log(
      "submit button pressed with state ",
      JSON.stringify(request_body)
    );
    let response = {};

    fetch(backendURL, requestOptions).then((response) => response.json());

    console.log("response was ", response);
    return response;
  }

  return (
    <Box className="dropdown" pad="small">
      <Heading level={3}>Create a new {props.type}</Heading>
      <Form onSubmit={handleSubmit}>
        <FormField>
          <TextInput
            placeholder={name}
            name="name"
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <FormField>
          <TextInput
            placeholder={sdesc}
            name="short_description"
            onChange={(e) => setShortDesc(e.target.value)}
          />
        </FormField>
        <FormField>
          <TextInput
            placeholder={ldesc}
            name="long_description"
            onChange={(e) => setLongDesc(e.target.value)}
          />
        </FormField>
        <FormField>
          <TextInput
            placeholder={keywords}
            name="keywords"
            onChange={(e) => setKeywords(e.target.value)}
          />
        </FormField>
        {props.type === "Evidence" && (
          <FormField>
            <TextInput
              placeholder={url}
              name="keywords"
              onChange={(e) => setURL(e.target.value)}
            />
          </FormField>
        )}
        <Button type="submit" primary label="Submit" />
      </Form>
    </Box>
  );
}

export default ItemCreator;
