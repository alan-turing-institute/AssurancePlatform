import { Box, Button, Form, FormField, Heading, TextInput } from "grommet";
import React, { useState } from "react";
import TemplateSelector from "./TemplateSelector.js";
import { useNavigate } from "react-router-dom";

import configData from "../config.json";

function CaseCreator() {
  const [name, setName] = useState("Name");
  const [template, setTemplate] = useState("Template");
  const [description, setDescription] = useState("Description");

  let baseURL = `${configData.BASE_URL}`;

  let navigate = useNavigate();

  function onChange(event) {
    if (event.target.name === "name") {
      setName(event.target.value);
    } else {
      setDescription(event.target.value);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    // Make a copy of the template.
    const case_json = JSON.parse(JSON.stringify(template));
    case_json["name"] = name;
    case_json["short_description"] = description;

    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(case_json),
    };

    fetch(baseURL + "/cases/", requestOptions)
      .then((response) => response.json())
      .then((json) => {
        navigate("/case/" + json.id);
      });
  }

  return (
    // TODO The visual layout here is a bit ugly, could improve it.
    <Box>
      <Heading level={4}>Create a new assurance case</Heading>
      <Form onSubmit={handleSubmit}>
        <Box direction="column" width="medium">
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
          <TemplateSelector value={template} setValue={setTemplate} />
          <Button type="submit" primary label="Submit" margin="xsmall" />
        </Box>
      </Form>
    </Box>
  );
}

export default CaseCreator;
