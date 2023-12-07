import { saveAs } from "file-saver";
import React, { Component } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Grid, Box, DropButton, Layer, Button, Text, CheckBox } from "grommet";
import {
  FormClose,
  ZoomIn,
  ZoomOut,
  Achievement,
  Article,
  Validate,
  DocumentVerified,
  Add,
} from "grommet-icons";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { v4 as uuidv4 } from "uuid";
import { neatJSON } from "neatjson";
import { Select } from "grommet";
import SVGDownloader from "./SVGDownloader.js";
import CommentSection from "./CommentSection.js";
import CasePermissionsManager from "./CasePermissionsManager.js";
import MermaidChart from "./Mermaid";
import EditableText from "./EditableText.js";
import ItemViewer from "./ItemViewer.js";
import ItemEditor, { postItemUpdate } from "./ItemEditor.js";
import ItemCreator from "./ItemCreator.js";
import memoize from "memoize-one";

import {
  getBaseURL,
  jsonToMermaid,
  getSelfUser,
  visitCaseItem,
  getParentPropertyClaims,
} from "./utils.js";
import configData from "../config.json";
import "./CaseContainer.css";

class CaseContainer extends Component {
  svgDownloader = new SVGDownloader();
  _isMounted = false; // Flag to track mount status
  abortController = new AbortController(); // Instantiate the AbortController

  constructMarkdownMemoised = memoize(jsonToMermaid);

  getIdListMemoised = memoize(updateIdList);

  constructor(props) {
    super(props);
    this.state = {
      showViewLayer: false,
      showEditLayer: false,
      showCreateLayer: false,
      showConfirmDeleteLayer: false,
      showCasePermissionLayer: false,
      loading: true,
      assurance_case: {
        id: 0,
        name: "",
        description: "",
        goals: [],
        color_profile: "default",
      },
      // these aren't perfectly in-sync with itemId and itemType
      /** @type {string?} */
      selectedId: null,
      /** @type {string?} */
      selectedType: null,
      /** @type {string[]} */
      collapsedNodes: [],
      metadata: null,
      /** @type {Set<string>} */
      identifiers: new Set(),
    };

    this.url = `${getBaseURL()}/cases/`;
  }

  handleProfileChange = (color) => {
    this.submitCaseChange("color_profile", color).then((response) => {
      if (response.status === 200) {
        this.updateView();
      }
    });
  };

