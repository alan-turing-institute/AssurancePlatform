import { getBaseURL } from "./utils.js";
import configData from "../config.json";

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
  }

  throw new Error("Could not fetch case.");
}

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

export async function getItem(token, id, type) {
  const url = `${getBaseURL()}/${
    configData.navigation[type]["api_name"]
  }/${id}`;

  const requestOptions = {
    headers: {
      Authorization: `Token ${token}`,
    },
  };
  const response = await fetch(url, requestOptions);
  return await response.json();
}

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

export function deleteItem(token, id, type) {
  const url = `${getBaseURL()}/${
    configData.navigation[type]["api_name"]
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
