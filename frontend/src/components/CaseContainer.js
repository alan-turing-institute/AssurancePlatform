import { saveAs } from "file-saver";
import React, { Component } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Layer, Text, Grid, DropButton } from "grommet";
import { FormClose, ZoomIn, ZoomOut } from "grommet-icons";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { v4 as uuidv4 } from "uuid";
import { neatJSON } from "neatjson";
import { Select } from "grommet";
import SVGDownloader from "./SVGDownloader.js";

import CasePermissionsManager from "./CasePermissionsManager.js";
import MermaidChart from "./Mermaid";
import EditableText from "./EditableText.js";
import ItemViewer from "./ItemViewer.js";
import ItemEditor from "./ItemEditor.js";
import ItemCreator from "./ItemCreator.js";
import {
  getBaseURL,
  jsonToMermaid,
  highlightNode,
  removeHighlight,
} from "./utils.js";
import configData from "../config.json";
import "./CaseContainer.css";

class CaseContainer extends Component {
  svgDownloader = new SVGDownloader();
  constructor(props) {
    super(props);
    this.state = {
      showViewLayer: false,
      showEditLayer: false,
      showCreateLayer: false,
      showConfirmDeleteLayer: false,
      showCasePermissionLayer: false,
      loading: true,
      floatingMenuVisible: false,
      assurance_case: {
        id: 0,
        name: "",
        description: "",
        goals: [],
        color_profile: "default",
      },
      mermaid_md: "graph TB; \n",
      metadata: null,
    };
    this.toggleFloatingMenu = this.toggleFloatingMenu.bind(this); // Add this line

    this.url = `${getBaseURL()}/cases/`;
  }

  toggleFloatingMenu(visible) {
    this.setState({ floatingMenuVisible: visible });
  }

  handleProfileChange = (color) => {
    this.submitCaseChange("color_profile", color).then((response) => {
      if (response.status === 200) {
        this.updateView();
      }
    });
  };

