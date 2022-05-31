import React, { Component } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, RadioButton } from "grommet";

class PermissionSelector extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    // Grommet also has an element called RadioButtonGroup, which should be perfect for
    // this, but as of 2022-05-26 it's too buggy to use: Having more than one of them on
    // the same page causes the onChange events of one to affect the others.
    return (
      <Box
        key={this.props.name}
        direction="row"
        margin={{ left: "small" }}
        gap="xsmall"
      >
        <RadioButton
          name={this.props.name}
          label="None"
          checked={this.props.value === "None"}
          onChange={(e) => {
            if (e.target.checked) this.setState({ value: "None" });
            this.props.setValue("None");
          }}
        />
        <RadioButton
          name={this.props.name}
          label="View"
          checked={this.props.value === "View"}
          onChange={(e) => {
            if (e.target.checked) this.setState({ value: "View" });
            this.props.setValue("View");
          }}
        />
        <RadioButton
          name={this.props.name}
          label="Edit"
          checked={this.props.value === "Edit"}
          onChange={(e) => {
            if (e.target.checked) this.setState({ value: "Edit" });
            this.props.setValue("Edit");
          }}
        />
      </Box>
    );
  }
}

// eslint-disable-next-line import/no-anonymous-default-export
export default (props) => (
  <PermissionSelector
    {...props}
    params={useParams()}
    navigate={useNavigate()}
  />
);
