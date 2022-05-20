import React, { Component } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBaseURL } from "./utils.js";
import {
  Box,
  Button,
  Form,
  Heading,
  RadioButtonGroup,
  Text,
  TextInput,
} from "grommet";

class CasePermissionsManager extends Component {
  constructor(props) {
    super(props);
    this.state = {
      groups: [],
      editGroupsStr: "",
      viewGroupsStr: "",
    };
  }

  componentDidMount() {
    const requestOptions = {
      headers: {
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
    };
    fetch(`${getBaseURL()}/groups/`, requestOptions)
      .then((response) => response.json())
      .then((body) => {
        this.setState({ groups: body.member });
      });
  }

  groupDials(group) {
    return (
      <Box key={group.name} direction="row">
        <Text>{group.name}</Text>
        <RadioButtonGroup
          name={group.name}
          margin={{ left: "small" }}
          direction="row"
          options={["None", "View", "Edit"]}
        />
      </Box>
    );
  }

  render() {
    return (
      <Form>
        <Heading level={3}>Group permissions</Heading>
        <Box pad="medium" gap="small" fill>
          {this.state.groups.map(this.groupDials.bind(this))}
          <Button type="submit" label="Submit" />
        </Box>
      </Form>
    );
  }
}
export default (props) => (
  <CasePermissionsManager
    {...props}
    params={useParams()}
    navigate={useNavigate()}
  />
);
