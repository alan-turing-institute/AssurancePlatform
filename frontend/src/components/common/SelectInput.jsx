import * as React from "react";
import { useCallback, useEffect } from "react";
import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";
import useId from "@mui/utils/useId";

function SelectInput({
  label,
  value,
  setValue,
  options,
  error,
  setError,
  required,
  validate,
  dirty,
  helperText,
  selectKey = (option) => option,
  selectText = (option) => option,
  ...props
}) {
  const [dirtyInternal, setDirtyInternal] = React.useState(false);

  const validateInternal = React.useCallback(
    (val) => {
      let error = "";

      if (required && !val) {
        error = "This value is required.";
      } else if (validate) {
        error = validate(val);
      }

      return error;
    },
    [validate, required]
  );

  // this lets you, e.g., trigger the empty validation message on submit click
  useEffect(() => {
    if (dirty && !dirtyInternal) {
      setDirtyInternal(true);
      setError(validateInternal(value));
    }
  }, [dirty, dirtyInternal, setError, validateInternal, value]);

  const onChange = useCallback(
    (e) => {
      const newKey = e.target.value ?? "";

      const newValue = options.find(option => newKey === selectKey(option))

      setError(validateInternal(newValue));
      setValue(newValue);
      setDirtyInternal(true);
    },
    [setError, validateInternal, setValue, options, selectKey]
  );

  const helpTextInternal = error ? error : helperText ?? " ";

  const labelId = useId();

  return (
    <FormControl fullWidth error={!!error}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        value={value ? selectKey(value) : ""}
        onChange={onChange}
        label={label}
        {...props}
      >
        {options.map(option => (
          <MenuItem key={selectKey(option)} value={selectKey(option)}>
            {selectText(option)}
          </MenuItem>
        ))}
      </Select>
      <FormHelperText>{helpTextInternal}</FormHelperText>
    </FormControl>
  );
}

export default SelectInput;