  closeFloatingMenu = () => {
    // Your logic to close the floating menu
    this.setState({ floatingMenuVisible: false });
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
        this.setState({
          mermaid_md: jsonToMermaid(this.state.assurance_case),
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

  cleanup() {
    clearInterval(this.timer);
    this.timer = null;
    if (this.state.assurance_case.lock_uuid === this.state.session_id) {
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
      this.setState({ id: id }, this.updateView);
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
      this.setState({ loading: true });

      this.setState({
        mermaid_md: highlightNode(
          this.state.mermaid_md,
          this.state.itemType,
          this.state.itemId,
        ),
      });
      this.setState({ loading: false });
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
    this.setState({ loading: true });
    this.setState({
      mermaid_md: removeHighlight(this.state.mermaid_md),
    });
    setTimeout(() => {
      this.setState({ loading: false });
    }, 100);
  }

  hideViewLayer() {
    this.resetHighlight();
    this.setState({ showViewLayer: false });
  }

  hideEditLayer() {
    this.resetHighlight();
    this.setState({ showEditLayer: false, itemType: null, itemId: null });
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
      <Box pad="small" gap="xsmall" height={{ min: "small" }} flex={false}>
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

  enableEditing() {
    if (!this.state.assurance_case.lock_uuid) {
      this.submitCaseChange("lock_uuid", this.state.session_id).then(
        (response) => {
          this.updateView();
        },
      );
    } else if (this.state.assurance_case.lock_uuid !== this.state.session_id) {
      // override!
      if (
        window.confirm(
          "Are you sure?  You might be overwriting someone's work...",
        )
      ) {
        this.submitCaseChange("lock_uuid", this.state.session_id).then(
          (response) => {
            this.updateView();
          },
        );
      }
    }
  }

  disableEditing() {
    if (this.state.assurance_case.lock_uuid) {
      this.submitCaseChange("lock_uuid", null).then((response) => {
        this.updateView();
      });
    }
  }

  inEditMode() {
    return this.state.assurance_case.lock_uuid === this.state.session_id;
  }

  getCreateGoalButton() {
    return (
      <DropButton
        label="Create Goal"
        dropAlign={{ top: "bottom", right: "right" }}
        dropContent={
          <ItemCreator
            type="TopLevelNormativeGoal"
            parentId={this.state.id}
            parentType="AssuranceCase"
            updateView={this.updateView.bind(this)}
          />
        }
      />
    );
  }

  getCreateSubItemButton(childType) {
    return (
      <Button
        pad="small"
        key={childType}
        onClick={(e) =>
          this.showCreateLayer(
            childType,
            this.state.itemId,
            this.state.itemType,
            e,
          )
        }
        label={"Create " + childType}
      />
    );
  }

  getCreateButtons() {
    if (this.state.assurance_case.permissions === "view") {
      return null;
    } else if (this.inEditMode()) {
      return (
        <Box
          gap="xsmall"
          pad={{ top: "small" }}
          direction="column"
          flex={false}
        >
          {this.getCreateGoalButton()}
          {this.state.itemType &&
            this.state.itemId &&
            configData.navigation[this.state.itemType]["children"].map(
              this.getCreateSubItemButton.bind(this),
            )}
        </Box>
      );
    }
  }

  getEditableControls() {
    if (this.state.assurance_case.permissions === "view") {
      return null;
    } else if (this.inEditMode()) {
      return (
        <Box gap="xsmall" flex={false}>
          <Button
            label="Disable editor mode"
            secondary
            onClick={this.disableEditing.bind(this)}
          />

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
    } else if (!this.state.assurance_case.lock_uuid) {
      return (
        <Button
          label="Enable editor mode"
          primary
          onClick={this.enableEditing.bind(this)}
        />
      );
    } else {
      return (
        <Box>
          <Button
            label="Override - enable edit mode"
            color="#ff0000"
            secondary
            onClick={this.enableEditing.bind(this)}
          />
          <Text color="#ff0000">
            Someone else is currently editing this case.
          </Text>
        </Box>
      );
    }
  }

  render() {
    // don't try to render the chart until we're sure we have the full JSON from the DB
    if (this.state.loading) {
      return <Box>loading</Box>;
      // if not logged-in, redirect to login page
    } else if (localStorage.getItem("token") == null) {
      window.location.replace("/login");
      return null;
    } else {
      return (
        <Box fill onClick={this.closeFloatingMenu.bind(this)}>
          <Grid
            fill
            rows={["auto", "auto", "flex"]}
            columns={["flex", "auto", "29%"]}
            gap="none"
            areas={[
              { name: "header", start: [0, 0], end: [1, 0] },
              { name: "main", start: [0, 1], end: [1, 2] },
              { name: "top-mid", start: [1, 0], end: [1, 0] },
              { name: "right", start: [2, 0], end: [2, 2] },
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
              gridArea="header"
              direction="column"
              gap="small"
              pad={{
                horizontal: "small",
                top: "medium",
                bottom: "none",
              }}
            >
              <EditableText
                initialValue={this.state.assurance_case.name}
                textsize="xlarge"
                onSubmit={(value) => this.submitCaseChange("name", value)}
                editMode={this.inEditMode()}
              />
              <EditableText
                initialValue={this.state.assurance_case.description}
                size="small"
                onSubmit={(value) =>
                  this.submitCaseChange("description", value)
                }
                editMode={this.inEditMode()}
              />
            </Box>

            <Box
              gridArea="top-mid"
              direction="column"
              gap="small"
              pad={{
                horizontal: "small",
                top: "small",
                bottom: "none",
              }}
            >
              <Button
                label="Export SVG"
                secondary
                onClick={this.exportCurrentCaseAsSVG.bind(this)}
              />
            </Box>

            <Box
              gridArea="right"
              direction="column"
              gap="small"
              flex={false}
              overflow={{ vertical: "scroll", horizontal: "visible" }}
              pad={{
                horizontal: "small",
                top: "small",
                bottom: "small",
              }}
            >
              {this.getEditableControls()}
              {this.getCreateButtons()}
              {this.state.showViewLayer &&
                this.state.itemType &&
                this.state.itemId &&
                this.viewLayer()}
              {this.state.showEditLayer &&
                this.state.itemType &&
                this.state.itemId &&
                this.editLayer()}
            </Box>

            {/* Floating Menu Layer */}
            {this.state.floatingMenuVisible && (
              <Layer
                position="right"
                modal={false}
                responsive={false}
                onClickOutside={this.closeFloatingMenu.bind(this)}
                onEsc={this.closeFloatingMenu.bind(this)}
              >
                <Box
                  fill="vertical"
                  overflow="auto"
                  width="medium"
                  pad="medium"
                  gap="medium"
                >
                  {this.getEditableControls()}
                  {this.getCreateButtons()}
                  {this.state.showViewLayer &&
                    this.state.itemType &&
                    this.state.itemId &&
                    this.viewLayer()}
                  {this.state.showEditLayer &&
                    this.state.itemType &&
                    this.state.itemId &&
                    this.editLayer()}
                </Box>
              </Layer>
            )}

            <Box
              gridArea="main"
              justify="end"
              fill
              background={{
                color: "white",
                size: "20px 20px",
                image: "radial-gradient(#999999 0.2%, transparent 10%)",
                height: "200px",
                width: "100%",
                repeat: "repeat-xy",
              }}
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
                        chartmd={this.state.mermaid_md}
                        viewLayerFunc={(e) => this.showViewOrEditLayer(e)}
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
                        icon=<ZoomIn />
                      />
                      <Button
                        secondary
                        onClick={() => zoomOut()}
                        icon=<ZoomOut />
                      />
                      <Button
                        secondary
                        onClick={() => resetTransform()}
                        icon=<FormClose />
                      />
                    </Box>
                  </React.Fragment>
                )}
              </TransformWrapper>
            </Box>
          </Grid>
        </Box>
      );
    }
  }
}

// eslint-disable-next-line import/no-anonymous-default-export
export default (props) => (
  <CaseContainer {...props} params={useParams()} navigate={useNavigate()} />
);
