/**
 * This file contains useful functions used in CaseContainer component.
 */
import configData from "@/data/config.json";

/**
 * Sanitize text for use in HTML, and optionally replace newlines with <br/>.
 *
 * @param {string} input_text - The text to sanitize
 * @param {boolean} replaceNewLines - Whether to replace newlines with <br/>
 * @returns {string} The sanitized text
 */
export function sanitizeForHtml(input_text: any, replaceNewLines = false) {
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

/**
 * Remove an element from an array. Modifies the array in place. If the element
 * is not found, nothing happens.
 *
 * @param {Array} array - The array to remove the element from
 * @param {*} element - The element to remove
 * @returns {void}
 */
export function removeArrayElement(array: any[], element: any) {
  // Remove from `array`, in place, the (first instance of?) `element`.
  array.splice(array.indexOf(element), 1);
}

/**
 * Convert a JSON object to a Mermaid flowchart. The JSON object should be the
 * response from a GET request to the /cases/id API endpoint. The flowchart's
 * nodes will be named [TypeName]_[ID].
 *
 * @param {Object} in_json - The JSON object to convert
 * @param {string} highlightedType - The type of the node to highlight
 * @param {string} highlightedId - The ID of the node to highlight
 * @param {string[]} collapsedNodes - The nodes to collapse
 * @returns {string} The Mermaid flowchart
 */
export function jsonToMermaid(
  in_json : any,
  highlightedType: any,
  highlightedId: any,
  collapsedNodes: any,
) {
  /**
   * Get the name of a node in the flowchart.
   *
   * @param {string} itemType - The type of the node
   * @param {number} itemId - The ID of the node
   * @returns {string} The name of the node
   */
  function getNodeName(itemType: any, itemId: any) {
    return itemType + "_" + itemId;
  }

  /**
   * Create a box for a node in the Mermaid flowchart.
   *
   * The box will contain the node's name, short description, and URL. The box
   * will have a shape based on the node's type and its styling will be based on
   * the node's type and level. The box will be collapsible and expandable.
   *
   * The box will be surrounded by quotes so that Mermaid doesn't treat the
   * content as markdown.
   *
   * The box will use inline styles so that it appears in the SVG export.
   *
   * @param {Object} item - The node's data
   * @param {string} shape - The shape of the box
   * @param {string} name - The name of the node
   * @param {boolean} isCollapsed - Whether the node is initially collapsed
   * @returns {string} The box HTML
   */
  function makeBox(item: any, shape: any, name: any, isCollapsed: boolean) {
    let identifier = sanitizeForHtml(item.name, true);
    const description = sanitizeForHtml(item["short_description"] ?? "", true);
    let url = sanitizeForHtml(item.URL ?? "");

    if (url && !url.toUpperCase().startsWith("http")) {
      url = "https://" + url;
    }

    const containerStyle = `font-family: ${configData.styling.mermaidFont};font-size: 0.875rem;font-style: normal;font-weight: 500;line-height: 150%;width:15.5rem;;display:flex;flex-direction:column`;
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

  /**
   * Add classes to a node in the Mermaid flowchart.
   *
   * The classes will be based on the node's type, level, and whether it is
   * highlighted. The classes will be used to style the node in the SVG export.
   *
   * @param {string} node - The name of the node
   * @param {Object} obj - The node's data
   * @param {string} type - The type of the node
   * @param {string} outputmd - The Mermaid flowchart
   * @returns {string} The Mermaid flowchart with the classes added
   */
  function addClasses(node: any, obj: any, type: any, outputmd: any) {
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

  /**
   * Add a tree to the Mermaid flowchart. The function is recursive, and will
   * add the nodes and edges for the tree rooted at the given node.
   *
   * @param {string} itemType - The type of the node
   * @param {Object} parent - The parent node
   * @param {string} parentNode - The name of the parent node
   * @param {string} outputmd - The Mermaid flowchart
   * @param {string[]} visited - The nodes that have been visited
   * @returns {string} The Mermaid flowchart with the tree added
   */
  function addTree(itemType: any, parent: any, parentNode: any, outputmd:any, visited: any) {
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

/**
 * Create a button to collapse or expand a node in the Mermaid flowchart. The
 * button is hidden by default, and will be shown when the flowchart is rendered.
 * The button will have the name of the node as a data attribute, and will have
 * the label "Collapse" or "Expand" depending on the initial state of the node.
 * The button will contain an SVG icon to indicate the action.
 *
 * @param {string} name - The name of the node
 * @param {boolean} isCollapsed - Whether the node is initially collapsed
 * @returns {string} The button HTML
 */
function collapseExpandButton(name: any, isCollapsed: boolean) {
  // for export purposes
  const buttonStyle = "display: none";

  const svg = isCollapsed
    ? `<svg width='24' height='24' viewBox='0 0 12 20' fill='none' xmlns='http://www.w3.org/2000/svg'><g id='arrow-left-3--arrow-keyboard-left'><path id='Vector' d='M10.5002 0.714294L1.7145 9.50001C1.64618 9.56414 1.59172 9.64159 1.55449 9.72759C1.51726 9.81358 1.49805 9.90629 1.49805 10C1.49805 10.0937 1.51726 10.1864 1.55449 10.2724C1.59172 10.3584 1.64618 10.4359 1.7145 10.5L10.5002 19.2857' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></g></svg>`
    : `<svg width='24' height='24' viewBox='0 0 20 12' fill='none' xmlns='http://www.w3.org/2000/svg'><g id='arrow-down-3--arrow-down-keyboard'><path id='Vector' d='M0.714355 1.50012L9.50007 10.2858C9.5642 10.3541 9.64166 10.4087 9.72766 10.4458C9.81364 10.4831 9.90636 10.5023 10.0001 10.5023C10.0938 10.5023 10.1865 10.4831 10.2725 10.4458C10.3585 10.4087 10.4359 10.3541 10.5001 10.2858L19.2858 1.50012' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></g></svg>`;

  const label = isCollapsed ? "Expand" : "Collapse";

  return `<button data-key='${name}' style='${buttonStyle}' class='collapse-expand' aria-label='${label}'>${svg}</button>`;
}