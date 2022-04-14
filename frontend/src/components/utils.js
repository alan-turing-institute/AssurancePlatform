// Useful functions used in CaseContainer component.
import { Test } from "grommet-icons";
import configData from "../config.json";

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
    else if (shape === "data") return "[(" + text + ")]";
    else return "";
  }

  let arrow = " --- ";
  /// Recursive function to go down the tree adding components
  function addTree(itemType, parent, parentNode, outputmd) {
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
      outputmd += "\nclass " + thisNode + " blackBox;\n";
      for (
        let j = 0;
        j < configData.navigation[itemType]["children"].length;
        j++
      ) {
        let childType = configData.navigation[itemType]["children"][j];
        outputmd = addTree(childType, thisObj, thisNode, outputmd);
      }
    }
    console.log(outputmd);
    return outputmd;
  }

  let outputmd = "graph TB; \n";
  outputmd +=
    "classDef blackBox stroke:#333,stroke-width:3px,text-align:center; \n";
  // call the recursive addTree function, starting with the Goal as the top node
  outputmd = addTree("TopLevelNormativeGoal", in_json, null, outputmd);

  return outputmd;
}

export { jsonToMermaid, sanitizeForMermaid };
