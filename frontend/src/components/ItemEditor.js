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

  // Fetch item when selected node in graph changes, but **not** for every graph update.
  // Graph updates occur on an interval, and updating the item on this interval re-renders the
  // ItemEditor.
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
