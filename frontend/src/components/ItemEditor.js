/* General function that can create any type of object apart from the top-level Case */

import React, { useState, useEffect, useCallback } from "react";
import ParentSelector from "./ParentSelector.js";
import configData from "../config.json";
import { Button, Typography } from "@mui/material";
import LoadingSpinner from "./common/LoadingSpinner.jsx";
import { useLoginToken } from "../hooks/useAuth.js";
import { createItem, editItem, getItem } from "./caseApi.js";
import { RowFlow } from "./common/Layout.jsx";
import DeleteItemModal from "./DeleteItemModal.jsx";
import { Add, Bin, ChevronRight } from "./common/Icons.jsx";
import TextInput from "./common/TextInput.jsx";
import SelectInput from "./common/SelectInput.jsx";
import ErrorMessage from "./common/ErrorMessage.jsx";

/**
 * niceNameforType returns a human-readable name for the given type.
 *
 * @param {string} type - The type of the item.
 * @returns {string} A human-readable name for the given type.
 */
function niceNameforType(type) {
  switch (type) {
    case "TopLevelNormativeGoal":
    case "Goal":
      return "Goal";
    case "Context":
      return "Context";
    case "PropertyClaim":
      return "Claim";
    case "Evidence":
      return "Evidence";
    default:
      return type;
  }
}

/**
 * AddItemButton provides a button interface for adding a new item (Goal, Context, Claim, or Evidence) as a child to a specified parent within an assurance case. It creates a new item of the specified type and links it to the parent item, then refreshes the view and selects the newly created item.
 *
 * @param {Object} props - Component props.
 * @param {string} props.childType - The type of item to be created.
 * @param {string} props.parentId - The ID of the parent item to which the new item will be linked.
 * @param {string} props.parentType - The type of the parent item.
 * @param {Function} props.onRefresh - Function to refresh the view after the item is added.
 * @param {Function} props.setErrors - Function to display errors.
 * @param {Function} props.getIdForNewElement - Function to generate a new ID for the item being created.
 * @param {Function} props.setSelected - Function to set the newly created item as selected in the UI.
 * @returns {JSX.Element} A button that triggers the creation of a new item when clicked.
 *
 * This component simplifies the process of adding new items to the assurance case by handling the API call and subsequent UI updates.
 */
function AddItemButton({
  childType,
  parentId,
  parentType,
  onRefresh,
  setErrors,
  getIdForNewElement,
  setSelected,
}) {
  const [token] = useLoginToken();

  /**
   * Handle the click event for adding a new item.
   *
   * @returns {void}
   */
  const onClick = useCallback(() => {
    createItem(
      token,
      childType,
      parentId,
      parentType,
      getIdForNewElement(childType, parentId, parentType),
    )
      .then((json) => {
        onRefresh();
        setSelected([json.id.toString(), childType]);
      })
      .catch((err) => {
        console.error(err);
        setErrors(["Could not add " + niceNameforType(childType)]);
      });
  }, [
    token,
    childType,
    parentId,
    parentType,
    onRefresh,
    setErrors,
    getIdForNewElement,
    setSelected,
  ]);

  return (
    <Button
      key={childType}
      variant="outlined"
      startIcon={<Add />}
      onClick={onClick}
    >
      Add {niceNameforType(childType)}
    </Button>
  );
}

/**
 * PropertyField allows editing of a single property (field) of an item within an assurance case. It supports text input and updates the backend upon change. It is used for editing properties like name, description, and URL of items.
 *
 * @param {Object} props - Component props.
 * @param {string} props.id - The ID of the item being edited.
 * @param {string} props.type - The type of the item being edited.
 * @param {Object} props.item - The current state of the item being edited.
 * @param {string} props.fieldName - The name of the field in the item to be edited.
 * @param {Function} props.onRefresh - Function to refresh the parent view upon successful edit.
 * @param {boolean} props.mermaidFocus - Indicates if the field is focused in the Mermaid diagram.
 * @param {Object} [props...props] - Additional props passed to the TextInput component.
 * @returns {JSX.Element} A text input field for editing a property of an item.
 *
 * This component abstracts the input field logic for editing item properties, handling validation, and API update calls.
 */
