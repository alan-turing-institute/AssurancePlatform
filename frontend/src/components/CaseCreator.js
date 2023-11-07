import React, { useRef, useState, useEffect } from "react";
import {
  Box,
  Button,
  Form,
  FormField,
  Heading,
  TextInput,
  Layer,
  Text,
} from "grommet";
import {
  FormClose,
  Upload,
  CloudDownload,
  DocumentUpload,
  DocumentDownload,
} from "grommet-icons";
import TemplateSelector from "./TemplateSelector.js";
import { useNavigate, useLocation } from "react-router-dom";
import "regenerator-runtime/runtime";
import { getBaseURL } from "./utils.js";

function CaseCreator() {
  const [name, setName] = useState("Name");
  const [template, setTemplate] = useState("Template");
  const [description, setDescription] = useState("Description");
  const fileInputRef = useRef(null);
  const [showDialog, setShowDialog] = useState(false);
  const [url, setUrl] = useState("");
  const [jsonContent, setJsonContent] = useState(null);

  const location = useLocation();

  useEffect(() => {
    // Check if fileContent is passed in the location state
    if (location.state && location.state.fileContent) {
      const fileContent = location.state.fileContent;
      // Here, you would call the function you use to handle the file import.
      // For example:
      postCaseJSON(fileContent);
    }
  }, [location]);

  const fetchJson = async () => {
    try {
      const response = await fetch(url);
      const jsonText = await response.text();
      try {
        const jsonObject = JSON.parse(jsonText);
        setJsonContent(jsonObject);
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    } catch (error) {
      console.error("Error fetching JSON:", error);
    }
    setShowDialog(false);
  };

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
    case_json["color_profile"] = "default";
    postCaseJSON(JSON.stringify(case_json));
  }

  function importCase(event) {
    const file = fileInputRef.current.files[0];
    const reader = new FileReader();

    reader.onloadend = () => {
      if (file.type === "image/svg+xml") {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(reader.result, "image/svg+xml");
        const svgElement = svgDoc.querySelector("svg");

        if (svgElement && svgElement.hasAttribute("data-metadata")) {
          const metadataStr = svgElement.getAttribute("data-metadata");
          try {
            const metadataJSON = JSON.parse(metadataStr);
            postCaseJSON(metadataJSON);
          } catch (err) {
            console.error("Error parsing metadata:", err);
          }
        }
      } else {
        // If not an SVG, proceed as before
        const case_json = reader.result;
        postCaseJSON(case_json);
      }
    };

    reader.readAsText(file);
  }

  const renderFormFields = () => (
    <Box direction="row" gap="medium" align="center">
      <FormField label="Case Name" name="name">
        <TextInput
          placeholder="Enter case name"
          value={name}
          onChange={onChange}
        />
      </FormField>
      <FormField label="Case Description" name="description">
        <TextInput
          placeholder="Enter case description"
          value={description}
          onChange={onChange}
        />
      </FormField>
      <TemplateSelector value={template} setValue={setTemplate} />
    </Box>
  );

  const renderImportButtons = () => (
    <Box direction="row" gap="small" margin={{ top: "small" }}>
      <Button
        icon={<DocumentUpload />}
        label="Load Local File"
        onClick={() => fileInputRef.current.click()}
      />
      <Button
        icon={<CloudDownload />}
        label="Load from URL"
        onClick={() => setShowDialog(true)}
      />
    </Box>
  );

  const renderImportLayer = () =>
    showDialog && (
      <Layer
        onEsc={() => setShowDialog(false)}
        onClickOutside={() => setShowDialog(false)}
      >
        <Box pad="medium" gap="small" width="medium">
          <Box direction="row" justify="end">
            <Button icon={<FormClose />} onClick={() => setShowDialog(false)} />
          </Box>
          <Text>Enter the URL of the JSON or SVG file you wish to import:</Text>
          <TextInput
            placeholder="https://example.com/case.json"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <Button
            icon={<DocumentDownload />}
            label="Fetch and Load JSON or SVG"
            onClick={fetchJson}
          />
        </Box>
      </Layer>
    );

  if (localStorage.getItem("token") == null) {
    window.location.replace("/login");
    return null;
  } else {
    return (
      <Box fill align="center" justify="start" pad="large">
        <Box
          width="large"
          elevation="small"
          pad="medium"
          round="small"
          background="light-1"
        >
          <Heading level={2} margin="none">
            Create a New Assurance Case
          </Heading>
          <Form onSubmit={handleSubmit}>
            {renderFormFields()}
            <Box align="center" margin={{ top: "medium" }}>
              <Button type="submit" primary label="Submit Case" />
            </Box>
          </Form>
          <Heading level={3} margin={{ top: "large" }}>
            Import Assurance Case
          </Heading>
          {renderImportButtons()}
          {renderImportLayer()}
          <input
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
