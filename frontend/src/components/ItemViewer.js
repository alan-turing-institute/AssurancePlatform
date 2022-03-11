/* General function that can view any type of object apart from the top-level Case */

import { Box, Button, Heading } from "grommet";
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import configData from "../config.json";

function ItemViewer(props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([{ label: "Loading ...", value: "" }]);

  useEffect(() => {
    let unmounted = false;
    let url = `${configData.BASE_URL}/${
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
      {props.type === "Evidence" && (
        <Box>
          <Heading level={4}> URL </Heading>
          <p>{items.URL}</p>
        </Box>
      )}
      <Box>
        <Button
          onClick={(e) => props.editItemLayer(props.type, props.id, e)}
          label="Edit"
        />
      </Box>
    </Box>
  );
}

export default (props) => <ItemViewer {...props} params={useParams()} />;
