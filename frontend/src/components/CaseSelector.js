import React, {useState, useEffect} from 'react';
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
        setItems(body.map(({ id, name }) => ( {id:id,  name: name })));
        setLoading(false);
      }
    }
    getCases();
    return () => {
      unmounted = true;
    };
  }, []);
  let navigate = useNavigate();
  function handleChange(event) {
    let caseId = event.currentTarget.value
    setValue(caseId);
    navigate("/cases/"+caseId)
  }
  
  return (
    <div className="dropdown">
      <p>Select Assurance Case</p>
      <select 
      disabled={loading}
      value={value}
      onChange={handleChange} 
      >
        {items.map(({ id, name }) => (
        <option key={id} value={id}>
        {name}
        </option>
        ))}
      </select>
  </div>
  );
}

export default CaseSelector;
/*
const CaseSelector = (props) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([
    { id: "Loading ...", name: "" }
  ]);
  useEffect(() => {
    async function getOptions() {
      let url = `${configData.BASE_URL}/cases` 
      const response = await fetch(url);
      const body = await response.json();
      setItems(body.results.map(({ name }) => ({ id: name, name: name })));
    }
    getOptions();
  }, []);
  

  
  return (
    <div className="dropdown">
      <p>Select Assurance Case</p>
      <select>
      {items.map(item => (
        <option
          key={item.id}
          value={item.name}
        >
          {item.name}
        </option>
      ))}
      </select>
    </div>
    );
} 




export default CaseSelector;
*/