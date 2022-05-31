/* General function that can view any type of object apart from the top-level Case */

import { Box, Button, Heading } from "grommet";
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getBaseURL } from "./utils.js";
import configData from "../config.json";

function ItemViewer(props) {
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
      if (!unmounted && items.id !== body.id) {
        setItems(body);
      }
    }
    getCurrent();
    return () => {
      unmounted = true;
    };
  });

  return (
    <Box>
      <Heading level={2}>
        {props.type} {props.id}
      </Heading>
      <Box>
        <Heading level={4}> Name </Heading>
        <p>{items.name}</p>
      </Box>
      <Box>
        <Heading level={4}> Short description </Heading>
        <p>{items.short_description}</p>
      </Box>
      <Box>
        <Heading level={4}> Long description </Heading>
        <p>{items.long_description}</p>
      </Box>
      <Box>
        <Heading level={4}> Keywords </Heading>
        <p>{items.keywords}</p>
      </Box>
      {props.type === "PropertyClaim" && (
        <Box>
          <Heading level={4}> Claim type </Heading>
          <p>{items.claim_type}</p>
        </Box>
      )}
      {props.type === "Evidence" && (
        <Box>
          <Heading level={4}> URL </Heading>
          <p>{items.URL}</p>
        </Box>
      )}
      {props.editMode && (
        <Box>
          <Button
            onClick={(e) => props.editItemLayer(props.type, props.id, e)}
            label="Edit"
          />
        </Box>
      )}
    </Box>
  );
}

// eslint-disable-next-line import/no-anonymous-default-export
export default (props) => <ItemViewer {...props} params={useParams()} />;
