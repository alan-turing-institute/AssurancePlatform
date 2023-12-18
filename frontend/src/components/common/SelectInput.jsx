import * as React from "react";
import { useCallback, useEffect } from "react";
import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";
import useId from "@mui/material/utils/useId";

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
      const newValue = e.target.value ?? "";

      setError(validateInternal(newValue));
      setValue(newValue);
      setDirtyInternal(true);
    },
    [setError, validateInternal, setValue]
  );


  const helpTextInternal = error ? error : helperText ?? " ";

  const labelId = useId();

  return (
    <FormControl fullWidth error={!!error}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        value={value}
        onChange={onChange}
        label={label}
        {...props}
      >
        {options.map(([id, text]) => (
          <MenuItem key={id} value={id}>
            {text}
          </MenuItem>
        ))}
      </Select>
      <FormHelperText>{helpTextInternal}</FormHelperText>
    </FormControl>
  );
}

export default SelectInput;
