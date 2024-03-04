import React, { useCallback, useEffect, useMemo, useState } from "react";
import RadioInput from "@/components/common/RadioInput";
import { removeArrayElement } from "@/utils";
import ModalDialog from "@/components/common/ModalDialog";
import { ColumnFlow, RowFlow } from "@/components/common/Layouts";
// import LoadingSpinner from "./common/LoadingSpinner.jsx";
import { Button, Typography } from "@mui/material";
import useId from "@mui/material/utils/useId.js";
import { useLoginToken } from "@/hooks/useAuth";
import ErrorMessage from "@/components/common/ErrorMessage";
import TextInput from "@/components/common/TextInput";

/**
 * PermissionsCaseModal serves as a modal dialog for managing group permissions for a specific assurance case within the TEA Platform. It provides an interface for viewing and editing the access levels (view or edit) of various groups associated with the case.
 *
 * @param {Object} props - Component props.
 * @param {string} props.caseId - The unique identifier of the assurance case.
 * @param {Object} props.assuranceCase - The assurance case object.
 * @param {boolean} props.isOpen - Controls the visibility of the modal dialog.
 * @param {Function} props.onClose - Callback function that is called when the modal is requested to be closed.
 * @param {Function} props.onSuccess - Callback function that is called after successfully updating permissions.
 * @returns {JSX.Element} A modal dialog for managing group permissions.
 */
function PermissionsCaseModal({
  caseId,
  assuranceCase,
  isOpen,
  onClose,
  onSuccess,
} : any) {
  const titleId = useId();

  return (
    <ModalDialog aria-labelledby={titleId} open={isOpen} onClose={onClose}>
      <ColumnFlow>
        <Typography id={titleId} variant="h3">
          Group permissions
        </Typography>
        <PermissionsInner
          caseId={caseId}
          assurance_case={assuranceCase}
          afterSubmit={onSuccess}
          onClose={onClose}
        />
      </ColumnFlow>
    </ModalDialog>
  );
}

/**
 * CasePermissionsManagerInner is the core component within the CasePermissionsManager modal dialog, responsible for the actual management of group permissions. It allows users to assign 'view' or 'edit' permissions to groups for the specified assurance case, or remove their access entirely.
 *
 * @param {Object} props - Component props.
 * @param {string} props.caseId - The unique identifier of the assurance case for which permissions are being managed.
 * @param {Object} props.assuranceCase - The assurance case object, used for preloading existing permissions.
 * @param {Function} props.afterSubmit - Callback function that is called after permissions are successfully updated.
 * @param {Function} props.onClose - Callback function to close the permissions manager.
 * @returns {JSX.Element} The interface for managing group permissions, including a list of groups with selectable permissions and action buttons to submit changes or cancel the operation.
 */
function PermissionsInner({
  caseId,
  assuranceCase,
  afterSubmit,
  onClose,
}: any) {
  const [groups, setGroups] = useState([]);
  const [groupPermissions, setGroupPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<any[]>([]);

  const [token] = useLoginToken();

  const dialValue = useCallback(
    (group: any) => {
      if (group.editable_cases.includes(caseId)) return "Edit";
      if (group.viewable_cases.includes(caseId)) return "View";
      return "None";
    },
    [caseId],
  );

  const getGroupPermission = useCallback(
    (group: any) => {
      return groupPermissions[group.id];
    },
    [groupPermissions],
  );

  const setGroupPermission = useCallback((group: any, value: any) => {
    setGroupPermissions((oldState) => {
      const newState = { ...oldState };
      // @ts-ignore
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
    fetch(`http://localhost:8000/api/groups/`, requestOptions)
      .then((response) => response.json())
      .then((body) => {
        const newGroups = body.member;
        setGroups(newGroups);
        newGroups.forEach((group: any) => {
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
    async (e:any) => {
      e.preventDefault();

      setErrors([]);
      setIsLoading(true);

      let loadedCase = assuranceCase;
      if (!loadedCase) {
        try {
          // loadedCase = await getCase(token, caseId);
          const requestOptions: RequestInit = {
            headers: {
              Authorization: `Token ${token}`,
            },
          };
        
          const response = await fetch(`http://localhost:8000/api/cases/${caseId}/`, requestOptions);
          loadedCase = await response.json()
        } catch (err) {
          console.error(err);
          setIsLoading(false);
          setErrors(["Could not load case."]);
          return;
        }
      }

      let editGroups = loadedCase.edit_groups;
      let viewGroups = loadedCase.view_groups;
      groups.forEach((group: any) => {
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
        await fetch(`http://localhost:8000/api/cases/${caseId}/`, requestOptions);
        afterSubmit();
      } catch (err) {
        console.error(err);
        setIsLoading(false);
        setErrors(["Could not update permissions."]);
      }
    },
    [afterSubmit, assuranceCase, caseId, getGroupPermission, groups, token],
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
          // <LoadingSpinner />
          <p>Loading...</p>
        ) : (
          <>
            {groups.map((group: any) => (
              <PermissionSelector
                key={group.name}
                name={group.name}
                value={getGroupPermission(group)}
                setValue={(value: any) => setGroupPermission(group, value)}
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

/**
 * PermissionSelector is a component for selecting the permission level for a user or group on an item.
 *
 * @param {Object} props - Component props.
 * @param {string} props.name - The name of the permission selector.
 * @param {string} props.value - The current value of the permission selector.
 * @param {Function} props.setValue - A function to set the value of the permission selector.
 * @returns {JSX.Element} A permission selector component.
 */
function PermissionSelector({ name, value, setValue } : any) {
  const options = useMemo(() => ["None", "View", "Edit"], []);
  const [error, setError] = useState("");

  return (
    <RadioInput
      row
      label={name}
      options={options}
      value={value}
      setValue={setValue}
      required
      error={error}
      setError={setError}
    />
  );
}

/**
 * CreateGroup is a form component used for creating a new group within the TEA Platform. It provides a simple interface for entering the name of the new group and submitting it to the server. Upon successful submission, the form invokes a callback function to reflect the change.
 *
 * @param {Object} props - Component props.
 * @param {Function} props.afterSubmit - Callback function to be called after successfully creating a group. It is used to trigger any necessary updates in the parent component, such as refreshing the list of groups.
 * @returns {JSX.Element} A form that allows users to input a name for a new group and create it.
 *
 * This component includes error handling to provide feedback to the user in case of an unsuccessful group creation attempt. It leverages the `TextInput` component for inputting the group's name and validates the input before submission to ensure that a name is provided.
 */
function CreateGroup({ afterSubmit }: any) {
  const [name, setName] = useState("");
  const [error, setError] = useState<any>();
  const [dirty, setDirty] = useState<boolean>();

  const onSubmit = useCallback(
    (e: any) => {
      e.preventDefault();

      if (!name) {
        setDirty(true);
        return;
      }

      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ name }),
      };

      fetch(`http://localhost:8000/api/groups/`, requestOptions)
        .then(() => {
          setName("");
          afterSubmit();
        })
        .catch((err) => {
          console.error(err);
          setError("Could not create group");
        });
    },
    [name, afterSubmit],
  );

  return (
    <ColumnFlow component="form" onSubmit={onSubmit}>
      <TextInput
        label="Name"
        value={name}
        setValue={setName}
        error={error}
        setError={setError}
        dirty={dirty}
        required
        noRequiredSymbol
      />
      <RowFlow>
        <Button sx={{ marginLeft: "auto" }} variant="outlined" type="submit">
          Create group
        </Button>
      </RowFlow>
    </ColumnFlow>
  );
}

export default PermissionsCaseModal;
