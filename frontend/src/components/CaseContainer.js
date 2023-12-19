import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import MermaidChart from "./Mermaid";
import ItemEditor from "./ItemEditor.js";
import { useEnforceLogin, useLoginToken } from "../hooks/useAuth";
import { getParentPropertyClaims, visitCaseItem } from "./utils.js";
import configData from "../config.json";
import "./CaseContainer.css";
import { Box, IconButton, Paper, Typography, useTheme } from "@mui/material";
import LoadingSpinner from "./common/LoadingSpinner.jsx";
import { editItem, getCase } from "./caseApi.js";
import CaseTopBar from "./CaseTopBar.jsx";
import { ColumnFlow, RowFlow } from "./common/Layout.jsx";
import { Add, Subtract, Target } from "./common/Icons.jsx";
import ErrorMessage from "./common/ErrorMessage.jsx";

function CaseContainer() {
  const { caseSlug } = useParams();
  const theme = useTheme();
  const [token] = useLoginToken();

  const [showEditLayer, setShowEditLayer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [assuranceCase, setAssuranceCase] = useState();
  const [identifiers, setIdentifiers] = useState(new Set());

  // pair state so they can be updated together with only one re-render
  const [selected, setSelected] = useState([]);
  const [selectedId, selectedType] = selected;

  const [shouldFetch, setShouldFetch] = useState(true);

  useEnforceLogin();

  // refresh on url change
  useEffect(() => {
    setSelected([]);
    setShouldFetch(true);
    setAssuranceCase();
    setIsLoading(true);
    setErrors([]);
    setIdentifiers(new Set());
  }, [caseSlug]);

  // open edit window on select item
  useEffect(() => {
    setShowEditLayer(selectedId && selectedType);
  }, [selectedId, selectedType]);

  // perform fetches
  useEffect(() => {
    if (token && shouldFetch && caseSlug) {
      let isMounted = true;

      getCase(token, caseSlug)
        .then((json) => {
          if (!isMounted) {
            return;
          }

          setIsLoading(false);
          setShouldFetch(false);
          setAssuranceCase((oldCase) => {
            if (JSON.stringify(json) !== JSON.stringify(oldCase)) {
              return json;
            } else {
              return oldCase;
            }
          });
        })
        .catch((err) => {
          console.error(err);
          // TODO show error to user
        });

      return () => {
        isMounted = false;
      };
    }
  }, [token, shouldFetch, caseSlug]);

  const triggerRefresh = useCallback(() => {
    setShouldFetch(true);
  }, []);

  const hideEditLayer = useCallback(() => {
    setShowEditLayer(false);
  }, []);

  // refresh on a timer
  useEffect(() => {
    const interval = setInterval(() => {
      setShouldFetch(true);
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // kill ongoing fetches on umount and tab close
  useEffect(() => {
    const abortController = new AbortController();
    window.addEventListener("beforeunload", () => abortController.abort());

    return () => {
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    if (assuranceCase) {
      setIdentifiers(
        (oldSet) => new Set([...oldSet, ...updateIdList(assuranceCase)])
      );
    }
  }, [assuranceCase]);

  const getIdForNewElement = useCallback(
    /**
     * @param {string} type
     * @param {string} parentId
     * @param {string} parentType
     * @returns {string}
     */
    (type, parentId, parentType) => {
      let prefix = configData.navigation[type].db_name
        .substring(0, 1)
        .toUpperCase();

      if (type === "PropertyClaim") {
        const parents = getParentPropertyClaims(
          assuranceCase,
          parentId,
          parentType
        );
        if (parents.length > 0) {
          const parent = parents[parents.length - 1];
          prefix = parent.name + ".";
        }
      }

      let i = 1;
      while (identifiers.has(prefix + i)) {
        i++;
      }

      return prefix + i;
    },
    [assuranceCase, identifiers]
  );

  const updateAllIdentifiers = useCallback(() => {
    setIsLoading(true);

    const promises = [];

    const newIdentifiers = new Set();

    const foundEvidence = new Set();

    function updateItem(item, type, parents) {
      let prefix = configData.navigation[type].db_name
        .substring(0, 1)
        .toUpperCase();

      if (type === "PropertyClaim") {
        const claimParents = parents.filter((t) => t.type === "PropertyClaim");
        if (claimParents.length > 0) {
          const parent = claimParents[claimParents.length - 1];
          prefix = parent.name + ".";
        }
      }

      let i = 1;
      while (newIdentifiers.has(prefix + i)) {
        i++;
      }

      const newName = prefix + i;
      newIdentifiers.add(newName);
      if (item.name === newName) {
        // don't need to post an update
        return [item, type, parents];
      }

      const itemCopy = { ...item };
      itemCopy.name = newName;
      promises.push(editItem(token, item.id, type, { name: newName }));

      return [itemCopy, type, parents];
    }

    // run breadth first search
    /** @type [any, string, any[]] */
    const caseItemQueue = assuranceCase.goals.map((i) =>
      updateItem(i, "TopLevelNormativeGoal", [])
    );

    while (caseItemQueue.length > 0) {
      const [node, nodeType, parents] = caseItemQueue.shift();
      const newParents = [...parents, node];

      configData.navigation[nodeType]["children"].forEach((childName, j) => {
        const childType = configData.navigation[nodeType]["children"][j];
        const dbName = configData.navigation[childName]["db_name"];
        if (Array.isArray(node[dbName])) {
          node[dbName].forEach((child) => {
            if (childType === "Evidence" && foundEvidence.has(child.id)) {
              // already found this, skip
              return;
            }

            caseItemQueue.push(updateItem(child, childType, newParents));
            if (childType === "Evidence") {
              foundEvidence.add(child.id);
            }
          });
        }
      });
    }

    setIdentifiers(newIdentifiers);

    if (promises.length === 0) {
      setIsLoading(false);
    } else {
      Promise.all(promises)
        .then(() => {
          setShouldFetch(true);
        })
        .catch((err) => {
          console.error(err);
          setErrors(["An error occurred"]);
          setIsLoading(false);
        });
    }
  }, [assuranceCase, token]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        flexShrink: 1,
        flexGrow: 1,
        overflow: "hidden",
        backgroundImage:
          "radial-gradient(circle at 1rem 1rem, #EDF2F7 0.25rem, transparent 0)",
        backgroundSize: "2rem 2rem",
      }}
    >
      {isLoading || !assuranceCase ? (
        <LoadingSpinner color="inherit" />
      ) : (
        <>
          <ColumnFlow
            sx={{
              flexGrow: 1,
              flexShrink: 1,
              maxHeight: "100%",
              overflowY: "auto",
              padding: "2rem",
            }}
          >
            <CaseTopBar
              caseId={caseSlug}
              assuranceCase={assuranceCase}
              onRefresh={triggerRefresh}
              setErrors={setErrors}
              getIdForNewElement={getIdForNewElement}
              updateAllIdentifiers={updateAllIdentifiers}
              setSelected={setSelected}
            />
            <ErrorMessage errors={errors} />
            <TransformWrapper
              style={{ width: "100%", height: "100%" }}
              initialScale={1}
              centerOnInit={true}
            >
              {({ zoomIn, zoomOut, resetTransform, state }) => (
                <>
                  <TransformComponent
                    contentStyle={{ width: "100%", height: "100%" }}
                    wrapperStyle={{ width: "100%", height: "100%" }}
                  >
                    <MermaidChart
                      caseId={caseSlug}
                      assuranceCase={assuranceCase}
                      selectedId={selectedId}
                      selectedType={selectedType}
                      setSelected={setSelected}
                    />
                  </TransformComponent>
                  <RowFlow>
                    <Paper sx={{ marginLeft: "auto", padding: "0.25rem" }}>
                      <IconButton
                        size="small"
                        aria-label="re-centre"
                        onClick={() => resetTransform()}
                      >
                        <Target fontSize="small" />
                      </IconButton>
                    </Paper>
                    <Paper sx={{ padding: "0.25rem" }}>
                      <RowFlow>
                        <IconButton
                          size="small"
                          aria-label="zoom out"
                          onClick={() => zoomOut()}
                        >
                          <Subtract fontSize="small" />
                        </IconButton>
                        <Typography>
                          {(state.scale * 100).toFixed(0)}%
                        </Typography>
                        <IconButton
                          size="small"
                          aria-label="zoom in"
                          onClick={() => zoomIn()}
                        >
                          <Add fontSize="small" />
                        </IconButton>
                      </RowFlow>
                    </Paper>
                  </RowFlow>
                </>
              )}
            </TransformWrapper>
          </ColumnFlow>
          {showEditLayer && selectedId && selectedType ? (
            <ColumnFlow
              sx={{
                width: "23.7rem",
                padding: "2.25rem 1.5rem",
                flexShrink: 0,
                borderLeftStyle: "solid",
                borderLeftWidth: "1px",
                borderLeftColor: theme.palette.primary.main,
                backgroundColor: "#FAFAFA"
              }}
            >
              <ItemEditor
                caseId={caseSlug}
                id={selectedId}
                type={selectedType}
                onRefresh={triggerRefresh}
                onHide={hideEditLayer}
                getIdForNewElement={getIdForNewElement}
                setSelected={setSelected}
              />
            </ColumnFlow>
          ) : (
            <></>
          )}
        </>
      )}
    </Box>
  );
}

/** @returns {string[]}  */
function updateIdList(assuranceCase) {
  const set = [];
  assuranceCase.goals.forEach((goal) => {
    visitCaseItem(goal, (item) => {
      set.push(item.name);
    });
  });
  return set;
}

export default CaseContainer;
