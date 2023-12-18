import React, { useCallback, useState } from "react";
import { getBaseURL } from "./utils.js";
import { ColumnFlow, RowFlow } from "./common/Layout.jsx";
import { Button } from "@mui/material";
import TextInput from "./common/TextInput.jsx";

function CreateGroup({ afterSubmit }) {
  const [name, setName] = useState("");
  const [error, setError] = useState();
  const [dirty, setDirty] = useState();

  const onSubmit = useCallback((e) => {
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
  }, [name, afterSubmit]);

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
