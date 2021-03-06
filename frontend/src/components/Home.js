import React from "react";
import { Box, Image, Text, Grid, Button } from "grommet";
import mockup_diagram from "../images/mockup-diagram.png";

class Home extends React.Component {
  getButtons() {
    if (localStorage.getItem("token") != null) {
      return (
        <Box
          gridArea="left"
          direction="column"
          gap="small"
          pad={{
            horizontal: "small",
            top: "medium",
            bottom: "large",
          }}
        >
          <Button
            href="/case/new"
            justify="center"
            fill={false}
            label="Get started!"
          />
          <Button href="/logout" justify="center" fill={false} label="Logout" />
        </Box>
      );
    } else {
      return (
        <Box
          gridArea="left"
          direction="column"
          gap="small"
          pad={{
            horizontal: "small",
            top: "medium",
            bottom: "large",
          }}
        >
          <Button href="/login" justify="center" fill={false} label="Login" />
          <Button
            href="/signup"
            justify="center"
            fill={false}
            label="Sign up"
          />
        </Box>
      );
    }
  }

  render() {
    return (
      <Box fill pad="medium" overflow="auto">
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
            {this.getButtons()}
          </Box>
          <Box gridArea="main" justify="end">
            <Image
              fit="contain"
              src={mockup_diagram}
              alt="Ethical Assurance flowchart"
              height="100%"
            />
          </Box>
        </Grid>
      </Box>
    );
  }
}

export default Home;
