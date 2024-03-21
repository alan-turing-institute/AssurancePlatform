import React, { useCallback, useEffect, useState } from "react";
import SelectInput from "./common/SelectInput.jsx";
import { itemGetCurrentParents, itemGetPotentialParents } from "./caseApi.js";
import { useLoginToken } from "../hooks/useAuth.js";

/**
 * A dropdown menu component for selecting parents of an item.
 *
 * @param {Object} props - The props for this component.
 * @param {string} props.type - Item type of the one whose parents we want to select from.
 * @param {number} props.id - Id of the item whose parents we want to select from.
 * @param {boolean} props.potential - If true, list as options all possible parents this component could get, that it doesn't yet have. If false, list its current parents.
 * @param {number} props.caseId - Case ID within which to look for potential parents, if `potential=true`.
 * @param {Object} props.value - The variable that holds the selection.
 * @param {Function} props.setValue - The settes function for `value`.
 * @param {number} props.graphUpdate - The graph update.
 * @returns {JSX.Element} A dropdown menu component for selecting parents of an item.
 */
function ParentSelector({
  type,
  id,
  potential,
  caseId,
  value,
  setValue,
  graphUpdate,
}) {
  const [options, setOptions] = useState([]);
  const [error, setError] = useState("");

  const [token] = useLoginToken();

  /**
   * Fetch the current or potential parents of the item and set them as options.
   *
   * @returns {void}
   * @throws {Error} An error if the API request fails.
   */
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
            type,
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
        // TODO: Display error message to user
      });

    return () => {
      isMounted = false;
    };
  }, [token, caseId, id, type, potential, graphUpdate]);

  /**
   * Get the placeholder text for the dropdown menu.
   *
   * @returns {string} The placeholder text for the dropdown menu.
   */
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
      setValue={setValue}
      value={value}
      options={options}
      selectKey={(item) => item.id}
      selectText={(item) => item.name}
    />
  );
}

export default ParentSelector;
