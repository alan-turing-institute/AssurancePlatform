import React, { useCallback, useEffect, useState } from "react";
import { getBaseURL } from "./utils.js";
import CreateGroup from "./CreateGroup.js";
import PermissionSelector from "./PermissionSelector.js";
import { removeArrayElement } from "./utils.js";
import ModalDialog from "./common/ModalDialog.jsx";
import { ColumnFlow, RowFlow } from "./common/Layout.jsx";
import LoadingSpinner from "./common/LoadingSpinner.jsx";
import { Button, Typography } from "@mui/material";
import useId from "@mui/material/utils/useId.js";
import { getCase } from "./caseApi.js";
import { useLoginToken } from "../hooks/useAuth.js";
import ErrorMessage from "./common/ErrorMessage.jsx";

function CasePermissionsManager({
  caseId,
  assuranceCase,
  isOpen,
  onClose,
  onSuccess,
}) {
  const titleId = useId();

  return (
    <ModalDialog aria-labelledby={titleId} open={isOpen} onClose={onClose}>
      <ColumnFlow>
        <Typography id={titleId} variant="h3">
          Group permissions
        </Typography>
        <CasePermissionsManagerInner
          caseId={caseId}
          assurance_case={assuranceCase}
          afterSubmit={onSuccess}
          onClose={onClose}
        />
      </ColumnFlow>
    </ModalDialog>
  );
}

function CasePermissionsManagerInner({
  caseId,
  assuranceCase,
  afterSubmit,
  onClose,
}) {
  const [groups, setGroups] = useState([]);
  const [groupPermissions, setGroupPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  const [token] = useLoginToken();

  const dialValue = useCallback(
    (group) => {
      if (group.editable_cases.includes(caseId)) return "Edit";
      if (group.viewable_cases.includes(caseId)) return "View";
      return "None";
    },
    [caseId]
  );

  const getGroupPermission = useCallback(
    (group) => {
      return groupPermissions[group.id];
    },
    [groupPermissions]
  );

  const setGroupPermission = useCallback((group, value) => {
    setGroupPermissions((oldState) => {
      const newState = { ...oldState };
      newState[group.id] = value;
      return newState;
    });
  }, []);

  const getGroups = useCallback(() => {
    setIsLoading(true);
    setErrors([]);

    const requestOptions = {
      headers: {
        Authorization: `Token ${token}`,
      },
    };
    fetch(`${getBaseURL()}/groups/`, requestOptions)
      .then((response) => response.json())
      .then((body) => {
        const newGroups = body.member;
        setGroups(newGroups);
        newGroups.forEach((group) => {
          setGroupPermission(group, dialValue(group));
        });
        setIsLoading(false);
      })
      .catch((err) => {
        setIsLoading(false);
        console.error(err);
        setErrors(["Could not load groups"]);
      });
  }, [dialValue, setGroupPermission, token]);

  // initial load
  useEffect(() => getGroups(), [getGroups]);

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      setErrors([]);
      setIsLoading(true);

      let loadedCase = assuranceCase;
      if (!loadedCase) {
        try {
          loadedCase = await getCase(token, caseId);
        } catch (err) {
          console.error(err);
          setIsLoading(false);
          setErrors(["Could not load case."]);
          return;
        }
      }

      let editGroups = loadedCase.edit_groups;
      let viewGroups = loadedCase.view_groups;
      groups.forEach((group) => {
        const permission = getGroupPermission(group);
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
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({
          view_groups: viewGroups,
          edit_groups: editGroups,
        }),
      };
      try {
        await fetch(`${getBaseURL()}/cases/${caseId}/`, requestOptions);
        afterSubmit();
      } catch (err) {
        console.error(err);
        setIsLoading(false);
        setErrors(["Could not update permissions."]);
      }
    },
    [afterSubmit, assuranceCase, caseId, getGroupPermission, groups, token]
  );

  return (
    <>
      <Typography component="h4" variant="body1">
        Create a new group
      </Typography>
      <CreateGroup afterSubmit={getGroups} />
      <ErrorMessage errors={errors} />
      <ColumnFlow component={"form"} onSubmit={onSubmit}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            {groups.map((group) => (
              <PermissionSelector
                key={group.name}
                name={group.name}
                value={getGroupPermission(group)}
                setValue={(value) => setGroupPermission(group, value)}
              />
            ))}
            <RowFlow>
              <Button
                onClick={onClose}
                variant="outlined"
                sx={{ marginLeft: "auto" }}
              >
                Cancel
              </Button>
              <Button type="submit">Submit</Button>
            </RowFlow>
          </>
        )}
      </ColumnFlow>
    </>
  );
}

export default CasePermissionsManager;
