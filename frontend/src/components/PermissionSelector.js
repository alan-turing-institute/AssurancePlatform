import React, { useMemo, useState } from "react";
import RadioInput from "./common/RadioInput";

function PermissionSelector({ name, value, setValue }) {
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

export default PermissionSelector;
