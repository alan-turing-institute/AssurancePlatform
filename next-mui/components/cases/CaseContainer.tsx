'use client'

import React, { useState } from 'react'
import { ColumnFlow, RowFlow } from '../common/Layouts'
import ErrorMessage from '../common/ErrorMessage'
import { IconButton, Paper, Typography, useTheme } from '@mui/material'
import { Target } from '../common/Icons'
import { CrosshairIcon, Minus, PlusIcon, TargetIcon } from 'lucide-react'
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useParams } from 'next/navigation'
import CaseTopBar from './CaseTopBar'

interface CaseContainerProps {
  assuranceCase: any
}

const CaseContainer = ({ assuranceCase } : CaseContainerProps) => {
  const { id } = useParams();
  const theme = useTheme();
  // const [token] = useLoginToken();

  const [showEditLayer, setShowEditLayer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  // const [assuranceCase, setAssuranceCase] = useState();
  const [identifiers, setIdentifiers] = useState(new Set());

  // pair state so they can be updated together with only one re-render
  const [selected, setSelected] = useState([]);
  const [selectedId, selectedType] = selected;

  const [mermaidFocus, setMermaidFocus] = useState(false);

  const [shouldFetch, setShouldFetch] = useState(true);

  const [transformScale, setTransformScale] = useState(1)

  function handleTransform(e:any){
    console.log(e.instance.transformState.scale); // output scale factor
    setTransformScale(e.instance.transformState.scale)
  }

  return (
    <>
      <ColumnFlow
        sx={{
          position: "relative",
          flexGrow: 1,
          flexShrink: 1,
          maxHeight: "100%",
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
          // onRefresh={triggerRefresh}
          // setErrors={setErrors}
          // getIdForNewElement={getIdForNewElement}
          // updateAllIdentifiers={updateAllIdentifiers}
          // setSelected={setSelected}
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
                <p>Chart</p>
                {/* <MermaidChart
                  caseId={caseSlug}
                  assuranceCase={assuranceCase}
                  selectedId={selectedId}
                  selectedType={selectedType}
                  setSelected={setSelected}
                  setMermaidFocus={setMermaidFocus}
                /> */}
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
