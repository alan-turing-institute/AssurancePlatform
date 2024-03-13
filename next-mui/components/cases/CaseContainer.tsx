'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { ColumnFlow, RowFlow } from '../common/Layouts'
import ErrorMessage from '../common/ErrorMessage'
import { IconButton, Paper, Typography, useTheme } from '@mui/material'
import { Target } from '../common/Icons'
import { CrosshairIcon, Minus, PlusIcon, TargetIcon } from 'lucide-react'
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useParams } from 'next/navigation'
import CaseTopBar from './CaseTopBar'
import { useLoginToken } from '@/hooks/useAuth'
import MermaidChart from '../Mermaid'
import { Mermaid } from '../MermaidTest'

interface CaseContainerProps {
  assuranceCase: any
}

const CaseContainer = ({ assuranceCase } : CaseContainerProps) => {
  const { id } = useParams();
  const theme = useTheme();
  const [token] = useLoginToken();

  const [showEditLayer, setShowEditLayer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [identifiers, setIdentifiers] = useState(new Set());
  // pair state so they can be updated together with only one re-render
  const [selected, setSelected] = useState([]);
  const [selectedId, selectedType] = selected;
  const [mermaidFocus, setMermaidFocus] = useState(false);
  const [shouldFetch, setShouldFetch] = useState(true);
  const [transformScale, setTransformScale] = useState(1)

  const [chart, setChart] = useState("");

  useEffect(() => {
    setChart(`
    flowchart TB
    A[Start] --Some text--> B(Continue)
    B --> C{Evaluate}
    C -- One --> D[Option 1]
    C -- Two --> E[Option 2]
    C -- Three --> F[fa:fa-car Option 3]
      `);
  },[])

  function handleTransform(e:any){
    // console.log(e.instance.transformState.scale); // output scale factor
    setTransformScale(e.instance.transformState.scale)
  }

  const triggerRefresh = useCallback(() => {
    setShouldFetch(true);
  }, []);

  /**
   * Generates a unique identifier for new elements within the assurance case based on the type and its parents.
   * It prefixes the identifier based on the type and ensures uniqueness within the case.
   *
   * @param {string} type - The type of the element for which the ID is being generated.
   * @param {string} parentId - The ID of the parent element.
   * @param {string} parentType - The type of the parent element.
   * @returns {string} A unique identifier for the new element.
   */
  // const getIdForNewElement = useCallback(
  //   ({type, parentId, parentType} : any) => {
  //     let prefix = configData.navigation[type].db_name
  //       .substring(0, 1)
  //       .toUpperCase();

  //     if (type === "PropertyClaim") {
  //       const parents = getParentPropertyClaims(
  //         assuranceCase,
  //         parentId,
  //         parentType,
  //       );
  //       if (parents.length > 0) {
  //         const parent = parents[parents.length - 1];
  //         prefix = parent.name + ".";
  //       }
  //     }

  //     let i = 1;
  //     while (identifiers.has(prefix + i)) {
  //       i++;
  //     }

  //     return prefix + i;
  //   },
  //   [assuranceCase, identifiers],
  // );

  /**
   * Updates all identifiers within the assurance case to ensure they are unique.
   * This function might be necessary when there are changes to the case structure
   * or to correct any identifier conflicts.
   */
  // const updateAllIdentifiers = useCallback(() => {
  //   setIsLoading(true);

  //   const promises: any = [];

  //   const newIdentifiers = new Set();

  //   const foundEvidence = new Set();

  //   function updateItem(item: any, type: any, parents: any) {
  //     let prefix = configData.navigation[type].db_name
  //       .substring(0, 1)
  //       .toUpperCase();

  //     if (type === "PropertyClaim") {
  //       const claimParents = parents.filter((t) => t.type === "PropertyClaim");
  //       if (claimParents.length > 0) {
  //         const parent = claimParents[claimParents.length - 1];
  //         prefix = parent.name + ".";
  //       }
  //     }

  //     let i = 1;
  //     while (newIdentifiers.has(prefix + i)) {
  //       i++;
  //     }

  //     const newName = prefix + i;
  //     newIdentifiers.add(newName);
  //     if (item.name === newName) {
  //       // don't need to post an update
  //       return [item, type, parents];
  //     }

  //     const itemCopy = { ...item };
  //     itemCopy.name = newName;
  //     promises.push(editItem(token, item.id, type, { name: newName }));

  //     return [itemCopy, type, parents];
  //   }

  //   // run breadth first search
  //   /** @type [any, string, any[]] */
  //   const caseItemQueue = assuranceCase.goals.map((i) =>
  //     updateItem(i, "TopLevelNormativeGoal", []),
  //   );

  //   while (caseItemQueue.length > 0) {
  //     const [node, nodeType, parents] = caseItemQueue.shift();
  //     const newParents = [...parents, node];

  //     configData.navigation[nodeType]["children"].forEach((childName, j) => {
  //       const childType = configData.navigation[nodeType]["children"][j];
  //       const dbName = configData.navigation[childName]["db_name"];
  //       if (Array.isArray(node[dbName])) {
  //         node[dbName].forEach((child) => {
  //           if (childType === "Evidence" && foundEvidence.has(child.id)) {
  //             // already found this, skip
  //             return;
  //           }

  //           caseItemQueue.push(updateItem(child, childType, newParents));
  //           if (childType === "Evidence") {
  //             foundEvidence.add(child.id);
  //           }
  //         });
  //       }
  //     });
  //   }

  //   setIdentifiers(newIdentifiers);

  //   if (promises.length === 0) {
  //     setIsLoading(false);
  //   } else {
  //     Promise.all(promises)
  //       .then(() => {
  //         setShouldFetch(true);
  //       })
  //       .catch((err) => {
  //         console.error(err);
  //         setErrors(["An error occurred"]);
  //         setIsLoading(false);
  //       });
  //   }
  // }, [assuranceCase, token]);

  return (
    <>
      <ColumnFlow
        sx={{
          position: "relative",
          flexGrow: 1,
          flexShrink: 1,
          maxHeight: "100%",
          width: "100%",
          overflowY: "auto",
          padding: "1rem",
          gap: "1rem",
        }}
      >
        <CaseTopBar
          sx={{
            position: "absolute",
            width: "100%",
            paddingRight: "4rem",
          }}
          caseId={'1'}
          assuranceCase={assuranceCase}
          onRefresh={triggerRefresh}
          setErrors={setErrors}
          // getIdForNewElement={getIdForNewElement}
          // updateAllIdentifiers={updateAllIdentifiers}
          setSelected={setSelected}
        />
        <ErrorMessage errors={errors} />
        <TransformWrapper
          // @ts-ignore
          style={{ width: "100%", height: "100%" }}
          initialScale={1}
          centerOnInit={true}
          onTransformed={(e) => handleTransform(e)}
        >
          {({ zoomIn, zoomOut, resetTransform, ...rest }) => (
            <>
              <TransformComponent
                contentStyle={{ width: "100%", height: "100%" }}
                wrapperStyle={{ width: "100%", height: "100%" }}
              >
                {/* <MermaidChart
                  caseId={assuranceCase.id}
                  assuranceCase={assuranceCase}
                  selectedId={selectedId}
                  selectedType={selectedType}
                  setSelected={setSelected}
                  setMermaidFocus={setMermaidFocus}
                /> */}
                <Mermaid chart={chart} name={'Test Chart'} />
              </TransformComponent>
              <RowFlow
                sx={{
                  position: "absolute",
                  width: "100%",
                  right: "2rem",
                  bottom: "2rem",
                }}
              >
                <Paper sx={{ marginLeft: "auto", padding: "0.25rem" }}>
                  <IconButton
                    size="small"
                    aria-label="re-centre"
                    onClick={() => resetTransform()}
                  >
                    {/* <Target fontSize="small" /> */}
                    <CrosshairIcon />
                  </IconButton>
                </Paper>
                <Paper sx={{ padding: "0.25rem" }}>
                  <RowFlow>
                    <IconButton
                      size="small"
                      aria-label="zoom out"
                      onClick={() => zoomOut()}
                    >
                      {/* <Subtract fontSize="small" /> */}
                      <Minus />
                    </IconButton>
                    <Typography>
                      {(transformScale * 100).toFixed(0)}%
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label="zoom in"
                      onClick={() => zoomIn()}
                    >
                      {/* <Add fontSize="small" /> */}
                      <PlusIcon />
                    </IconButton>
                  </RowFlow>
                </Paper>
              </RowFlow>
            </>
          )}
        </TransformWrapper>
      </ColumnFlow>
      {/* {showEditLayer && selectedId && selectedType ? (
        <ColumnFlow
          sx={{
            width: "23.7rem",
            padding: "2.25rem 1.5rem",
            flexShrink: 0,
            borderLeftStyle: "solid",
            borderLeftWidth: "1px",
            borderLeftColor: theme.palette.primary.main,
            backgroundColor: "#FAFAFA",
            overflow: "scroll",
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
            graphUpdate={shouldFetch}
            mermaidFocus={mermaidFocus}
          />
        </ColumnFlow>
      ) : (
        <></>
      )} */}
    </>
  )
}

export default CaseContainer
