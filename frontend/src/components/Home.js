import { Box, Heading, Text, Grid, Button } from "grommet";
import React from "react";
import { Link } from "react-router-dom";
class Home extends React.Component {
  handleChange() {
    console.log("hello");
  }

  render() {
    return (
      <Box fill>
        <Grid
          fill
          rows={["auto", "flex"]}
          columns={["30%", "flex"]}
          gap="none"
          areas={[
            { name: "main", start: [0, 1], end: [1, 1] },
            { name: "left", start: [0, 0], end: [0, 1] },
          ]}
        >
          <Box
            gridArea="left"
            direction="column"
            gap="small"
            pad={{
              horizontal: "small",
              top: "large",
              bottom: "medium",
            }}
          >
            <Text size="2xl">Ethical Assurance Platform</Text>
            <Text size="medium">
              A tool to support the responsible design, development, and
              deployment of data-driven technologies.
            </Text>
            <Button
              href="/case/new"
              label="Get Started"
              justify="center"
              fill={false}
            ></Button>
          </Box>
          <Box gridArea="main" justify="end">
            <img
              src="https://i.imgur.com/eHFzRO6.png"
              alt="Ethical Assurance flowchart"
            />
          </Box>
        </Grid>
      </Box>
    );
  }
}

export default Home;
