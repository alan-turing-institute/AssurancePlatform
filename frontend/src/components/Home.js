import React, { useState, useEffect } from "react";
import { Box, Image, Text, Grid } from "grommet";
import mockup_diagram from "../images/mockup-diagram.png";

const Home = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(token != null);
  }, []);

  return (
    <Box fill pad="medium" overflow="auto">
      <Grid
        fill
        rows={["auto", "flex"]}
        columns={["auto", "flex"]}
        areas={[
          { name: "header", start: [0, 0], end: [1, 0] },
          { name: "sidebar", start: [0, 1], end: [0, 1] },
          { name: "main", start: [1, 1], end: [1, 1] },
        ]}
        gap="none"
      >
        <Box
          gridArea="header"
          direction="row"
          gap="small"
          pad={{ horizontal: "small", vertical: "small" }}
          justify="between"
        >
          <Text size="2xl">Ethical Assurance Platform</Text>
        </Box>
        <Box
          gridArea="sidebar"
          direction="column"
          gap="small"
          pad={{ horizontal: "small", top: "medium", bottom: "large" }}
        >
          {/* Sidebar content here */}
        </Box>
        <Box gridArea="main" justify="end">
          <Image
            fit="contain"
            src={mockup_diagram}
            alt="Ethical Assurance flowchart"
          />
        </Box>
      </Grid>
    </Box>
  );
};

export default Home;
