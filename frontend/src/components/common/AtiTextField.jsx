import * as React from "react";
import TextField from "@mui/material/TextField";

// TODO style more like designs

function AtiTextField({
  value,
  setValue,
  helperText,
  error,
  setError,
  dirty,
  required,
  noRequiredSymbol,
  validate,
  ...props
}) {
  const [dirtyInternal, setDirtyInternal] = React.useState(false);

  const helpTextInternal = error ? error : helperText ?? " ";

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
  React.useEffect(() => {
    if (dirty && !dirtyInternal) {
      setDirtyInternal(true);
      setError(validateInternal(value));
    }
  }, [dirty, dirtyInternal, setError, validateInternal, value]);

  const onChange = React.useCallback(
    (e) => {
      const newValue = e.target.value ?? "";

      setValue(newValue);

      if (document.activeElement !== e.target) {
        // element isn't focused, so this change was made by, e.g., a password manager
        setError(validateInternal(newValue));
        setDirtyInternal(true);
      } else {
        const newError = validateInternal(newValue);

        // don't change the error message as the user types except to remove it
        // because typing a single letter and being told that's not a valid email is annoying
        if (!newError) {
          setError(newError);
        }
      }
    },
    [setError, validateInternal, setValue]
  );

  const onBlur = React.useCallback(() => {
    setError(validateInternal(value));
    setDirtyInternal(true);
  }, [value, setError, validateInternal]);

  // TODO could also add debouncing

  return (
    <TextField
      {...props}
      error={!!error}
      required={required && !noRequiredSymbol}
      helperText={helpTextInternal}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
    />
  );
}

export default AtiTextField;
