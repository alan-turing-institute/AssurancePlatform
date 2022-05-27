import { Box, Button, Form, FormField, Heading, TextInput } from "grommet";
import React, { useRef, useState } from "react";
import TemplateSelector from "./TemplateSelector.js";
import { useNavigate } from "react-router-dom";

import { getBaseURL } from "./utils.js";

function CaseCreator() {
  const [name, setName] = useState("Name");
  const [template, setTemplate] = useState("Template");
  const [description, setDescription] = useState("Description");
  const fileInputRef = useRef(null);

  let baseURL = `${getBaseURL()}`;

  let navigate = useNavigate();

  function onChange(event) {
    if (event.target.name === "name") {
      setName(event.target.value);
    } else {
      setDescription(event.target.value);
    }
  }

  function postCaseJSON(json_str) {
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
      body: json_str,
    };

    fetch(baseURL + "/cases/", requestOptions)
      .then((response) => response.json())
      .then((json) => {
        navigate("/case/" + json.id);
      });
  }

  function handleSubmit(event) {
    event.preventDefault();
    // Make a copy of the template.
    const case_json = JSON.parse(JSON.stringify(template));
    case_json["name"] = name;
    case_json["description"] = description;
    postCaseJSON(JSON.stringify(case_json));
  }

  function importCase(event) {
    const file = fileInputRef.current.files[0];
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onloadend = () => {
      const case_json = reader.result;
      postCaseJSON(case_json);
    };
  }
  if (localStorage.getItem("token") == null) {
    window.location.replace("/login");
    return null;
  } else {
    return (
      // TODO The visual layout here is a bit ugly, could improve it.

      <Box margin="medium" overflow="auto">
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
        <Box direction="column" margin={{ top: "medium" }} width="medium">
          <Heading level={4} margin={{ top: "medium" }}>
            Import an assurance case from file
          </Heading>
          <Button
            label="Import"
            margin="xsmall"
            onClick={(event) => fileInputRef.current.click()}
          />
          <input
            // An invisible file selector input, that will be triggered by the import button.
            type="file"
            id="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={importCase}
          />
        </Box>
      </Box>
    );
  }
}

export default CaseCreator;
