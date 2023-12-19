import React, { useCallback, useEffect, useState } from "react";
import SelectInput from "./common/SelectInput.jsx";
import { itemGetCurrentParents, itemGetPotentialParents } from "./caseApi.js";
import { useLoginToken } from "../hooks/useAuth.js";

function ParentSelector({ type, id, potential, caseId, value, setValue }) {
  // A dropdown menu component for selecting parents of an item. The props are:
  // type: Item type of the one whose parents we want to select from.
  // id: Id of the item whose parents we want to select from.
  // potential: If true, list as options all possible parents this component could get, that it
  //    doesn't yet have. If false, list its current parents.
  // caseId: Case ID within which to look for potential parents, if `potential=true`.
  // value: The variable that holds the selection.
  // setValue: The settes function for `value`.
  const [options, setOptions] = useState([]);
  const [error, setError] = useState("");

  const [token] = useLoginToken();

  useEffect(() => {
    let isMounted = true;
    itemGetCurrentParents(token, id, type)
      .then(async (currentParents) => {
        if (!isMounted) {
          return;
        }

        if (!potential) {
          setOptions(currentParents);
        } else {
          let potentialParents = await itemGetPotentialParents(
            token,
            caseId,
            type
          );
          if (!isMounted) {
            return;
          }

          potentialParents = potentialParents.filter((item) => {
            for (let currentParent of currentParents) {
              if (currentParent.id === item.id) return false;
            }
            return true;
          });
          setOptions(potentialParents);
        }
      })
      .catch((err) => {
        console.error(err);
      });

    return () => {
      isMounted = false;
    };
  }, [token, caseId, id, type, potential]);

  const valueInner = value?.id ?? "";

  const setValueInner = useCallback(
    (newValue) => {
      setValue(options.find((o) => o.id === newValue));
    },
    [setValue, options]
  );

  function getPlaceholder() {
    if (potential) {
      return "Choose a potential parent";
    } else {
      return "Choose a parent";
    }
  }
  return (
    <SelectInput
      error={error}
      setError={setError}
      label={getPlaceholder()}
      setValue={setValueInner}
      value={valueInner}
      options={options}
      selectKey={item => item.id}
      selectText={item => item.name}
    />
  );
}

export default ParentSelector;