function PropertyField({
  id,
  type,
  item,
  fieldName,
  onRefresh,
  mermaidFocus,
  ...props
}) {
  const [error, setError] = useState("");

  const [token] = useLoginToken();

  /**
   * Handle the change event for the input field.
   *
   * @param {string} value - The new value of the input field.
   * @returns {void}
   * @throws {Error} If the field cannot be changed.
   */
  const setValue = useCallback(
    (value) => {
      if (item[fieldName] !== value) {
        editItem(token, id, type, { [fieldName]: value })
          .then((response) => {
            if (response.ok) {
              onRefresh();
            } else {
              response.json().then((json) => {
                console.error(json);
                if (json[fieldName]) {
                  setError(json[fieldName]);
                } else {
                  setError("Could not change field");
                }
              });
            }
          })
          .catch((err) => {
            console.error(err);
            setError("Could not change field");
          });
      }
    },
    [token, id, type, item, fieldName, onRefresh],
  );

  return (
    <TextInput
      {...props}
      value={item[fieldName]}
      setValue={setValue}
      error={error}
      setError={setError}
      mermaidFocus={mermaidFocus}
      required
    />
  );
}

/**
 * PropertySelect provides a dropdown selection interface for changing a specific property of an item within an assurance case. It is used for fields where a selection from predefined options is required, like the claim type of a PropertyClaim.
 *
 * @param {Object} props - Component props.
 * @param {string} props.label - The label for the select field.
 * @param {string} props.id - The ID of the item being edited.
 * @param {string} props.type - The type of the item being edited.
 * @param {Object} props.item - The current state of the item being edited.
 * @param {Function} props.setItem - Function to set the updated item state.
 * @param {string} props.fieldName - The name of the field in the item to be edited.
 * @param {Function} props.onRefresh - Function to refresh the parent view upon successful edit.
 * @param {Array} props.options - The options for the dropdown.
 * @param {Object} [props...props] - Additional props passed to the SelectInput component.
 * @returns {JSX.Element} A dropdown select field for editing a specific property of an item.
 *
 * This component simplifies the process of selecting from predefined options for a specific item property, handling the update logic and UI feedback.
 */
function PropertySelect({
  label,
  id,
  type,
  item,
  setItem,
  fieldName,
  onRefresh,
  options,
  ...props
}) {
  const [error, setError] = useState("");

  const [token] = useLoginToken();

  /**
   * Handle the change event for the select field.
   *
   * @param {string} value - The new value of the select field.
   * @returns {void}
   * @throws {Error} If the field cannot be changed.
   */
  const setValue = useCallback(
    (value) => {
      if (item[fieldName] !== value) {
        editItem(token, id, type, { [fieldName]: value })
          .then((response) => {
            if (response.ok) {
              response.json().then((json) => {
                setItem(json);
              });
              onRefresh();
            } else {
              response.json().then((json) => {
                console.error(json);
                if (json[fieldName]) {
                  setError(json[fieldName]);
                } else {
                  setError("Could not change field");
                }
              });
            }
          })
          .catch((err) => {
            console.error(err);
            setError("Could not change field");
          });
      }
    },
    [token, id, type, item, fieldName, onRefresh],
  );

  return (
    <SelectInput
      {...props}
      value={item[fieldName]}
      setValue={setValue}
      error={error}
      setError={setError}
      options={options}
      required
    />
  );
}

