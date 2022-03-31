import { Select } from "grommet";
import React, { Component } from "react";
import { useParams } from "react-router-dom";

class TemplateSelector extends Component {
  constructor(props) {
    super(props);
    this.templates = [];
  }

  componentDidMount() {
    // Import all *.json files from caseTemplates, make a list of the contents.
    const rc = require.context("../caseTemplates", false, /.json$/);
    rc.keys().forEach((key) => this.templates.push(rc(key)));
    // The default case is the one called empty, if it exists, otherwise the first one.
    if (this.templates.length === 0) return null;
    let defaultCase = this.templates[0];
    for (let c of this.templates) {
      if (c.name === "empty") {
        defaultCase = c;
        break;
      }
    }
    this.props.setValue(defaultCase);
  }

  onChange(event) {
    this.props.setValue(event.value);
  }

  render() {
    return (
      <Select
        placeholder="Choose template"
        onChange={this.onChange.bind(this)}
        value={this.props.value}
        options={this.templates}
        labelKey="name"
      />
    );
  }
}

export default (props) => <TemplateSelector {...props} params={useParams()} />;
