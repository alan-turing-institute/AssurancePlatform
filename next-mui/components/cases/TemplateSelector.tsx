'use client'

import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
} from "@mui/material";
import useId from "@mui/utils/useId";
import React, { useCallback, useEffect, useState } from "react";
import fs from 'fs';
import path, { resolve } from 'path';

/**
 * A component for selecting a template from a list of templates.
 *
 * @param {Object} props - The props for this component.
 * @param {Object} props.value - The variable that holds the selection.
 * @param {Function} props.setValue - The settes function for `value`.
 * @param {string} props.error - The error message to display.
 * @param {Function} props.setError - The setter function for `error`.
 * @param {boolean} props.dirty - Whether the input has been interacted with.
 * @returns {JSX.Element} A component for selecting a template from a list of templates.
 */
function TemplateSelector({ value, setValue, error, setError, dirty } : any) {
  const [dirtyInternal, setDirtyInternal] = React.useState(false);

  const [templates, setTemplates] = useState<any[]>([]);
  const [defaultValue, setDefaultValue] = useState(0);
  const [valueInner, setValueInner] = useState("");

  const helpTextInternal = error ? error : " ";

  /**
   * If the input has been interacted with and the value is empty, set an error.
   *
   * @returns {void}
   */
  useEffect(() => {
    if (dirty && !dirtyInternal) {
      setDirtyInternal(true);
      if (!value) {
        setError("Please select a template");
      }
    }
  }, [dirty, dirtyInternal, setError, value]);

  /**
   * If the value is set, clear the error.
   *
   * @returns {void}
   */
  useEffect(() => {
    const index = templates.indexOf(value);

    if (index >= 0) {
      setValueInner(index.toString());
    }
  }, [value, templates]);

  const fetchTemplates = async () => {
    const response = await fetch('/api/templates')
    const result = await response.json()
    return result
  }

  /**
   * Import all *.json files from caseTemplates, make a list of the contents.
   *
   * @returns {void}
   */
  useEffect(() => {
    fetchTemplates().then(result => {
      setTemplates(result.newTemplates);
      setDefaultValue(result.defaultCase);
    })
  }, []);
  // useEffect(() => {
  //   // Import all *.json files from caseTemplates, make a list of the contents.
  //   const rc = require.context("../caseTemplates", false, /.json$/);
  //   const newTemplates = [];
  //   rc.keys().forEach((key) => newTemplates.push(rc(key)));
  //   // The default case is the one called empty, if it exists, otherwise the first one.
  //   if (newTemplates.length === 0) return;
  //   let defaultCase = 0;
  //   for (let c of newTemplates) {
  //     if (c.name === "empty") {
  //       defaultCase = c;
  //       break;
  //     }
  //   }
  //   setTemplates(newTemplates);
  //   setDefaultValue(defaultCase);
  // }, []);

  const id = useId();

  /**
   * Set the value of the template.
   *
   * @param {Event} e - The event object.
   * @returns {void}
   */
  const onChange = useCallback(
    (e: any) => {
      setValueInner(e.target.value);
      setValue(templates[Number.parseInt(e.target.value)]);
    },
    [setValue, templates],
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
