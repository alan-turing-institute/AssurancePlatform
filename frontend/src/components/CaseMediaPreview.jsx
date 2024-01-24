import configData from "../config.json";
import { CardMedia } from "@mui/material";
import mockup_diagram from "../images/mockup-diagram.png";
import { useTheme } from "@emotion/react";
import { useEffect, useState } from "react";
import MermaidChart from "./Mermaid";

export const CaseMediaPreview = ({ caseObj }) => {
  const theme = useTheme();
  const [token] = useLoginToken();
  const [assuranceCase, setAssuranceCase] = useState();

  useEffect(() => {
    if (token) {
      let isMounted = true;
      getCase(token, caseObj.id)
        .then((json) => {
          if (!isMounted) {
            return;
          }
          setAssuranceCase(json);
        })
        .catch((err) => {
          console.error(err);
          // TODO show error to user
        });

      return () => {
        isMounted = false;
      };
    }
  }, [token, caseObj]);

  return (
    <>
      {configData.use_case_preview_svg ? (
        // <MermaidChart assuranceCase={caseObj} collapsedNodes caseId={caseObj.id} />
        <CardMedia
          height={227}
          component="img"
          image={mockup_diagram}
          alt=""
          sx={{ background: theme.palette.grey[200] }}
        />
      ) : (
        <CardMedia
          height={227}
          component="img"
          image={mockup_diagram}
          alt=""
          sx={{ background: theme.palette.grey[200] }}
        />
      )}
    </>
  );
};
