/* General function that can create any type of object apart from the top-level Case */

import {
  Box,
  Button,
  Form,
  FormField,
  Heading,
  Select,
  TextInput,
} from "grommet";
import React, { useState } from "react";
import { getBaseURL } from "./utils.js";
import configData from "../config.json";

function ItemCreator(props) {
  const [name, setName] = useState("Name");
  const [sdesc, setShortDesc] = useState("Short description");
  const [ldesc, setLongDesc] = useState("Long description");
  const [keywords, setKeywords] = useState("Keywords (comma-separated)");
  const [claimType, setClaimType] = useState(
    configData["property_claim_types"][0],
  );
  const [url, setURL] = useState("www.some-evidence.com");
  const [submitClicked, setSubmitClicked] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    // only do the submit actions once.
    if (submitClicked) {
      console.log("tried to submit more than once");
      return null;
    }
    setSubmitClicked(true);
    const res = createDBObject();
    return res.then((resolve) => {
      props.updateView();
    });
  }

  async function createDBObject() {
    let backendURL = `${getBaseURL()}/${
      configData.navigation[props.type]["api_name"]
    }/`;

    let request_body = {};
    request_body["name"] = name;
    request_body["short_description"] = sdesc;
    request_body["long_description"] = ldesc;
    request_body["keywords"] = keywords;
    if (props.type === "PropertyClaim") request_body["claim_type"] = claimType;
    if (props.type === "Evidence") request_body["URL"] = url;
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
      headers: {
        Authorization: `Token ${localStorage.getItem("token")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request_body),
    };

    console.log(
      "submit button pressed with state ",
      JSON.stringify(request_body),
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
        {props.type === "PropertyClaim" && (
          <FormField label="Claim type">
            <Select
              placeholder={claimType}
              name="claim_type"
              options={configData["property_claim_types"]}
              onChange={(e) => setClaimType(e.target.value)}
            />
          </FormField>
        )}
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
