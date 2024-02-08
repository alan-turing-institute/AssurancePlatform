import { getBaseURL } from "./utils.js";
import configData from "../config.json";
import { unauthorized } from "../hooks/useAuth.js";

/**
 * Get a certain case from the server.
 *
 * @param {string} token - The user's token.
 * @param {number} id - The id of the case to get.
 * @returns {Promise} The response from the server.
 */
export async function getCase(token, id) {
  const url = `${getBaseURL()}/cases/${id}/`;

  const requestOptions = {
    headers: {
      Authorization: `Token ${token}`,
    },
  };

  const res = await fetch(url, requestOptions);

  if (res.status === 200) {
    return await res.json();
  } else if (res.status === 401) {
    unauthorized();
  } else if (res.status === 403) {
    // forbidden (eg. attempts to access cases without required permissions)
    window.location.replace("/not-found");
  } else if (res.status === 404) {
    window.location.replace("/not-found");
  }

  throw new Error("Could not fetch case.");
}

/**
 * Change the properties of a case.
 *
 * @param {string} token - The user's token.
 * @param {number} id - The id of the case to change.
 * @param {Object} changes - The changes to make to the case.
 * @returns {Promise} The response from the server.
 */
export function editCase(token, id, changes) {
  const url = `${getBaseURL()}/cases/${id}/`;

  const requestOptions = {
    method: "PUT",
    headers: {
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify(changes),
  };
  return fetch(url, requestOptions);
}

/**
 * Delete a case from the server.
 *
 * @param {string} token - The user's token.
 * @param {number} id - The id of the case to delete.
 * @returns {Promise} The response from the server.
 */
export function deleteCase(token, id) {
  const url = `${getBaseURL()}/cases/${id}/`;
  const requestOptions = {
    headers: {
      Authorization: `Token ${token}`,
    },
    method: "DELETE",
  };
  return fetch(url, requestOptions);
}

/**
 * Create a new item in the database.
 *
 * @param {string} token - The user's token.
 * @param {string} type - The type of the item to create.
 * @param {number} parentId - The id of the parent item.
 * @param {string} parentType - The type of the parent item.
 * @param {string} name - The name of the new item.
 * @returns {Promise} The response from the server.
 */
export async function createItem(token, type, parentId, parentType, name) {
  const url = `${getBaseURL()}/${configData.navigation[type]["api_name"]}/`;

  const request_body = {};
  request_body["name"] = name;
  request_body["short_description"] = "Description";
  // TODO #298 make these fields optional
  request_body["long_description"] = "N/A";
  request_body["keywords"] = "N/A";

  if (type === "PropertyClaim") {
    request_body["claim_type"] = configData["property_claim_types"][0];
    // Adjust based on selected parentType for PropertyClaim
    request_body[parentType.toLowerCase()] = parseInt(parentId);
  } else if (type === "Evidence") {
    request_body["URL"] = "www.some-evidence.com";
  } else if (type === "Strategy") {
    // adjust for strategy
    request_body["goal"] = parseInt(parentId);
  }

  if (configData.navigation[type]["parent_relation"] === "many-to-many") {
    request_body[configData.navigation[parentType]["id_name"]] = [
      parseInt(parentId),
    ];
  } else {
    request_body[configData.navigation[parentType]["id_name"]] =
      parseInt(parentId);
  }

  const requestOptions = {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request_body),
  };

  const response = await fetch(url, requestOptions);

  return await response.json();
}

/**
 * Get a certain item from the server.
 *
 * @param {string} token - The user's token.
 * @param {number} id - The id of the item to get.
 * @param {string} type - The type of the item to get.
 * @returns {Promise} The response from the server.
 */
export async function getItem(token, id, type) {
  const url = `${getBaseURL()}/${configData.navigation[type]["api_name"]
    }/${id}`;

  const requestOptions = {
    headers: {
      Authorization: `Token ${token}`,
    },
  };
  const response = await fetch(url, requestOptions);
  return await response.json();
}

/**
 * Change the properties of an item.
 *
 * @param {string} token - The user's token.
 * @param {number} id - The id of the item to change.
 * @param {string} type - The type of the item to change.
 * @param {Object} item - The changes to make to the item.
 * @returns {Promise} The response from the server.
 */
export function editItem(token, id, type, item) {
  let url = `${getBaseURL()}/${configData.navigation[type]["api_name"]}/${id}/`;

  const requestOptions = {
    method: "PUT",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(item),
  };
  return fetch(url, requestOptions);
}

/**
 * Delete an item from the server.
 *
 * @param {string} token - The user's token.
 * @param {number} id - The id of the item to delete.
 * @param {string} type - The type of the item to delete.
 * @returns {Promise} The response from the server.
 */
export function deleteItem(token, id, type) {
  const url = `${getBaseURL()}/${configData.navigation[type]["api_name"]
    }/${id}/`;
  const requestOptions = {
    method: "DELETE",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  };
  return fetch(url, requestOptions);
}

/**
 * Get all parent items of a certain type from the server.
 *
 * @param {string} token - The user's token.
 * @param {string} type - The type of the parent items to get.
 * @returns {Promise} The response from the server.
 */
export async function itemGetCurrentParents(token, id, type) {
  const db_name = configData.navigation[type]["db_name"];
  const url = `${getBaseURL()}/parents/${db_name}/${id}`;
  const requestOptions = {
    headers: {
      Authorization: `Token ${token}`,
    },
  };
  return await fetch(url, requestOptions).then((response) => response.json());
}

/**
 * Get all potential parent items of a certain type for a given case from the server.
 *
 * @param {string} token - The user's token.
 * @param {number} caseId - The id of the case.
 * @param {string} type - The type of the parent items to get.
 * @returns {Promise} The response from the server.
 */
export async function itemGetPotentialParents(token, caseId, type) {
  const requestOptions = {
    headers: {
      Authorization: `Token ${token}`,
    },
  };

  const potentialParents = [];
  const parentNames = configData.navigation[type]["parent_names"];
  const parentApiNames = configData.navigation[type]["parent_api_names"];
  for (let i = 0; i < parentNames.length; i++) {
    const parentName = parentNames[i];
    const parentApiName = parentApiNames[i];
    const url = `${getBaseURL()}/${parentApiName}/?case_id=${caseId}`;
    await fetch(url, requestOptions)
      .then((response) => response.json())
      .then((json) => {
        json.forEach((item) => {
          item["type"] = parentName;
          potentialParents.push(item);
        });
      });
  }
  return potentialParents;
}
