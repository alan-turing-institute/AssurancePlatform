import React, { Component } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBaseURL } from "./utils.js";
import { Box, Button, Form, Heading, Text } from "grommet";
import PermissionSelector from "./PermissionSelector.js";
import { removeArrayElement } from "./utils.js";

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
    if (group.editable_cases.includes(assurance_case.id)) return "Edit";
    if (group.viewable_cases.includes(assurance_case.id)) return "View";
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

  renderGroupDials(group) {
    const initialValue = this.getGroupPermission(group);
    if (initialValue === undefined)
      return <Text key={group.id}>Loading permissions...</Text>;
    return (
      <Box key={group.id} direction="row">
        <Text>{group.name}</Text>
        <PermissionSelector
          name={group.name}
          initialValue={initialValue}
          setValue={(value) => this.setGroupPermission(group, value)}
        />
      </Box>
    );
  }

  async onSubmit(e) {
    let editGroups = this.props.assurance_case.edit_groups;
    let viewGroups = this.props.assurance_case.view_groups;
    this.state.groups.forEach((group) => {
      const permission = this.getGroupPermission(group);
      const id = group.id;
      if (permission === "View") {
        if (!viewGroups.includes(id)) viewGroups.push(id);
        if (editGroups.includes(id)) removeArrayElement(editGroups, id);
      } else if (permission === "Edit") {
        if (!editGroups.includes(id)) editGroups.push(id);
        if (viewGroups.includes(id)) removeArrayElement(viewGroups, id);
      } else if (permission === "None") {
        if (viewGroups.includes(id)) removeArrayElement(viewGroups, id);
        if (editGroups.includes(id)) removeArrayElement(editGroups, id);
      }
    });
    const requestOptions = {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        view_groups: viewGroups,
        edit_groups: editGroups,
      }),
    };
    await fetch(
      `${getBaseURL()}/cases/${this.props.assurance_case.id}/`,
      requestOptions
    );
    this.props.afterSubmit();
  }

  render() {
    return (
      <Form onSubmit={this.onSubmit.bind(this)}>
        <Heading level={3}>Group permissions</Heading>
        <Box pad="medium" gap="small" fill>
          {this.state.groups.map(this.renderGroupDials.bind(this))}
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
