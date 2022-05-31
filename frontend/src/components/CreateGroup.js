import { Box, Button, Form, FormField, TextInput } from "grommet";
import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBaseURL } from "./utils.js";

class CreateGroup extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      newGroupName: "",
    };
  }

  async submitCreateGroup() {
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ name: this.state.newGroupName }),
    };

    await fetch(`${getBaseURL()}/groups/`, requestOptions);
    this.setState({ newGroupName: "" });
    this.props.afterSubmit();
  }

  render() {
    return (
      <Form onSubmit={this.submitCreateGroup.bind(this)}>
        <Box gap="small" direction="row">
          <FormField margin={{ left: "small" }}>
            <TextInput
              plain={true}
              value={this.state.newGroupName}
              name="new-group-name"
              onChange={(e) => this.setState({ newGroupName: e.target.value })}
            />
          </FormField>
          <Button type="submit" label="Create group" />
        </Box>
      </Form>
    );
  }
}

// eslint-disable-next-line import/no-anonymous-default-export
export default (props) => (
  <CreateGroup {...props} params={useParams()} navigate={useNavigate()} />
);
