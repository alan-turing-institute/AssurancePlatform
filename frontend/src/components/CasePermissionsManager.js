import React, { Component } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBaseURL } from "./utils.js";
import { Box, Button, Form, Heading, RadioButtonGroup, Text } from "grommet";

class CasePermissionsManager extends Component {
  constructor(props) {
    super(props);
    this.permissions = {};
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
      .then((body) => this.setState({ groups: body.member }))
      .then((e) => {
        this.state.groups.forEach((group) => {
          this.setGroupPermission(
            group,
            this.dialValue(group, this.props.assurance_case)
          );
        });
      });
  }

  dialValue(group, assurance_case) {
    if (assurance_case.id in group.editable_cases) return "Edit";
    if (assurance_case.id in group.viewable_cases) return "View";
    return "None";
  }

  setGroupPermission(group, value) {
    const newState = {};
    newState[`permission_${group.id}`] = value;
    this.setState(newState);
  }

  getGroupPermission(group) {
    return this.state[`permission_${group.id}`];
  }

  groupDials(group) {
    console.log(group);
    return (
      <Box key={group.id} direction="row">
        <Text>{group.name}</Text>
        <RadioButtonGroup
          key={group.id}
          name={group.name}
          margin={{ left: "small" }}
          direction="row"
          options={["None", "View", "Edit"]}
          value={this.getGroupPermission(group)}
          onChange={(e) => {
            console.log(e.target);
            this.setGroupPermission(group, e.target.value);
          }}
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
