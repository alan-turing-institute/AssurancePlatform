import { Box, Heading, Select} from 'grommet';
import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import configData from "../config.json"

function CaseSelector() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([
    { label: "Loading ...", value: "" }
  ]);
  const [value, setValue] = useState("Select a case");
  useEffect(() => {
    let unmounted = false;
    let url = `${configData.BASE_URL}/cases/`;
    async function getCases() {
      const response = await fetch(url);
      const body = await response.json();
      if (!unmounted) {
        setItems(body.map(({ id, name }) => ({ id: id, name: name })));
        setLoading(false);
      }
    }
    getCases();
    return () => {
      unmounted = true;
    };
  }, []);
  let navigate = useNavigate();

  function handleChange(option) {
    const id = option.value.id;
    setValue(id);
    navigate("/cases/" + id);
  }

  return (
    <Box width="medium" className="dropdown">
      <Heading level={4}>Select Assurance Case</Heading>
      <Select
        disabled={loading}
        value={value}
        onChange={handleChange}
        options={items}
        labelKey="name"
      />
    </Box>
  );
}

export default CaseSelector;