/**
 * ItemEditor provides an interface for editing the details of a specific item within an assurance case, such as goals, contexts, claims, or evidence. It allows for editing textual properties, linking to parents, and deleting the item.
 *
 * @param {Object} props - Component props.
 * @param {string} props.caseId - The ID of the assurance case to which the item belongs.
 * @param {string} props.id - The ID of the item being edited.
 * @param {string} props.type - The type of the item being edited.
 * @param {Function} props.onRefresh - Function to refresh the view after editing.
 * @param {Function} props.onHide - Function to hide the editor.
 * @param {Function} props.getIdForNewElement - Function to generate a new ID for linking items.
 * @param {Function} props.setSelected - Function to select an item in the UI.
 * @param {boolean} props.graphUpdate - Flag indicating if the graph should be updated.
 * @param {boolean} props.mermaidFocus - Indicates if the item is focused in the Mermaid diagram.
 * @returns {JSX.Element} An interface for editing an item's details.
 *
 * This component encapsulates the functionality required for editing items within an assurance case, providing fields for editing, options for linking to other items, and actions for deleting the item.
 */
function ItemEditor({
  caseId,
  id,
  type,
  onRefresh,
  onHide,
  getIdForNewElement,
  setSelected,
  graphUpdate,
  mermaidFocus,
}) {
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  // TODO #298 prune fields
  const [item, setItem] = useState();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const [parentToAdd, setParentToAdd] = useState();
  const [parentToRemove, setParentToRemove] = useState();

  const [token] = useLoginToken();

  /**
   * Fetch the item from the server.
   *
   * @returns {void}
   * @throws {Error} If ...
   */
  const updateItem = useCallback(() => {
    if (token) {
      setLoading(true);
      setErrors([]);
      setItem(undefined);

      let isMounted = true;

      getItem(token, id, type)
        .then((json) => {
          if (!isMounted) {
            return;
          }

          setLoading(false);
          setItem((oldItem) => {
            if (JSON.stringify(json) !== JSON.stringify(oldItem)) {
              setParentToAdd();
              setParentToRemove();
              return json;
            } else {
              return oldItem;
            }
          });
        })
        .catch((err) => {
          console.error(err);
          setErrors(["An error occured, please try again later."]);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [token, id, type]);

  /**
   * Fetch the item when the selected node in the graph changes, but **not** for every graph update. Graph updates occur on an interval, and updating the item on this interval re-renders the ItemEditor.
   *
   * @returns {void}
   */
  useEffect(() => {
    updateItem();
  }, [token, id, type]);

  const onDeleteClick = useCallback(() => {
    setDeleteModalOpen(true);
  }, []);

  const onDeleteModalClose = useCallback(() => {
    setDeleteModalOpen(false);
  }, []);

  const onDeleteModalSuccess = useCallback(() => {
    onRefresh();
    onHide();
  }, [onRefresh, onHide]);

  /**
   * Add a parent to the item.
   *
   * @returns {void}
   */
  const submitAddParent = useCallback(() => {
    if (!parentToAdd) {
      return;
    }

    const parentType = parentToAdd["type"];
    const parentId = parentToAdd["id"];

    const idName = configData.navigation[parentType]["id_name"];
    const currentParents = item[idName];
    if (!currentParents.includes(parentId)) {
      editItem(token, id, type, {
        [idName]: [...currentParents, parentId],
      })
        .then((response) => {
          if (response.ok) {
            response.json().then((json) => {
              setItem(json);
            });
            onRefresh();
            setParentToAdd();
          } else {
            setErrors(["Could not add parent"]);
          }
        })
        .catch((err) => {
          console.error(err);
          setErrors(["Could not add parent"]);
        });
    }
  }, [parentToAdd, item, token, id, type, onRefresh]);

  /**
   * Remove a parent from the item.
   *
   * @returns {void}
   */
  const submitRemoveParent = useCallback(() => {
    if (!parentToRemove) {
      return;
    }

    const parentType = parentToRemove["type"];
    const parentId = parentToRemove["id"];

    const idName = configData.navigation[parentType]["id_name"];
    const currentParents = item[idName];
    if (currentParents.includes(parentId)) {
      editItem(token, id, type, {
        [idName]: currentParents.filter((id) => id !== parentId),
      })
        .then((response) => {
          if (response.ok) {
            response.json().then((json) => {
              setItem(json);
            });
            onRefresh();
            setParentToRemove();
          } else {
            setErrors(["Could not remove parent"]);
          }
        })
        .catch((err) => {
          console.error(err);
          setErrors(["Could not remove parent"]);
        });
    }
  }, [parentToRemove, item, token, id, type, onRefresh]);

  return (
    <>
      <RowFlow>
        <Typography fontWeight="bold">Editing: {item?.name}</Typography>
        <Button
          variant="text"
          sx={{ marginLeft: "auto" }}
          onClick={onHide}
          endIcon={<ChevronRight />}
        >
          Hide
        </Button>
      </RowFlow>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <ErrorMessage errors={errors} />
          {item ? (
            <>
              <PropertyField
                multiline
                label={item.name + " Description"}
                placeholder="Write down a small description of what the intentions are."
                id={id}
                type={type}
                item={item}
                fieldName="short_description"
                onRefresh={onRefresh}
                mermaidFocus={mermaidFocus}
                maxLength={
                  configData.user_input_validity.item_editor.desc_char_max_len
                }
              />
              {type === "Evidence" ? (
                <PropertyField
                  label={item.name + " URL"}
                  placeholder="URL of the evidence resource."
                  id={id}
                  type={type}
                  item={item}
                  fieldName="URL"
                  onRefresh={onRefresh}
                  mermaidFocus={mermaidFocus}
                  maxLength={
                    configData.user_input_validity.item_editor
                      .evidence_url_char_max_len
                  }
                />
              ) : type === "PropertyClaim" ? (
                <PropertySelect
                  label="Claim type"
                  id={id}
                  type={type}
                  item={item}
                  setItem={setItem}
                  fieldName="claim_type"
                  options={configData["property_claim_types"]}
                  onRefresh={onRefresh}
                />
              ) : (
                <></>
              )}
              <Button
                variant="text"
                color="error"
                sx={{ marginRight: "auto" }}
                startIcon={<Bin />}
                onClick={onDeleteClick}
              >
                Delete {niceNameforType(type)}
              </Button>
              <DeleteItemModal
                isOpen={deleteModalOpen}
                onClose={onDeleteModalClose}
                onDelete={onDeleteModalSuccess}
                id={id}
                type={type}
                name={item.name}
              />
              {configData.navigation[type].children.length ||
              configData.navigation[type]["parent_relation"] ===
                "many-to-many" ? (
                <>
                  <Typography fontWeight="bold">Link to {item.name}</Typography>
                  {configData.navigation[type].children.map((childType) => (
                    <AddItemButton
                      key={childType}
                      childType={childType}
                      parentId={id}
                      parentType={type}
                      onRefresh={onRefresh}
                      setErrors={setErrors}
                      getIdForNewElement={getIdForNewElement}
                      setSelected={setSelected}
                    />
                  ))}
                  {configData.navigation[type]["parent_relation"] ===
                  "many-to-many" ? (
                    <>
                      <ParentSelector
                        type={type}
                        id={id}
                        caseId={caseId}
                        value={parentToAdd}
                        setValue={setParentToAdd}
                        potential={true}
                        graphUpdate={graphUpdate}
                      />
                      <Button
                        variant="outlined"
                        sx={{ marginRight: "auto" }}
                        onClick={submitAddParent}
                      >
                        Add parent
                      </Button>
                      <ParentSelector
                        type={type}
                        id={id}
                        caseId={caseId}
                        value={parentToRemove}
                        setValue={setParentToRemove}
                        potential={false}
                        graphUpdate={graphUpdate}
                      />
                      <Button
                        variant="outlined"
                        sx={{ marginRight: "auto" }}
                        onClick={submitRemoveParent}
                      >
                        Remove parent
                      </Button>
                    </>
                  ) : (
                    <></>
                  )}
                </>
              ) : (
                <></>
              )}
            </>
          ) : (
            <></>
          )}
        </>
      )}
    </>
  );
}

export default ItemEditor;
