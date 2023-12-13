import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
} from "@mui/material";
import useId from "@mui/material/utils/useId";
import React, { useCallback, useEffect, useState } from "react";

function TemplateSelector({ value, setValue, error, setError, dirty }) {
  const [dirtyInternal, setDirtyInternal] = React.useState(false);

  const [templates, setTemplates] = useState([]);
  const [defaultValue, setDefaultValue] = useState(0);
  const [valueInner, setValueInner] = useState("");

  const helpTextInternal = error ? error : " ";

  useEffect(() => {
    if (dirty && !dirtyInternal) {
      setDirtyInternal(true);
      if (!value) {
        setError("Please select a template");
      }
    }
  }, [dirty, dirtyInternal, setError, value]);

  useEffect(() => {
    const index = templates.indexOf(value);

    if (index >= 0) {
      setValueInner(index.toString());
    }
  }, [value, templates]);

  useEffect(() => {
    // Import all *.json files from caseTemplates, make a list of the contents.
    const rc = require.context("../caseTemplates", false, /.json$/);
    const newTemplates = [];
    rc.keys().forEach((key) => newTemplates.push(rc(key)));
    // The default case is the one called empty, if it exists, otherwise the first one.
    if (newTemplates.length === 0) return;
    let defaultCase = 0;
    for (let c of newTemplates) {
      if (c.name === "empty") {
        defaultCase = c;
        break;
      }
    }
    setTemplates(newTemplates);
    setDefaultValue(defaultCase);
  }, []);

  const id = useId();

  const onChange = useCallback(
    (e) => {
      setValueInner(e.target.value);
      setValue(templates[Number.parseInt(e.target.value)]);
    },
    [setValue, templates]
  );

  return (
    <FormControl error={!!error}>
      <FormLabel id={id}>Choose template</FormLabel>
      <RadioGroup
        value={valueInner}
        onChange={onChange}
        aria-labelledby={id}
        defaultValue={defaultValue}
      >
        {templates.map((template, i) => (
          <FormControlLabel
            key={i}
            value={i.toString()}
            control={<Radio />}
            label={template.name}
          />
        ))}
      </RadioGroup>
      <FormHelperText>{helpTextInternal}</FormHelperText>
    </FormControl>
  );
}

export default TemplateSelector;
