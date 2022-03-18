import { Select } from "grommet";
import React from "react";

function TemplateSelector(props) {
  // Import all *.json files from caseTemplates, make a list of the contents.
  const templates = [];
  const rc = require.context("../caseTemplates", false, /.json$/);
  rc.keys().forEach((key) => templates.push(rc(key)));

  function onChange(event) {
    props.setValue(event.value);
  }

  return (
    <Select
      placeholder="Choose template"
      onChange={onChange}
      value={props.value}
      options={templates}
      labelKey="name"
    />
  );
}

export default TemplateSelector;