  fetchData = async (id) => {
    const requestOptions = {
      headers: {
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
    };
    const res = await fetch(this.url + id, requestOptions);
    if (res.status === 200) {
      const json_response = await res.json();
      if (
        JSON.stringify(this.state.assurance_case) !==
        JSON.stringify(json_response)
      ) {
        this.setState({ loading: true });
        this.setState({
          assurance_case: json_response,
        });
        this.setState({ loading: false });
      }
    }

    // log the contents of assurance case
    console.log(this.state.assurance_case);
  };

  submitCaseChange(field, value) {
    // Send to the backend a PUT request, changing the `field` of the current case to be
    // `value`.
    const id = this.state.assurance_case.id;
    const backendURL = `${getBaseURL()}/cases/${id}/`;
    const changeObj = {};
    changeObj[field] = value;
    const requestOptions = {
      method: "PUT",
      headers: {
        Authorization: `Token ${localStorage.getItem("token")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(changeObj),
    };
    return fetch(backendURL, requestOptions);
  }

  deleteCurrentCase() {
    const id = this.state.assurance_case.id;
    const backendURL = `${getBaseURL()}/cases/${id}/`;
    const requestOptions = {
      headers: {
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
      method: "DELETE",
    };
    return fetch(backendURL, requestOptions);
  }

  async getCurrentCaseAsJSON() {
    const id = this.state.assurance_case.id;
    const requestOptions = {
      headers: {
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
    };
    const response = await fetch(this.url + id, requestOptions);
    let json_response = await response.json();
    json_response = neatJSON(json_response);
    // Remove the `id` fields, since they are only meaningful to the backend, and might
    // confuse it when importing the JSON exported here.
    json_response = json_response.replaceAll(/"id":\d+(,)?/g, "");
    return json_response;
  }

  async exportCurrentCase() {
    const metadata = await this.getCurrentCaseAsJSON();
    const name = metadata["name"];
    // Write to a file, which to the user shows as a download.
    const blob = new Blob([metadata], {
      type: "text/plain;charset=utf-8",
    });
    const now = new Date();
    // Using a custom date format because the ones that Date offers are either very long
    // or include characters not allowed in filenames on Windows.
    const datestr =
      now.getFullYear() +
      "-" +
      now.getMonth() +
      "-" +
      now.getDate() +
      "T" +
      now.getHours() +
      "-" +
      now.getMinutes() +
      "-" +
      now.getSeconds();
    const filename = name + "-" + datestr + ".json";
    saveAs(blob, filename);
  }

  async exportCurrentCaseAsSVG() {
    const metadata = await this.getCurrentCaseAsJSON();
    this.svgDownloader.handleDownloadSVG(metadata);
  }

  fetchDataCurrentCase() {
    return this.fetchData(this.props.params.caseSlug);
  }

  componentDidMount() {
    this.fetchData(this.props.params.caseSlug);

    this._isMounted = true; // Component is now mounted
    const id = this.props.params.caseSlug;
    this.setState({ id: id });
    this.fetchData(id);
    this.timer = setInterval(this.fetchDataCurrentCase.bind(this), 5000);
    if (!window.sessionStorage.getItem("session_id")) {
      let uuid = uuidv4();
      window.sessionStorage.setItem("session_id", uuid);
    }
    this.setState({ session_id: window.sessionStorage.session_id });
    // Activate the event listener to see when the browser/tab closes
    this.setupBeforeUnloadListener();
  }
  componentWillUnmount() {
    this.abortController.abort(); // Abort any ongoing fetch requests
    this._isMounted = false; // Component will unmount
    this.cleanup(); // Call cleanup to clear timers and subscriptions
  }

  cleanup() {
    clearInterval(this.timer);
    this.timer = null;
    if (
      this._isMounted &&
      this.state.assurance_case.lock_uuid === this.state.session_id
    ) {
      this.submitCaseChange("lock_uuid", null);
    }
  }

  // Setup the `beforeunload` event listener to detect browser/tab closing
  setupBeforeUnloadListener = () => {
    window.addEventListener("beforeunload", (ev) => {
      return this.cleanup();
    });
  };

  componentWillUnmount() {
    this.cleanup();
  }

  componentDidUpdate(prevProps) {
    const id = this.props.params.caseSlug;
    const oldId = prevProps.params.caseSlug;
    if (id !== oldId) {
      this.setState({ id: id, identifiers: new Set() }, this.updateView);
    }
  }

  updateView() {
    // render() will be called again anytime setState is called, which
    // is done both by hideEditLayer() and hideCreateLayer()
    this.hideViewLayer();
    this.hideEditLayer();
    this.hideCreateLayer();
    return this.fetchData(this.state.id);
  }

  showViewOrEditLayer(e) {
    let chunks = e.split("_");
    if (chunks.length === 2) {
      let itemType = chunks[0];
      let itemId = chunks[1];

      this.setState({ itemType: itemType, itemId: itemId });
      this.setState({ selectedType: itemType, selectedId: itemId });
      if (this.inEditMode()) {
        this.showEditLayer(itemType, itemId);
      } else {
        this.showViewLayer();
      }
    }
  }

  showViewLayer() {
    // use the name of the node to derive the type and id of the item that
    // was clicked on, and set the state accordingly.
    // This will cause a new layer, showing the details of the selected node,
    // to appear (the ItemViewer component)
    // Maybe this is unnecessary, to check that the itemType and itemId state is
    // set, but need to make sure showViewLayer isn't set prematurely.
    if (this.state.itemType && this.state.itemId)
      this.setState({ showViewLayer: true });
  }

  showEditLayer(itemType, itemId) {
    // event.preventDefault();
    // this should be redundant, as the itemId and itemType should already
    // be set when showViewLayer is called, but they can't do any harm..
    this.setState({ itemType: itemType, itemId: itemId });
    // this.hideViewLayer();
    this.setState({ showEditLayer: true });
  }

  showCreateLayer(itemType, parentId, parentType, event) {
    event.preventDefault();
    this.setState({
      createItemType: itemType,
      createItemParentId: parentId,
      createItemParentType: parentType,
    });
    this.setState({ showCreateLayer: true });
  }

  showConfirmDeleteLayer(event) {
    event.preventDefault();
    this.setState({ showConfirmDeleteLayer: true });
  }

  showCasePermissionLayer(event) {
    event.preventDefault();
    this.setState({ showCasePermissionLayer: true });
  }

  resetHighlight() {
    this.setState({ selectedId: null, selectedType: null });
  }

  /** @param {string} nodeKey  */
  toggleNodeVisibility(nodeKey) {
    let newArray = this.state.collapsedNodes.filter((k) => k !== nodeKey);
    if (newArray.length === this.state.collapsedNodes.length) {
      newArray.push(nodeKey);
    }

    this.setState({ collapsedNodes: newArray });
  }

  hideViewLayer() {
    this.resetHighlight();
    this.setState({ showViewLayer: false });
  }

  hideEditLayer() {
    this.resetHighlight();
    this.setState({ showEditLayer: false, itemType: null, itemId: null });
  }

  /**
   * @param {string} type
   * @param {string} parentId
   * @param {string} parentType
   * @returns {string}
   */
  getIdForNewElement(type, parentId, parentType) {
    const newList = new Set([
      ...this.state.identifiers,
      ...this.getIdListMemoised(this.state.assurance_case),
    ]);

    this.setState({ idList: newList });

    let prefix = configData.navigation[type].db_name
      .substring(0, 1)
      .toUpperCase();

    if (type === "PropertyClaim") {
      const parents = getParentPropertyClaims(
        this.state.assurance_case,
        parentId,
        parentType
      );
      if (parents.length > 0) {
        const parent = parents[parents.length - 1];
        prefix = parent.name + ".";
      }
    }

    let i = 1;
    while (newList.has(prefix + i)) {
      i++;
    }

    return prefix + i;
  }

  updateAllIdentifiers() {
    this.setState({ loading: true });

    const promises = [];

    const identifiers = new Set();

    const foundEvidence = new Set();

    function updateItem(item, type, parents) {
      let prefix = configData.navigation[type].db_name
        .substring(0, 1)
        .toUpperCase();

      if (type === "PropertyClaim") {
        const claimParents = parents.filter(t => t.type === "PropertyClaim");
        if(claimParents.length > 0){
          const parent = claimParents[claimParents.length - 1];
          prefix = parent.name + ".";
        }
      }

      let i = 1;
      while (identifiers.has(prefix + i)) {
        i++;
      }

      if(item.name === prefix + i){
        // don't need to post an update
        identifiers.add(item.name);
        return [item, type, parents];
      }

      const itemCopy = {...item};
      itemCopy.name = prefix + i;
      identifiers.add(itemCopy.name);
      promises.push(postItemUpdate(item.id, type, itemCopy))

      return [itemCopy, type, parents];
    }

    // run breadth first search
    /** @type [any, string, any[]] */
    const caseItemQueue = this.state.assurance_case.goals.map((i) =>
      updateItem(i, "TopLevelNormativeGoal", [])
    );

    while (caseItemQueue.length > 0) {
      const [node, nodeType, parents] = caseItemQueue.shift();
      const newParents = [...parents, node];

      configData.navigation[nodeType]["children"].forEach((childName, j) => {
        const childType = configData.navigation[nodeType]["children"][j];
        const dbName = configData.navigation[childName]["db_name"];
        if (Array.isArray(node[dbName])) {
          node[dbName].forEach((child) => {
            if(childType === "Evidence" && foundEvidence.has(child.id)){
              // already found this, skip
              return;
            }

            caseItemQueue.push(updateItem(child, childType, newParents));
            if(childType === "Evidence"){
              foundEvidence.add(child.id);
            }
          });
        }
      });
    }

    this.setState({ identifiers });

    if(promises.length === 0){
      this.setState({ loading: false });
    } else {
      Promise.all(promises).then(() => {
        this.updateView();
      });
    }    
  }

  hideCreateLayer() {
    this.setState({
      showCreateLayer: false,
      createItemType: null,
      createItemParentId: null,
      createItemParentType: null,
    });
  }

  hideConfirmDeleteLayer() {
    this.setState({
      showConfirmDeleteLayer: false,
    });
  }

  hideCasePermissionLayer() {
    this.setState({
      showCasePermissionLayer: false,
    });
  }

  viewLayer() {
    return (
      <Box pad="small" gap="xsmall" height={{ min: "small" }} flex={false}>
        <Button
          alignSelf="end"
          icon={<FormClose />}
          onClick={() => this.hideViewLayer()}
        />
        <ItemViewer
          type={this.state.itemType}
          id={this.state.itemId}
          editItemLayer={this.showEditLayer.bind(this)}
          updateView={this.updateView.bind(this)}
          editMode={this.inEditMode()}
        />
      </Box>
    );
  }

  editLayer() {
    return (
      <Box pad="small" gap="xsmall" height={{ min: "large" }} flex={false}>
        <Button
          alignSelf="end"
          icon={<FormClose />}
          onClick={() => this.hideEditLayer()}
        />
        <ItemEditor
          type={this.state.itemType}
          id={this.state.itemId}
          caseId={this.state.assurance_case.id}
          createItemLayer={this.showCreateLayer.bind(this)}
          updateView={this.updateView.bind(this)}
        />
      </Box>
    );
  }

  createLayer() {
    return (
      <Box>
        <Layer
          full={false}
          position="bottom-right"
          onEsc={() => this.hideCreateLayer()}
          onClickOutside={() => this.hideCreateLayer()}
        >
          <Box
            pad="medium"
            gap="small"
            width={{ min: "medium" }}
            height={{ min: "small" }}
            fill
          >
            <Button
              alignSelf="end"
              icon={<FormClose />}
              onClick={() => this.hideCreateLayer()}
            />
            <Box>
              <ItemCreator
                type={this.state.createItemType}
                parentId={this.state.createItemParentId}
                parentType={this.state.createItemParentType}
                updateView={this.updateView.bind(this)}
                getId={this.getIdForNewElement.bind(this)}
              />
            </Box>
          </Box>
        </Layer>
      </Box>
    );
  }

  confirmDeleteLayer() {
    return (
      <Box>
        <Layer
          position="center"
          onEsc={this.hideConfirmDeleteLayer.bind(this)}
          onClickOutside={this.hideConfirmDeleteLayer.bind(this)}
        >
          <Box pad="medium" gap="small" fill>
            <Text>Are you sure you want to permanently delete this case?</Text>
            <Box direction="row" justify="end" fill={true}>
              <Button
                label="No"
                margin="small"
                onClick={this.hideConfirmDeleteLayer.bind(this)}
              />
              <Button
                label="Yes"
                margin="small"
                onClick={() => {
                  this.deleteCurrentCase().then((response) => {
                    if (response.status === 204) {
                      this.props.navigate("/");
                    } else {
                      // Something seems to have gone wrong.
                      // TODO How should we handle this?
                      this.hideConfirmDeleteLayer();
                    }
                  });
                }}
              />
            </Box>
          </Box>
        </Layer>
      </Box>
    );
  }

  casePermissionLayer() {
    return (
      <Box>
        <Layer
          full="vertical"
          position="bottom-right"
          onEsc={this.hideCasePermissionLayer.bind(this)}
          onClickOutside={this.hideCasePermissionLayer.bind(this)}
        >
          <Box
            pad="medium"
            gap="small"
            width={{ min: "medium" }}
            height={{ min: "small" }}
            fill
          >
            <Button
              alignSelf="end"
              icon={<FormClose />}
              onClick={() => this.hideCasePermissionLayer()}
            />
            <CasePermissionsManager
              assurance_case={this.state.assurance_case}
              afterSubmit={this.hideCasePermissionLayer.bind(this)}
            />
          </Box>
        </Layer>
      </Box>
    );
  }

  inEditMode() {
    //this.updateView();
    return true; // it's always edit time baby!
    //this.state.assurance_case.lock_uuid === this.state.session_id;
  }

  getCreateGoalButton() {
    return (
      <DropButton
        icon={<Achievement />}
        label="Create Goal"
        dropAlign={{ top: "bottom", right: "right" }}
        dropContent={
          <ItemCreator
            type="TopLevelNormativeGoal"
            parentId={this.state.id}
            parentType="AssuranceCase"
            updateView={this.updateView.bind(this)}
            getId={this.getIdForNewElement.bind(this)}
          />
        }
      />
    );
  }

  getCreateSubItemButton(childType) {
    let icon;

    switch (childType) {
      case "Goal":
        icon = <Achievement />;
        break;
      case "Context":
        icon = <Article />;
        break;
      case "PropertyClaim":
        icon = <Validate />;
        break;
      case "Evidence":
        icon = <DocumentVerified />;
        break;
      default:
        icon = <Add />;
        break;
    }

    return (
      <Button
        icon={icon}
        pad="small"
        key={childType}
        onClick={(e) =>
          this.showCreateLayer(
            childType,
            this.state.itemId,
            this.state.itemType,
            e
          )
        }
        label={"Create " + childType}
      />
    );
  }

  getCreateButtons() {
    return (
      <Box gap="xsmall" pad={{ top: "small" }} direction="column" flex={false}>
        {this.getCreateGoalButton()}
        {this.state.itemType &&
          this.state.itemId &&
          configData.navigation[this.state.itemType]["children"].map(
            this.getCreateSubItemButton.bind(this)
          )}
      </Box>
    );
  }

  getEditableControls() {
    return (
      <Box gap="xsmall" pad={{ top: "small" }} direction="column" flex={false}>
        <Box>
          <label>Select Case color profile</label>
          <Select
            value={this.state.assurance_case.color_profile}
            options={Object.keys(configData.mermaid_styles)}
            onChange={({ option }) => this.handleProfileChange(option)}
            labelKey={(option) =>
              option.charAt(0).toUpperCase() + option.slice(1)
            }
            valueKey={(option) => option}
          />
        </Box>

        <Box flex={false}>
          <Grid
            columns={["flex", "flex"]}
            rows={["auto"]}
            gap="xsmall"
            areas={[
              { name: "left", start: [0, 0], end: [0, 0] },
              { name: "right", start: [1, 0], end: [1, 0] },
            ]}
          >
            <Box gridArea="right" flex={false}>
              <Button
                label="Delete case"
                secondary
                onClick={this.showConfirmDeleteLayer.bind(this)}
              />
            </Box>
            <Box gridArea="left" flex={false}>
              {this.state.assurance_case.permissions === "manage" && (
                <Button
                  label="Permissions"
                  secondary
                  onClick={this.showCasePermissionLayer.bind(this)}
                />
              )}
            </Box>
          </Grid>
        </Box>
      </Box>
    );
  }

  render() {
    if (this.state.loading) {
      return <Box>loading</Box>;
    } else if (localStorage.getItem("token") == null) {
      window.location.replace("/login");
      return null;
    } else {
      const markdown = this.constructMarkdownMemoised(
        this.state.assurance_case,
        this.state.selectedType,
        this.state.selectedId,
        this.state.collapsedNodes
      );

      return (
        <Box fill>
          <Box
            gridArea="header"
            direction="row"
            gap="small"
            style={{ height: "5%" }}
            border={{ color: "dark-4", size: "small", side: "bottom" }}
            pad={{
              horizontal: "small",
              top: "medium",
              bottom: "medium",
            }}
          >
            <Box direction="row" align="center" gap="small">
              <Text weight="bold">Case name:</Text>
              <EditableText
                initialValue={this.state.assurance_case.name}
                textsize="xlarge"
                onSubmit={(value) => this.submitCaseChange("name", value)}
                editMode={this.inEditMode()}
              />
            </Box>
            <Box direction="row" align="center" gap="small">
              <Text weight="bold">Description:</Text>
              <EditableText
                initialValue={this.state.assurance_case.description}
                size="small"
                onSubmit={(value) =>
                  this.submitCaseChange("description", value)
                }
                editMode={this.inEditMode()}
              />
              <Button
                label="Export SVG"
                secondary
                onClick={this.exportCurrentCaseAsSVG.bind(this)}
              />
              <Button
                label="Reset names"
                secondary
                onClick={this.updateAllIdentifiers.bind(this)}
              />
            </Box>
          </Box>
          <Grid
            fill
            rows={["auto", "flex"]}
            columns={["25%", "55%", "20%"]}
            gap="none"
            areas={[
              { name: "left", start: [0, 0], end: [0, 1] },
              { name: "main", start: [1, 0], end: [1, 1] },
              { name: "right", start: [2, 0], end: [2, 1] },
            ]}
          >
            {this.state.showCreateLayer &&
              this.state.createItemType &&
              this.state.createItemParentId &&
              this.state.createItemParentType &&
              this.createLayer()}
            {this.state.showConfirmDeleteLayer && this.confirmDeleteLayer()}
            {this.state.showCasePermissionLayer && this.casePermissionLayer()}

            <Box
              gridArea="left"
              direction="column"
              border={{ color: "dark-4", size: "small", side: "right" }}
              gap="small"
              pad={{ horizontal: "small", top: "small", bottom: "small" }}
            >
              <Box flex={false} style={{ height: "25%" }}>
                {this.getCreateButtons()}
              </Box>
              <Box flex={false} style={{ height: "65%", overflow: "auto" }}>
                <CommentSection
                  assuranceCaseId={this.state.assurance_case.id}
                  authorId={getSelfUser()["username"]}
                />
              </Box>
            </Box>

            <Box
              gridArea="main"
              justify="center"
              align="center"
              pad={{ horizontal: "small", top: "small", bottom: "small" }}
            >
              <TransformWrapper
                style={{ width: "100%", height: "100%" }}
                initialScale={1}
                centerOnInit={true}
              >
                {({ zoomIn, zoomOut, resetTransform, ...rest }) => (
                  <React.Fragment>
                    <TransformComponent
                      contentStyle={{ width: "100%", height: "100%" }}
                      wrapperStyle={{ width: "100%", height: "100%" }}
                    >
                      <MermaidChart
                        key={markdown} // Add this line
                        chartmd={markdown}
                        viewLayerFunc={(e) => this.showViewOrEditLayer(e)}
                        toggleCollapseLayerFunc={(e) =>
                          this.toggleNodeVisibility(e)
                        }
                      />
                    </TransformComponent>
                    <Box
                      className="tools"
                      gap="xxsmall"
                      direction="row"
                      justify="start"
                    >
                      <Button
                        secondary
                        onClick={() => zoomIn()}
                        icon={<ZoomIn />}
                      />
                      <Button
                        secondary
                        onClick={() => zoomOut()}
                        icon={<ZoomOut />}
                      />
                      <Button
                        secondary
                        onClick={() => resetTransform()}
                        icon={<FormClose />}
                      />
                    </Box>
                  </React.Fragment>
                )}
              </TransformWrapper>
            </Box>

            <Box
              gridArea="right"
              direction="column"
              border={{ color: "dark-4", size: "small", side: "left" }}
              gap="small"
              flex={false}
              overflow={{ vertical: "scroll", horizontal: "visible" }}
              pad={{ horizontal: "small", top: "small", bottom: "small" }}
            >
              {this.getEditableControls()}
              {this.state.showViewLayer &&
                this.state.itemType &&
                this.state.itemId &&
                this.viewLayer()}
              {this.state.showEditLayer &&
                this.state.itemType &&
                this.state.itemId &&
                this.editLayer()}
            </Box>
          </Grid>
        </Box>
      );
    }
  }
}

/** @returns {string[]}  */
function updateIdList(assuranceCase) {
  const set = [];
  assuranceCase.goals.forEach((goal) => {
    visitCaseItem(goal, (item) => {
      set.push(item.name);
    });
  });
  return set;
}

// eslint-disable-next-line import/no-anonymous-default-export
export default (props) => (
  <CaseContainer {...props} params={useParams()} navigate={useNavigate()} />
);
