import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import MermaidChart from "./Mermaid";
import ItemEditor from "./ItemEditor.js";
import { useEnforceLogin, useLoginToken } from "../hooks/useAuth";

import "./CaseContainer.css";
import {
  Alert,
  Box,
  IconButton,
  Paper,
  Typography,
  useTheme,
} from "@mui/material";
import LoadingSpinner from "./common/LoadingSpinner.jsx";
import { getCase } from "./caseApi.js";
import CaseTopBar from "./CaseTopBar.jsx";
import { ColumnFlow, RowFlow } from "./common/Layout.jsx";
import { Add, Subtract, Target } from "./common/Icons.jsx";

function CaseContainer() {
  const { caseSlug } = useParams();
  const theme = useTheme();
  const [token] = useLoginToken();

  const [showEditLayer, setShowEditLayer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [assuranceCase, setAssuranceCase] = useState();

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

  return (
    <>
      {isLoading || !assuranceCase ? (
        <LoadingSpinner color="inherit" />
      ) : (
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            flexShrink: 1,
            flexGrow: 1,
            overflow: "hidden",
          }}
        >
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
            />
            {errors.map((err) => (
              <Alert key={err} severity="error">
                {err}
              </Alert>
            ))}
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
                    <Paper sx={{ marginLeft: "auto" }}>
                      <IconButton
                        size="small"
                        aria-label="re-centre"
                        onClick={() => resetTransform()}
                      >
                        <Target fontSize="small" />
                      </IconButton>
                    </Paper>
                    <Paper>
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
              }}
            >
              <ItemEditor
                caseId={caseSlug}
                id={selectedId}
                type={selectedType}
                assuranceCase={assuranceCase}
                onRefresh={triggerRefresh}
                onHide={hideEditLayer}
              />
            </ColumnFlow>
          ) : (
            <></>
          )}
        </Box>
      )}
    </>
  );
}

export default CaseContainer;
