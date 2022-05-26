// Useful functions used in CaseContainer component.
import { Test } from "grommet-icons";
import configData from "../config.json";

function getBaseURL() {
  const envURL = process.env.REACT_APP_BASE_URL;
  if (envURL !== undefined) return envURL;
  return configData.DEFAULT_BASE_URL;
}

function sanitizeForMermaid(input_text) {
  let sanitizedText = input_text.replace(/[^a-z0-9 \.,_-]/gim, "");
  return sanitizedText.trim();
}

function jsonToMermaid(in_json) {
  // function to convert the JSON response from a GET request to the /cases/id
  // API endpoint, into the markdown string required for Mermaid to render a flowchart.

  // Nodes in the flowchart will be named [TypeName]_[ID]
  function getNodeName(itemType, itemId) {
    return itemType + "_" + itemId;
  }

  function makeBox(text, shape) {
    if (text.length > configData["BOX_NCHAR"]) {
      text = text.substring(0, configData["BOX_NCHAR"] - 3) + "...";
    } else {
      // pad the text with spaces to make it the same width
      let nSpaces = configData["BOX_NCHAR"] - text.length;
      text =
        "&#160".repeat(Math.ceil(nSpaces / 2)) +
        text +
        "&#160".repeat(Math.floor(nSpaces / 2));
    }
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
    for (let i = 0; i < parent[thisType].length; i++) {
      let thisObj = parent[thisType][i];
      let thisNode = getNodeName(itemType, thisObj.id);
      if (parentNode != null) {
        outputmd +=
          parentNode +
          arrow +
          thisNode +
          makeBox(sanitizeForMermaid(thisObj.name), boxShape) +
          "\n";
      } else {
        outputmd +=
          thisNode + makeBox(sanitizeForMermaid(thisObj.name), boxShape) + "\n";
      }
      // add a click link to the node
      outputmd +=
        "\n click " +
        thisNode +
        ' callback "' +
        thisObj.short_description +
        '"\n';
      // add style to the node
      outputmd = addClasses(thisNode, thisObj, itemType, outputmd);
      if (!visited.includes(JSON.stringify(thisObj))) {
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
    console.log("outputmd is ", outputmd);
    return outputmd;
  }

  let outputmd = "graph TB; \n";
  outputmd +=
    "classDef blackBox stroke:#333,stroke-width:3px,text-align:center; \n";
  const styleclasses = configData["mermaid_item_styleclasses"];
  Object.keys(styleclasses).forEach((key) => {
    outputmd += `classDef ${key} ${styleclasses[key]}; \n`;
  });
  // call the recursive addTree function, starting with the Goal as the top node
  outputmd = addTree("TopLevelNormativeGoal", in_json, null, outputmd, []);

  return outputmd;
}

function highlightNode(inputMarkdown, nodeType, nodeId) {
  // add a classDef to the bottom of the markdown highlighting a node
  inputMarkdown = removeHighlight(inputMarkdown);
  inputMarkdown +=
    "\nclass " + nodeType + "_" + nodeId + " classHighlighted;\n";
  return inputMarkdown;
}

function removeHighlight(inputMarkdown) {
  // remove last line of markdown if it contains highlight
  let lines = inputMarkdown.split("\n");
  let numLines = lines.length;
  if (lines[numLines - 2].includes("classHighlighted")) {
    lines.splice(numLines - 2, numLines - 1);
    inputMarkdown = lines.join("\n");
  }
  return inputMarkdown;
}

export {
  getBaseURL,
  highlightNode,
  jsonToMermaid,
  removeArrayElement,
  removeHighlight,
  sanitizeForMermaid,
};
