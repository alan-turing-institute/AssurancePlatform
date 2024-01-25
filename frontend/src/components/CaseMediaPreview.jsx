import configData from "../config.json";
import { CardMedia } from "@mui/material";
import mockup_diagram from "../images/mockup-diagram.png";
import { useTheme } from "@emotion/react";
import { useEffect, useState } from "react";
import MermaidChart from "./Mermaid";
import { useLoginToken } from "../hooks/useAuth";
import { getCase } from "./caseApi";
import { Box } from "@mui/material";
import { LoadingCard } from "./ManageCases";

export const CaseMediaPreview = ({ caseObj }) => {
  const theme = useTheme();
  const [token] = useLoginToken();
  const [assuranceCase, setAssuranceCase] = useState();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      let isMounted = true;
      getCase(token, caseObj.id)
        .then((json) => {
          if (!isMounted) {
            return;
          }
          setAssuranceCase(json);
          setIsLoading(false);
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

  if (configData.use_case_preview_svg) {
    return (
      <>
        {isLoading ? (
          <LoadingCard />
        ) : (
          <Box
            sx={{
              height: "50%",
              position: "relative",
              pointerEvents: "none",
              overflow: "hidden",
            }}
          >
            <MermaidChart
              assuranceCase={assuranceCase}
              caseId={caseObj.id}
              selectedId={[]}
              selectedType={[]}
              setSelected={() => {}}
              setMermaidFocus={() => {}}
            />
          </Box>
        )}
      </>
    );
  } else {
    return (
      <CardMedia
        height={227}
        component="img"
        image={mockup_diagram}
        alt=""
        sx={{ background: theme.palette.grey[200] }}
      />
    );
  }
};
