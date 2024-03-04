import * as React from "react";
import { useCallback, useEffect } from "react";
import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
} from "@mui/material";
import useId from "@mui/utils/useId";

function RadioInput({
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
  selectKey = (option: any) => option,
  selectText = (option: any) => option,
  ...props
} : any) {
  const [dirtyInternal, setDirtyInternal] = React.useState(false);

  const validateInternal = React.useCallback(
    (val: any) => {
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
    (e: any) => {
      const newKey = e.target.value ?? "";

      const newValue = options.find((option: any) => newKey === selectKey(option));

      setError(validateInternal(newValue));
      setValue(newValue);
      setDirtyInternal(true);
    },
    [setError, validateInternal, setValue, options, selectKey]
  );

  const helpTextInternal = error ? error : helperText ?? " ";

  const labelId = useId();

  return (
    <FormControl error={!!error}>
      <FormLabel id={labelId}>{label}</FormLabel>
      <RadioGroup
        value={value ? selectKey(value) : ""}
        onChange={onChange}
        aria-labelledby={labelId}
        {...props}
      >
        {options.map((option: any) => (
          <FormControlLabel
            key={selectKey(option)}
            value={selectKey(option)}
            control={<Radio />}
            label={selectText(option)}
          />
        ))}
      </RadioGroup>
      <FormHelperText>{helpTextInternal}</FormHelperText>
    </FormControl>
  );
}

export default RadioInput;
