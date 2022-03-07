import { Box, Button, Form, FormField, Heading, TextInput } from "grommet";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import configData from "../config.json";

function CaseCreator() {
  const [name, setName] = useState("Name");
  const [description, setDescription] = useState("Description");

  let url = `${configData.BASE_URL}/cases/`;

  let navigate = useNavigate();

  function onChange(event) {
    if (event.target.name == "name") {
      setName(event.target.value);
    } else {
      setDescription(event.target.value);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    let state = { name: name, description: description };
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    };

    console.log("submit button pressed with state ", JSON.stringify(state));
    fetch(url, requestOptions)
      .then((response) => response.json())
      .then((json) => {
        navigate("/cases/" + json.id);
      });
  }

  return (
    <Box>
      <Heading level={4}>Create a new assurance case</Heading>
      <Form onSubmit={handleSubmit}>
        <Box direction="row">
          <FormField margin="xsmall">
            <TextInput placeholder={name} name="name" onChange={onChange} />
          </FormField>
          <FormField margin="xsmall">
            <TextInput
              placeholder={description}
              name="description"
              onChange={onChange}
            />
          </FormField>
        </Box>
        <Button type="submit" primary label="Submit" margin="xsmall" />
      </Form>
    </Box>
  );
}

export default CaseCreator;
