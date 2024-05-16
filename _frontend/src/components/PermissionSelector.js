import React, { useMemo, useState } from "react";
import RadioInput from "./common/RadioInput";

/**
 * PermissionSelector is a component for selecting the permission level for a user or group on an item.
 *
 * @param {Object} props - Component props.
 * @param {string} props.name - The name of the permission selector.
 * @param {string} props.value - The current value of the permission selector.
 * @param {Function} props.setValue - A function to set the value of the permission selector.
 * @returns {JSX.Element} A permission selector component.
 */
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
