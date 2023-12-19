// Useful functions used in CaseContainer component.
import configData from "../config.json";

function getBaseURL() {
  const envURL = process.env.REACT_APP_BASE_URL;
  if (envURL !== undefined) return envURL;
  return configData.DEFAULT_BASE_URL;
}

function getClientID() {
  const envGithubClient = process.env.GITHUB_CLIENT_ID;
  if (envGithubClient !== undefined) return envGithubClient;
  return configData.DEFAULT_GITHUB_CLIENT_ID;
}

function getRedirectURI() {
  const envRedirectURI = process.env.GITHUB_REDIRECT_URI;
  if (envRedirectURI !== undefined) return envRedirectURI;
  return configData.DEFAULT_GITHUB_REDIRECT_URI;
}

/** Escape html characters in text */
function sanitizeForHtml(input_text, replaceNewLines = false) {
  let result = input_text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;")
    .replace(/"/g, "&quot;");

    if(replaceNewLines){
      result = result.replace(/\n/g, "<br/>");
    }

    return result;
}

/** Unespcape html characters in text */
function decodeFromHtml(input_text) {
  return input_text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

function removeArrayElement(array, element) {
  // Remove from `array`, in place, the (first instance of?) `element`.
  array.splice(array.indexOf(element), 1);
}

/**
 *
 * @param {*} in_json
 * @param {string?} highlightedType
 * @param {string?} highlightedId
 * @param {string[]} collapsedNodes
 * @returns
 */
function jsonToMermaid(
  in_json,
  highlightedType,
  highlightedId,
  collapsedNodes
) {
  // function to convert the JSON response from a GET request to the /cases/id
  // API endpoint, into the markdown string required for Mermaid to render a flowchart.
  // Nodes in the flowchart will be named [TypeName]_[ID]
  function getNodeName(itemType, itemId) {
    return itemType + "_" + itemId;
  }

  function makeBox(item, shape, name, isCollapsed) {
    let identifier = sanitizeForHtml(item.name, true);
    const description = sanitizeForHtml(item["short_description"] ?? "", true);
    const url = sanitizeForHtml(item.URL ?? "");

    // use inline styles so they appear in the svg export

    const containerStyle = "font-family: Plus Jakarta Sans, sans-serif;font-size: 0.875rem;font-style: normal;font-weight: 500;line-height: 150%;width:15.5rem;;display:flex;flex-direction:column";
    const titleStyle = "font-size: 1rem;font-weight: 700;max-width:100%;overflow:hidden;text-overflow:ellipsis;";
    const descriptionStyle = "max-height:3.25rem;max-width:100%;overflow:hidden;text-overflow:ellipsis;";
    const urlStyle = "color: unset;";
    // for export purposes
    const buttonStyle = "display: none";

    let text = `<h2 style='${titleStyle}'>${identifier}</h2><p style=${descriptionStyle}>${description}</p>`;

    if (url) {
      text += `<a style='${urlStyle}' href='${url}' >${url}</a>`;
    }

    const symbol = isCollapsed ? "&plus;" : "&minus;";
    const helpText = isCollapsed ? "Expand" : "Collapse";
    text += `<button style='${buttonStyle}' class='collapse-expand' data-key='${name}'><span class='assistive-text'>${helpText}</span>${symbol}</button>`;

    // surround with quotes so mermaid doesn't treat content as markdown
    text = `"<div style='${containerStyle}'>${text}</div>"`;

    if (shape === "square") return "[" + text + "]";
    else if (shape === "diamond") return "{" + text + "}";
    else if (shape === "rounded") return "(" + text + ")";
    else if (shape === "circle") return "((" + text + "))";
    else if (shape === "hexagon") return "{{" + text + "}}";
    else if (shape === "parallelogram-left") return "[\\" + text + "\\]";
    else if (shape === "parallelogram-right") return "[/" + text + "/]";
    else if (shape === "stadium") return "([" + text + "])";
    else if (shape === "data") return "[(" + text + ")]";
    else return "";
  }

  function addClasses(node, obj, type, outputmd) {
    outputmd += "\nclass " + node + " blackBox;\n";
    if (obj.claim_type === "Project claim") {
      outputmd += "\nclass " + node + " classProjectClaim;\n";
      if (obj.level !== undefined) {
        outputmd +=
          "\nclass " + node + " classProjectClaimLevel" + obj.level + ";\n";
      }
    } else if (obj.claim_type === "System claim") {
      outputmd += "\nclass " + node + " classSystemClaim;\n";
      if (obj.level !== undefined) {
        outputmd +=
          "\nclass " + node + " classSystemClaimLevel" + obj.level + ";\n";
      }
    } else {
      outputmd += "\nclass " + node + " class" + type + ";\n";
    }
    if (obj.level !== undefined) {
      outputmd += "\nclass " + node + " classLevel" + obj.level + ";\n";
    }

    if (highlightedType === type && highlightedId === obj.id.toString()) {
      outputmd +=
        "\nclass " + getNodeName(type, obj.id) + " classHighlighted;\n";
    }

    return outputmd;
  }

  let arrow = " --- ";
  /// Recursive function to go down the tree adding components
  function addTree(itemType, parent, parentNode, outputmd, visited) {
    visited.push(JSON.stringify(parent));
    // look up the 'API name', e.g. "goals" for "TopLevelNormativeGoal"
    let thisType = configData.navigation[itemType]["db_name"];
    let boxShape = configData.navigation[itemType]["shape"];
    // loop over all objects of this type
    // here is the issue, evidence not being set as having proper parents!
    for (let i = 0; i < parent[thisType].length; i++) {
      let thisObj = parent[thisType][i];
      let thisNode = getNodeName(itemType, thisObj.id);
      const isCollapsed = collapsedNodes.includes(thisNode);
      if (parentNode != null) {
        outputmd +=
          parentNode +
          arrow +
          thisNode +
          makeBox(thisObj, boxShape, thisNode, isCollapsed) +
          "\n";
      } else {
        outputmd +=
          thisNode + makeBox(thisObj, boxShape, thisNode, isCollapsed) + "\n";
      }
      // add a click link to the node
      outputmd +=
        "\n click " +
        thisNode +
        ' callback "' +
        sanitizeForHtml(thisObj.short_description) +
        '"\n';
      // add style to the node
      outputmd = addClasses(thisNode, thisObj, itemType, outputmd);
      if (!isCollapsed && !visited.includes(JSON.stringify(thisObj))) {
        for (
          let j = 0;
          j < configData.navigation[itemType]["children"].length;
          j++
        ) {
          let childType = configData.navigation[itemType]["children"][j];
          outputmd = addTree(childType, thisObj, thisNode, outputmd, visited);
        }
      }
    }
    return outputmd;
  }

  let outputmd = "graph TB; \n";
  outputmd +=
    "classDef blackBox stroke:#333,stroke-width:3px,text-align:center; \n";
  const styleclasses = configData["mermaid_styles"][in_json["color_profile"]];
  Object.keys(styleclasses).forEach((key) => {
    outputmd += `classDef ${key} ${styleclasses[key]}; \n`;
  });
  outputmd +=
    "classDef foo color:#ff00ff; \n";
  // call the recursive addTree function, starting with the Goal as the top node
  outputmd = addTree("TopLevelNormativeGoal", in_json, null, outputmd, []);
  // output the length of the Mermaid string
  return outputmd;
}

function splitCommaSeparatedString(string) {
  // Trim trailing comma if any.
  if (string[string.length - 1] === ",")
    string = string.substr(0, string.length - 1);
  return string.replace(/\s/g, "").split(",");
}

function joinCommaSeparatedString(array) {
  return array.join();
}

async function getSelfUser() {
  const requestOptions = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${localStorage.getItem("token")}`,
    },
  };

  const response = await fetch(`${getBaseURL()}/user/`, requestOptions);
  const user = await response.json();
  return user;
}

/**
 * Make a mutable copy of a case item, and run a callback to mutate the new copy
 * @param {*} caseItem root case item
 * @param {(caseItem: any, type: string) => void} callback function to run at every step of the tree
 * @returns
 */
function visitCaseItem(caseItem, callback, itemType = "TopLevelNormativeGoal") {
  if (typeof caseItem != "object") {
    return caseItem;
  }

  // make a shallow copy
  var copy = { ...caseItem };

  configData.navigation[itemType]["children"].forEach((childName, j) => {
    let childType = configData.navigation[itemType]["children"][j];
    let dbName = configData.navigation[childName]["db_name"];
    // recurse to make deep copies of the child arrays, if they exist
    if (Array.isArray(copy[dbName])) {
      copy[dbName] = copy[dbName].map((g) =>
        visitCaseItem(g, callback, childType),
      );
    }
  });

  callback(copy, itemType);

  return copy;
}

/**
 * For an assurance case, and a case item id and type,
 * find all property claims above this item in the graph,
 * including itself if its a property claim
 * @param {*} assuranceCase
 * @param {string} id
 * @param {string} type
 * @returns {any[]}
 */
function getParentPropertyClaims(assuranceCase, id, type) {
  // run depth first search
  // because evidence cannot have property claim children,
  // don't worry that they can appear twice in the tree
  /** @type [any, string, any[]] */
  const caseItemStack = assuranceCase.goals.map((i) => [
    i,
    "TopLevelNormativeGoal",
    [],
  ]);

  let result = [];

  while (caseItemStack.length > 0) {
    const [node, nodeType, parents] = caseItemStack.shift();
    const newParents = [...parents, node];

    if (node.id.toString() === id && nodeType === type) {
      // found it!
      result = newParents;
      break;
    }

    const newChildren = [];
    configData.navigation[nodeType]["children"].forEach((childName, j) => {
      const childType = configData.navigation[nodeType]["children"][j];
      const dbName = configData.navigation[childName]["db_name"];
      if (Array.isArray(node[dbName])) {
        node[dbName].forEach((child) => {
          newChildren.push([child, childType, newParents]);
        });
      }
    });

    caseItemStack.unshift(...newChildren);
  }

  return result.filter((i) => i.type === "PropertyClaim");
}

export {
  getBaseURL,
  getClientID,
  getRedirectURI,
  joinCommaSeparatedString,
  jsonToMermaid,
  removeArrayElement,
  sanitizeForHtml,
  decodeFromHtml,
  splitCommaSeparatedString,
  getSelfUser,
  visitCaseItem,
  getParentPropertyClaims,
};
