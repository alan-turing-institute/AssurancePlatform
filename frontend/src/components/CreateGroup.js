import React, { useCallback, useState } from "react";
import { getBaseURL } from "./utils.js";
import { ColumnFlow, RowFlow } from "./common/Layout.jsx";
import { Button } from "@mui/material";
import TextInput from "./common/TextInput.jsx";

/**
 * CreateGroup is a form component used for creating a new group within the TEA Platform. It provides a simple interface for entering the name of the new group and submitting it to the server. Upon successful submission, the form invokes a callback function to reflect the change.
 *
 * @param {Object} props - Component props.
 * @param {Function} props.afterSubmit - Callback function to be called after successfully creating a group. It is used to trigger any necessary updates in the parent component, such as refreshing the list of groups.
 * @returns {JSX.Element} A form that allows users to input a name for a new group and create it.
 *
 * This component includes error handling to provide feedback to the user in case of an unsuccessful group creation attempt. It leverages the `TextInput` component for inputting the group's name and validates the input before submission to ensure that a name is provided.
 */
function CreateGroup({ afterSubmit }) {
  const [name, setName] = useState("");
  const [error, setError] = useState();
  const [dirty, setDirty] = useState();

  const onSubmit = useCallback(
    (e) => {
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

      fetch(`${getBaseURL()}/groups/`, requestOptions)
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

export default CreateGroup;
