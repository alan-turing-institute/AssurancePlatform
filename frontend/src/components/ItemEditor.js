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
}) {
  const [token] = useLoginToken();

  const onClick = useCallback(() => {
    // TODO wire into #322
    createItem(token, childType, parentId, parentType, "TODO")
      .then(() => onRefresh())
      .catch((err) => {
        console.error(err);
        setErrors(["Could not add " + niceNameforType(childType)]);
      });
  }, [token, childType, parentId, parentType, onRefresh, setErrors]);

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

function PropertyField({ id, type, item, fieldName, onRefresh, ...props }) {
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
    [token, id, type, item, fieldName, onRefresh]
  );

  return (
    <TextInput
      {...props}
      value={item[fieldName]}
      setValue={setValue}
      error={error}
      setError={setError}
      required
    />
  );
}

function PropertySelect({
  label,
  id,
  type,
  item,
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
    [token, id, type, item, fieldName, onRefresh]
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

function ItemEditor({ caseId, assuranceCase, id, type, onRefresh, onHide }) {
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  // TODO #298 prune fields
  const [item, setItem] = useState();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const [parentToAdd, setParentToAdd] = useState();
  const [parentToRemove, setParentToRemove] = useState();

  const [token] = useLoginToken();

  // refresh state
  useEffect(() => {
    if (id && type) {
      setLoading(true);
      setErrors([]);
      setItem(undefined);
    }
  }, [id, type]);

  // fetch item
  useEffect(() => {
    if (token && assuranceCase) {
      let isMounted = true;

      getItem(token, id, type)
        .then((json) => {
          if (!isMounted) {
            return;
          }

          setLoading(false);
          setItem((oldItem) => {
            if (JSON.stringify(json) !== JSON.stringify(oldItem)) {
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
  }, [token, assuranceCase, id, type]);

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
            onRefresh();
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
            onRefresh();
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
              />
              {type === "Evidence" ? (
                <PropertyField
                  label={item.name + " URL"}
                  id={id}
                  type={type}
                  item={item}
                  fieldName="URL"
                  onRefresh={onRefresh}
                />
              ) : type === "PropertyClaim" ? (
                <PropertySelect
                  label="Claim type"
                  id={id}
                  type={type}
                  item={item}
                  fieldName="claim_type"
                  options={configData["property_claim_types"]}
                  onRefresh={onRefresh}
                />
              ) : (
                <></>
              )}
              <Button
                variant="delete"
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
              <Typography fontWeight="bold">Link to {item.name}</Typography>
              {configData.navigation[type].children.map((childType) => (
                <AddItemButton
                  key={childType}
                  childType={childType}
                  parentId={id}
                  parentType={type}
                  onRefresh={onRefresh}
                  setErrors={setErrors}
                />
              ))}
              {configData.navigation[type]["parent_relation"] ===
              "many-to-many" ? (
                <>
                  <ParentSelector
                    type={type}
                    id={id}
                    assuranceCase={assuranceCase}
                    value={parentToAdd}
                    setValue={setParentToAdd}
                    potential={true}
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
                    assuranceCase={assuranceCase}
                    value={parentToRemove}
                    setValue={setParentToRemove}
                    potential={false}
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
      )}
    </>
  );
}

export default ItemEditor;
