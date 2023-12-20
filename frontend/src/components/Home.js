import React, { useState, useEffect } from "react";
import { Box, useTheme } from "@mui/material";
import ManageCases from "./ManageCases";
import { useLoginToken } from "../hooks/useAuth";
import Login from "./Login";
import { ColumnFlow } from "./common/Layout";
import splashImage from "../images/building-an-assurance-case-adjusted-aspect-ratio.png";

const Splash = () => {
  // TODO #302 add content to splash screen
  const theme = useTheme();

  return (
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
          // TODO use SVG instead - but that would involve tweaking the aspect ratio of the svg
          // and repairing the odd background at the border
          backgroundImage: `url(${splashImage})`,
          backgroundRepeat: "no-repeat",
          backgroundColor: "#63c0d5",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      ></ColumnFlow>
      <ColumnFlow
        sx={{
          width: "35.375rem",
          maxWidth: "100%",
          flexShrink: 0,
          padding: "2.25rem 1.5rem",
          borderLeftStyle: "solid",
          borderLeftWidth: "1px",
          borderLeftColor: theme.palette.primary.main,
          backgroundColor: "#FAFAFA",
        }}
      >
        <Login />
      </ColumnFlow>
    </Box>
  );
};

const Home = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [token] = useLoginToken();

  useEffect(() => {
    setIsLoggedIn(token != null);
  }, [token]);

  return isLoggedIn ? <ManageCases /> : <Splash />;
};

export default Home;
