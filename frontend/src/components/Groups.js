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
import {
  getBaseURL,
  joinCommaSeparatedString,
  splitCommaSeparatedString,
} from "./utils.js";
import CreateGroup from "./CreateGroup.js";

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

  userIdsToNames(userIds) {
    return userIds.map((userId) => {
      for (let candidate of this.state.userList) {
        if (candidate.id === userId) return candidate.username;
      }
      return null;
    });
  }

  userNamesToIds(userNames) {
    return userNames.map((userName) => {
      for (let candidate of this.state.userList) {
        if (candidate.username === userName) return candidate.id;
      }
      return null;
    });
  }

  ownerGroupLine(group) {
    return (
      <li key={group.id}>
        <Box margin="xsmall" gap="small" direction="row">
          <Heading level={4}>{group.name}</Heading>
          <Button
            label="Manage members"
            onClick={(e) => this.showMemberManagementLayer(group)}
          />
          <Button label="Delete" onClick={(e) => this.deleteGroup(group)} />
        </Box>
      </li>
    );
  }

  memberGroupLine(group) {
    return (
      <li key={group.id}>
        <Box margin="xsmall" gap="small" direction="row">
          <Heading level={4}>{group.name}</Heading>
        </Box>
      </li>
    );
  }

  async modifyGroupMembers() {
    const userNames = splitCommaSeparatedString(
      this.state.managedGroupMemberStr
    );
    const userIds = this.userNamesToIds(userNames);
    if (userIds.includes(null)) {
      alert(
        "At least one of the user names was not recognised. The input should be a comma-separated list of user name of existing users."
      );
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
      managedGroupMemberStr: joinCommaSeparatedString(
        this.userIdsToNames(group.members)
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
      <Layer
        position="center"
        width="large"
        onEsc={this.hideMemberManagementLayer.bind(this)}
        onClickOutside={this.hideMemberManagementLayer.bind(this)}
      >
        <Form onSubmit={this.modifyGroupMembers.bind(this)}>
          <Box pad="medium" width={{ min: "large" }} gap="small" fill>
            <Text>Members of {group.name}</Text>
            <FormField margin={{ left: "small" }}>
              <TextInput
                value={this.state.managedGroupMemberStr}
                name="managed-group-members"
                onChange={(e) =>
                  this.setState({
                    managedGroupMemberStr: e.target.value,
                  })
                }
              />
            </FormField>
            <Box direction="row" gap="small" justify="end" fill>
              <Button
                label="Cancel"
                onClick={this.hideMemberManagementLayer.bind(this)}
              />
              <Button type="submit" label="Submit" />
            </Box>
          </Box>
        </Form>
      </Layer>
    );
  }

  render() {
    return (
      <Box pad="medium" overflow="auto">
        {this.state.showMemberManagementLayer && this.memberManagementLayer()}
        <Box gap="small" flex={false}>
          <Heading level={3}>Groups you own</Heading>
          <ul>
            {this.state.ownerGroups.map(this.ownerGroupLine.bind(this))}
            <li>
              <CreateGroup afterSubmit={this.getGroups.bind(this)} />
            </li>
          </ul>
        </Box>
        <Box gap="small" margin={{ top: "large" }} flex={false}>
          <Heading level={3}>Groups you are member of</Heading>
          <ul>
            {this.state.memberGroups.map(this.memberGroupLine.bind(this))}
          </ul>
        </Box>
      </Box>
    );
  }
}

// eslint-disable-next-line import/no-anonymous-default-export
export default (props) => (
  <Groups {...props} params={useParams()} navigate={useNavigate()} />
);
