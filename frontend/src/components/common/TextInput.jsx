import * as React from "react";
import TextField from "@mui/material/TextField";
import { useCallback, useEffect } from "react";
import { Typography } from "@mui/material";
import { useRef } from "react";

function useInputCallbacks({
  value,
  setValue,
  setError,
  required,
  minLength,
  maxLength,
  validate,
  dirty,
  multiline,
  mermaidFocus,
}) {
  const [valueInternal, setValueInternal] = React.useState(value);
  const [dirtyInternal, setDirtyInternal] = React.useState(false);
  const componentInit = useRef(true);

  const validateInternal = React.useCallback(
    (val) => {
      let error = "";

      if (required && !val) {
        error = "This value is required.";
      } else if (minLength && val.length < minLength) {
        error = `This value must be at least ${minLength} characters`;
      } else if (maxLength && val.length > maxLength) {
        error = `This value must be at most ${maxLength} characters`;
      } else if (validate) {
        error = validate(val);
      }

      return error;
    },
    [validate, required, minLength, maxLength]
  );

  useEffect(() => {
    setValueInternal(value);
  }, [value]);

  // this lets you, e.g., trigger the empty validation message on submit click
  useEffect(() => {
    if (dirty && !dirtyInternal) {
      setDirtyInternal(true);
      setError(validateInternal(value));
    }
  }, [dirty, dirtyInternal, setError, validateInternal, value]);

  const flush = React.useCallback(
    (newValue) => {
      setError(validateInternal(newValue));
      setValue(newValue);
      setDirtyInternal(true);
    },
    [setValue, setError, validateInternal]
  );

  const onChange = useCallback(
    (e) => {
      const newValue = e.target.value ?? "";

      setValueInternal(newValue);

      if (document.activeElement !== e.target) {
        // element isn't focused, so this change was made by, e.g., a password manager
        flush(newValue);
      } else {
        const newError = validateInternal(newValue);

        // don't change the error message as the user types except to remove it
        // because typing a single letter and being told that's not a valid email is annoying
        if (!newError) {
          setError(newError);
        }
      }
    },
    [setError, validateInternal, flush]
  );

  const onBlur = React.useCallback(
    (e) => {
      flush(valueInternal);
    },
    [valueInternal, flush]
  );

  // manually trigger onBlur if a different node is selected on the mermaid chart
  useEffect(() => {
    if (componentInit.current) {
      componentInit.current = false;
      return;
    }
    onBlur();
  }, [mermaidFocus]);

  const onKeydown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        // flush changes before submit
        flush(valueInternal);
      }
    },
    [valueInternal, flush]
  );

  // TODO could also add debouncing

  return {
    valueInternal,
    onChange,
    onBlur,
    onKeydown: multiline ? undefined : onKeydown,
  };
}

// TODO style more like designs

function TextInput({
  value,
  setValue,
  error,
  setError,
  required,
  minLength,
  maxLength,
  validate,
  dirty,
  helperText,
  noRequiredSymbol,
  mermaidFocus,
  ...props
}) {
  const helpTextInternal = error ? error : helperText ?? " ";

  const { valueInternal, onChange, onBlur, onKeydown } = useInputCallbacks({
    value,
    setValue,
    setError,
    required,
    minLength,
    maxLength,
    validate,
    dirty,
    mermaidFocus,
    ...props,
  });

  return (
    <TextField
      {...props}
      error={!!error}
      required={required && !noRequiredSymbol}
      helperText={helpTextInternal}
      value={valueInternal}
      onChange={onChange}
      onBlur={onBlur}
      onKeyDown={onKeydown}
    />
  );
}

export function DisguisedTextInput({
  value,
  setValue,
  error,
  setError,
  required,
  minLength,
  maxLength,
  validate,
  dirty,
  helperText,
  noRequiredSymbol,
  ...props
}) {
  const helpTextInternal = error ? error : helperText ?? " ";

  const [isFocused, setIsFocused] = React.useState(false);

  const { valueInternal, onChange, onBlur, onKeydown } = useInputCallbacks({
    value,
    setValue,
    setError,
    required,
    minLength,
    maxLength,
    validate,
    dirty,
    ...props,
  });

  const onFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const onBlurInner = useCallback(() => {
    onBlur();
    setIsFocused(false);
  }, [onBlur]);

  return isFocused || error ? (
    <TextField
      autoFocus={true}
      {...props}
      error={!!error}
      required={required && !noRequiredSymbol}
      helperText={helpTextInternal}
      value={valueInternal}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlurInner}
      onKeyDown={onKeydown}
    />
  ) : (
    <Typography onFocus={onFocus} variant="h3" component="h1" tabIndex={0}>
      {value}
    </Typography>
  );
}

export default TextInput;
