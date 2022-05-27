import {
  Box,
  Button,
  Form,
  FormField,
  Heading,
  Layer,
  Text,
  TextInput,
} from "grommet";
import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBaseURL } from "./utils.js";

class Groups extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      userList: [],
      newGroupName: "",
      memberGroups: [],
      ownerGroups: [],
      showMemberManagementLayer: false,
      groupToManage: null,
      managedGroupMemberStr: [],
    };
  }

  async getUsers() {
    const requestOptions = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
    };
    const response = await fetch(`${getBaseURL()}/users/`, requestOptions);
    const users = await response.json();
    await this.setState({ userList: users });
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
    this.getGroups();
  }

  async getGroups() {
    const response = await fetch(`${getBaseURL()}/groups/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
    });
    const body = await response.json();
    this.setState({ memberGroups: body["member"] });
    this.setState({ ownerGroups: body["owner"] });
  }

  async deleteGroup(group) {
    await fetch(`${getBaseURL()}/groups/${group.id}/`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
    });
    this.getGroups();
  }

  userIdsToEmails(userIds) {
    return userIds.map((userId) => {
      for (let candidate of this.state.userList) {
        if (candidate.id === userId) return candidate.email;
      }
      return null;
    });
  }

  userEmailsToIds(userEmails) {
    return userEmails.map((userEmail) => {
      for (let candidate of this.state.userList) {
        if (candidate.email === userEmail) return candidate.id;
      }
      return null;
    });
  }

  ownerGroupLine(group) {
    return (
      <li>
        <Box margin="xsmall" key={group.id} gap="small" direction="row">
          <Heading level={4}>{group.name}</Heading>
          <Button
            label="Manage members"
            alignSelf="end"
            onClick={(e) => this.showMemberManagementLayer(group)}
          />
          <Button label="Delete" onClick={(e) => this.deleteGroup(group)} />
        </Box>
      </li>
    );
  }

  memberGroupLine(group) {
    return (
      <li>
        <Box margin="xsmall" key={group.id} gap="small" direction="row">
          <Heading level={4}>{group.name}</Heading>
        </Box>
      </li>
    );
  }

  async modifyGroupMembers() {
    let userEmails;
    try {
      userEmails = JSON.parse(this.state.managedGroupMemberStr);
    } catch (e) {
      alert("The list of user emails has to be valid JSON.");
      return null;
    }
    const userIds = this.userEmailsToIds(userEmails);
    if (userIds.includes(null)) {
      alert("At least one of the user email addresses was not recognised.");
      return null;
    }
    const requestOptions = {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ members: userIds }),
    };
    await fetch(
      `${getBaseURL()}/groups/${this.state.groupToManage.id}/`,
      requestOptions
    );
    this.hideMemberManagementLayer();
    this.getGroups();
  }

  showMemberManagementLayer(group) {
    this.setState({
      groupToManage: group,
      managedGroupMemberStr: JSON.stringify(
        this.userIdsToEmails(group.members)
      ),
      showMemberManagementLayer: true,
    });
  }

  hideMemberManagementLayer() {
    this.setState({
      groupToManage: null,
      managedGroupMemberStr: "",
      showMemberManagementLayer: false,
    });
  }

  componentDidMount() {
    this.getGroups();
    this.getUsers();
  }

  memberManagementLayer() {
    const group = this.state.groupToManage;
    return (
      <Box>
        <Layer
          position="center"
          onEsc={this.hideMemberManagementLayer.bind(this)}
          onClickOutside={this.hideMemberManagementLayer.bind(this)}
        >
          <Form onSubmit={this.modifyGroupMembers.bind(this)}>
            <Box pad="medium" gap="small" fill>
              <Text>Members of {group.name}</Text>
              <FormField margin={{ left: "small" }}>
                <TextInput
                  plain={true}
                  value={this.state.managedGroupMemberStr}
                  name="managed-group-members"
                  onChange={(e) =>
                    this.setState({
                      managedGroupMemberStr: e.target.value,
                    })
                  }
                />
              </FormField>
              <Box direction="row" justify="end" fill={true}>
                <Button
                  label="Cancel"
                  margin="small"
                  onClick={this.hideMemberManagementLayer.bind(this)}
                />
                <Button type="submit" label="Submit" />
              </Box>
            </Box>
          </Form>
        </Layer>
      </Box>
    );
  }

  render() {
    return (
      <Box gap="medium" width="large" pad="medium">
        {this.state.showMemberManagementLayer && this.memberManagementLayer()}
        <Box gap="small">
          <Heading level={3}>Groups you own</Heading>
          <ul>{this.state.ownerGroups.map(this.ownerGroupLine.bind(this))}</ul>
          <Form onSubmit={this.submitCreateGroup.bind(this)}>
            <Box gap="small" direction="row">
              <FormField margin={{ left: "small" }}>
                <TextInput
                  plain={true}
                  value={this.state.newGroupName}
                  name="new-group-name"
                  onChange={(e) =>
                    this.setState({ newGroupName: e.target.value })
                  }
                />
              </FormField>
              <Button type="submit" label="Create group" />
            </Box>
          </Form>
        </Box>
        <Box gap="small">
          <Heading level={3} margin={{ top: "large" }}>
            Groups you are member of
          </Heading>
          <ul>
            {this.state.memberGroups.map(this.memberGroupLine.bind(this))}
          </ul>
        </Box>
      </Box>
    );
  }
}

export default (props) => (
  <Groups {...props} params={useParams()} navigate={useNavigate()} />
);
