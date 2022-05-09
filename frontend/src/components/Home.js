import { Box, Heading } from "grommet";
import React from "react";
import { Link } from "react-router-dom";
class Home extends React.Component {
  handleChange() {
    console.log("hello");
  }

  render() {
    return (
      <div>
        <Box pad="small" margin="medium" width="100%">
          <Heading level={2}>Ethical Assurance Platform</Heading>
          <Heading level={4} width="100%">
            A tool to support the responsible design, development, and
            deployment of data-driven technologies.
          </Heading>
          <Box>
            <img
              src="https://i.imgur.com/eHFzRO6.png"
              alt="Ethical Assurance flowchart"
              width="600"
            />
          </Box>
          <Box>
            <ul>
              <li>
                <Link to="/case/new">Get Started</Link>{" "}
              </li>
              <li>
                <a href="https://github.com/alan-turing-institute/AssurancePlatform">
                  Documentation
                </a>
              </li>
            </ul>
          </Box>
          <Box pad="small" margin="medium" width="70%">
            <Heading level={3}>What is Ethical Assurance?</Heading>
            <Box>
              Ethical assurance is a method for producing reviewable and
              structured documentation about the actions and decisions that have
              been taken over the course of a project's lifecycle, which support
              key ethical goals, such as fairness or explainability.
            </Box>
          </Box>
          <Box pad="small" margin="medium" width="70%">
            <Heading level={3}>The Project Lifecycle</Heading>
            <Box>
              Our method of assurance helps project teams identify which stages
              of their project's lifecycle are most significant for addressing
              ethical challenges, such as how to mitigate bias.
            </Box>
            <Box>
              <img
                src="https://i.imgur.com/xYrOPwc.png"
                alt="picture"
                width="700"
              />
            </Box>
          </Box>
          <Box>
            <Heading level={3}>The Process</Heading>
            <Box>
              We have simplified the assurance process into three over-arching
              steps:
              <ul>
                <li>
                  {" "}
                  Reflect and deliberate on the relevant ethical goals for your
                  project.
                </li>
                <li>
                  {" "}
                  Take actions that instantiate key properties within your
                  project and system.
                </li>
                <li>
                  {" "}
                  Document evidence that justifies your commitment to
                  responsible research and innovation.
                </li>
              </ul>
            </Box>
            <Box>
              <div id="banner">
                <div class="inline-block">
                  <img
                    src="https://i.imgur.com/fBGF7LX.png"
                    alt="reflect"
                    width="150"
                  />
                </div>
                <div class="inline-block">
                  <img
                    src="https://i.imgur.com/yxpDXAJ.png"
                    alt="act"
                    width="150"
                  />
                </div>
                <div class="inline-block">
                  <img
                    src="https://i.imgur.com/IDVx3db.png"
                    alt="justify"
                    width="150"
                  />
                </div>
              </div>
            </Box>
          </Box>
        </Box>
      </div>
    );
  }
}

export default Home;
