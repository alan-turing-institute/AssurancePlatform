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
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import ParentSelector from "./ParentSelector.js";
import { getBaseURL } from "./utils.js";
import configData from "../config.json";

function ItemEditor(props) {
  const [loading, setLoading] = useState(true);
  const [parentToAdd, setParentToAdd] = useState();
  const [parentToRemove, setParentToRemove] = useState();
  const [items, setItems] = useState([{ label: "Loading ...", value: "" }]);

  useEffect(() => {
    let unmounted = false;
    let url = `${getBaseURL()}/${
      configData.navigation[props.type]["api_name"]
    }/${props.id}`;
    async function getCurrent() {
      const requestOptions = {
        headers: {
          Authorization: `Token ${localStorage.getItem("token")}`,
        },
      };
      const response = await fetch(url, requestOptions);
      const body = await response.json();
      if (!unmounted) {
        setItems(body);
        setLoading(false);
      }
    }
    getCurrent();
    return () => {
      unmounted = true;
    };
  }, [props.id, props.type]);

  function handleDelete(event) {
    deleteDBObject().then((resolve) => props.updateView());
  }

  async function deleteDBObject() {
    let url = `${getBaseURL()}/${
      configData.navigation[props.type]["api_name"]
    }/${props.id}/`;
    const requestOptions = {
      method: "DELETE",
      headers: {
        Authorization: `Token ${localStorage.getItem("token")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    };
    return fetch(url, requestOptions);
  }

  function handleSubmit(event) {
    event.preventDefault();
    editDBObject().then(() => props.updateView());
  }

  function editDBObject() {
    return postItemUpdate(props.id, props.type, items);
  }

  async function submitAddParent(event) {
    if (parentToAdd === undefined) {
      return;
    }
    const parentType = parentToAdd["type"];
    const parentId = parentToAdd["id"];
    const url = `${getBaseURL()}/${
      configData.navigation[props.type]["api_name"]
    }/${props.id}/`;
    const response = await fetch(url);
    const current = await response.json();
    const idName = configData.navigation[parentType]["id_name"];
    const currentParents = current[idName];

    if (!currentParents.includes(parentId)) {
      currentParents.push(parentId);
      const requestOptions = {
        method: "PUT",
        headers: {
          Authorization: `Token ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(current),
      };
      await fetch(url, requestOptions);
      props.updateView();
    }
  }

  async function submitRemoveParent(event) {
    if (parentToRemove === undefined) {
      return;
    }
    const parentType = parentToRemove["type"];
    const parentId = parentToRemove["id"];
    const url = `${getBaseURL()}/${
      configData.navigation[props.type]["api_name"]
    }/${props.id}/`;
    const requestOptions = {
      headers: {
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
    };
    const response = await fetch(url, requestOptions);
    const current = await response.json();
    const idName = configData.navigation[parentType]["id_name"];
    let currentParents = current[idName];

    if (currentParents.includes(parentId)) {
      currentParents = currentParents.filter((id) => id !== parentId);
      if (currentParents.length < 1) {
        alert("Can not remove the last parent of an item.");
        return;
      }
      current[idName] = currentParents;
      const requestOptions = {
        method: "PUT",
        headers: {
          Authorization: `Token ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(current),
      };
      await fetch(url, requestOptions);
      props.updateView();
    }
  }

  function setItem(key, value) {
    const newItems = { ...items };
    newItems[key] = value;
    setItems(newItems);
  }

  if (loading) return <Heading level={3}> Loading... </Heading>;
  return (
    <Box>
      <Heading level={3}>Edit {items.name}</Heading>
      <Form onSubmit={handleSubmit}>
        <FormField>
          <TextInput
            value={items.short_description}
            name="short_description"
            onChange={(e) => setItem("short_description", e.target.value)}
          />
        </FormField>
        <FormField>
          <TextInput
            value={items.long_description}
            name="long_description"
            onChange={(e) => setItem("long_description", e.target.value)}
          />
        </FormField>
        <FormField>
          <TextInput
            value={items.keywords}
            name="keywords"
            onChange={(e) => setItem("keywords", e.target.value)}
          />
        </FormField>
        {props.type === "Evidence" && (
          <FormField>
            <TextInput
              value={items.URL}
              name="URL"
              onChange={(e) => setItem("URL", e.target.value)}
            />
          </FormField>
        )}
        {props.type === "PropertyClaim" && (
          <FormField label="Claim type">
            <Select
              value={items.claim_type}
              name="claim_type"
              options={configData["property_claim_types"]}
              onChange={(e) => setItem("claim_type", e.target.value)}
            />
          </FormField>
        )}
        <Button type="submit" label="Submit" />
      </Form>

      {configData.navigation[props.type]["parent_relation"] ===
        "many-to-many" && (
        <Box direction="row" gap="small" pad={{ top: "small" }}>
          <ParentSelector
            type={props.type}
            id={props.id}
            caseId={props.caseId}
            value={parentToAdd}
            setValue={setParentToAdd}
            potential={true}
          />
          <Button onClick={(e) => submitAddParent(e)} label="Add parent" />
        </Box>
      )}
      {configData.navigation[props.type]["parent_relation"] ===
        "many-to-many" && (
        <Box direction="row" gap="small" pad={{ top: "small" }}>
          <ParentSelector
            type={props.type}
            id={props.id}
            caseId={props.caseId}
            value={parentToRemove}
            setValue={setParentToRemove}
            potential={false}
          />
          <Button
            onClick={(e) => submitRemoveParent(e)}
            label="Remove parent"
          />
        </Box>
      )}
      <Box pad={{ top: "small" }}>
        <Button onClick={(e) => handleDelete(e)} label="Delete item" />
      </Box>
    </Box>
  );
}

/**
 * @param {string} id
 * @param {string} type
 * @param {*} item
 * @returns Promise<any>
 */
export async function postItemUpdate(id, type, item) {
  let backendURL = `${getBaseURL()}/${
    configData.navigation[type]["api_name"]
  }/${id}/`;

  let request_body = {};
  request_body["name"] = item.name;
  request_body["short_description"] = item.short_description;
  request_body["long_description"] = item.long_description;
  request_body["keywords"] = item.keywords;
  if (type === "PropertyClaim") {
    request_body["claim_type"] = item.claim_type;
  }
  if (type === "Evidence") {
    request_body["URL"] = item.URL;
  }

  const requestOptions = {
    method: "PUT",
    headers: {
      Authorization: `Token ${localStorage.getItem("token")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request_body),
  };
  return fetch(backendURL, requestOptions);
}


// eslint-disable-next-line import/no-anonymous-default-export
export default (props) => <ItemEditor {...props} params={useParams()} />;
