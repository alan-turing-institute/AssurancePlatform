import { Box, Select } from "grommet";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getBaseURL } from "./utils.js";

function CaseSelector() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([{ label: "Loading ...", value: "" }]);
  const [value, setValue] = useState("Select a case");

  async function getCases(unmounted) {
    let url = `${getBaseURL()}/cases/`;
    const requestOptions = {
      headers: {
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
    };
    const response = await fetch(url, requestOptions);
    const body = await response.json();
    if (!unmounted) {
      setItems(body.map(({ id, name }) => ({ id: id, name: name })));
      setLoading(false);
    }
  }

  useEffect(() => {
    let unmounted = false;
    getCases(unmounted);
    return () => {
      unmounted = true;
    };
  }, []);
  let navigate = useNavigate();

  function handleChange(option) {
    const id = option.value.id;
    setValue(id);
    navigate("/case/" + id);
  }

  function openListOfCases() {
    getCases(false);
  }

  return (
    <Box className="dropdown">
      <Select
        disabled={loading}
        placeholder="Select or create a case"
        value={value}
        onOpen={openListOfCases}
        onChange={handleChange}
        options={[{ name: "Create new case", id: "new" }, ...items]}
        labelKey="name"
      />
    </Box>
  );
}

export default CaseSelector;
