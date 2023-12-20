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

  if (replaceNewLines) {
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

function collapseExpandButton(name, isCollapsed) {
  // for export purposes
  const buttonStyle = "display: none";

  const svg = isCollapsed
    ? `<svg width='24' height='24' viewBox='0 0 12 20' fill='none' xmlns='http://www.w3.org/2000/svg'><g id='arrow-left-3--arrow-keyboard-left'><path id='Vector' d='M10.5002 0.714294L1.7145 9.50001C1.64618 9.56414 1.59172 9.64159 1.55449 9.72759C1.51726 9.81358 1.49805 9.90629 1.49805 10C1.49805 10.0937 1.51726 10.1864 1.55449 10.2724C1.59172 10.3584 1.64618 10.4359 1.7145 10.5L10.5002 19.2857' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></g></svg>`
    : `<svg width='24' height='24' viewBox='0 0 20 12' fill='none' xmlns='http://www.w3.org/2000/svg'><g id='arrow-down-3--arrow-down-keyboard'><path id='Vector' d='M0.714355 1.50012L9.50007 10.2858C9.5642 10.3541 9.64166 10.4087 9.72766 10.4458C9.81364 10.4831 9.90636 10.5023 10.0001 10.5023C10.0938 10.5023 10.1865 10.4831 10.2725 10.4458C10.3585 10.4087 10.4359 10.3541 10.5001 10.2858L19.2858 1.50012' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></g></svg>`;

  const label = isCollapsed ? "Expand" : "Collapse";

  return `<button data-key='${name}' style='${buttonStyle}' class='collapse-expand' aria-label='${label}'>${svg}</button>`;
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
    let url = sanitizeForHtml(item.URL ?? "");

    if (url && !url.toUpperCase().startsWith("http")) {
      url = "https://" + url;
    }

    // use inline styles so they appear in the svg export

    const containerStyle =
      "font-family: Plus Jakarta Sans, sans-serif;font-size: 0.875rem;font-style: normal;font-weight: 500;line-height: 150%;width:15.5rem;;display:flex;flex-direction:column";
    const titleStyle =
      "font-size: 1rem;font-weight: 700;max-width:100%;overflow:hidden;text-overflow:ellipsis;";
    // TODO this will show elipses when the text is too wide vertically
    // but not horizontally. CSS has no easy solution here.
    const descriptionStyle =
      "max-height:3.25rem;max-width:100%;overflow:hidden;text-overflow:ellipsis;";
    const urlStyle = "color: unset;";

    let text = `<h2 style='${titleStyle}'>${identifier}</h2><p style=${descriptionStyle}>${description}</p>`;

    if (url) {
      // something seems to strip target off...
      text += `<a style='${urlStyle}' href='${url}' target='_blank'>${url}</a>`;
    }

    text += collapseExpandButton(name, isCollapsed);

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
  outputmd += "classDef foo color:#ff00ff; \n";
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
        visitCaseItem(g, callback, childType)
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
