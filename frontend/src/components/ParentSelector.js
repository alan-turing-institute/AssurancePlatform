import { Select } from "grommet";
import React, { Component } from "react";
import { useParams } from "react-router-dom";
import configData from "../config.json";

class ParentSelector extends Component {
  // A dropdown menu component for selecting parents of an item. The props are:
  // type: Item type of the one whose parents we want to select from.
  // id: Id of the item whose parents we want to select from.
  // potential: If true, list as options all possible parents this component could get, that it
  //    doesn't yet have. If false, list its current parents.
  // caseId: Case ID within which to look for potential parents, if `potential=true`.
  // value: The variable that holds the selection.
  // setValue: The settes function for `value`.
  constructor(props) {
    super(props);
    this.state = { options: [] };
  }

  async getCurrentParents() {
    const db_name = configData.navigation[this.props.type]["db_name"];
    const url = `${configData.BASE_URL}/parents/${db_name}/${this.props.id}`;
    const currentParents = [];
    await fetch(url)
      .then((response) => response.json())
      .then((json) => json.forEach((item) => currentParents.push(item)));
    return currentParents;
  }

  async getPotentialParents() {
    const potentialParents = [];
    const parentNames = configData.navigation[this.props.type]["parent_names"];
    const parentApiNames =
      configData.navigation[this.props.type]["parent_api_names"];
    for (let i = 0; i < parentNames.length; i++) {
      const parentName = parentNames[i];
      const parentApiName = parentApiNames[i];
      const url = `${configData.BASE_URL}/${parentApiName}/?case_id=${this.props.caseId}`;
      await fetch(url)
        .then((response) => response.json())
        .then((json) => {
          json.forEach((item) => {
            item["type"] = parentName;
            potentialParents.push(item);
          });
        });
    }
    return potentialParents;
  }

  async componentDidMount() {
    const currentParents = await this.getCurrentParents();
    if (!this.props.potential) {
      this.setState({ options: currentParents });
    } else {
      let potentialParents = await this.getPotentialParents();
      potentialParents = potentialParents.filter((item) => {
        for (let currentParent of currentParents) {
          if (currentParent.id === item.id) return false;
        }
        return true;
      });
      this.setState({ options: potentialParents });
    }
  }

  onChange(event) {
    this.props.setValue(event.value);
  }

  getPlaceholder() {
    if (this.props.potential) {
      return "Choose a potential parent";
    } else {
      return "Choose a parent";
    }
  }

  render() {
    return (
      <Select
        placeholder={this.getPlaceholder()}
        onChange={this.onChange.bind(this)}
        value={this.props.value}
        options={this.state.options}
        labelKey="name"
      />
    );
  }
}

export default (props) => <ParentSelector {...props} params={useParams()} />;
