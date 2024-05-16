import React, { useState, useEffect } from "react";
import { Box, useTheme, Typography } from "@mui/material";
import ManageCases from "./ManageCases";
import { useLoginToken } from "../hooks/useAuth";
import Login from "./Login";
import { ColumnFlow } from "./common/Layout";
import splashImage from "../images/building-an-assurance-case-adjusted-aspect-ratio.png";

/**
 * Splash presents a visually engaging splash screen for users not logged in or when a page is not found. It displays a background image with an option for user login or a not found message. This component is the initial view for users accessing the platform, guiding them to login for further interaction.
 *
 * @param {Object} props - Component props.
 * @param {boolean} props.notFound - Indicates whether the splash screen is shown as a result of a 404 not found error.
 * @returns {JSX.Element} A layout with a background image on one side and a login component or not found message on the other.
 *
 * The splash screen is designed to be responsive and visually appealing, setting the tone of the application. It utilizes the Material UI Box and Typography components for layout and text display. The choice between showing a login form and a not found message is determined by the `notFound` prop. This component plays a crucial role in user experience by providing a clear entry point for authentication or notifying users when a requested page is unavailable.
 */
export const Splash = ({ notFound }) => {
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
        {notFound ? (
          <Typography variant="h2" component="h1" sx={{ padding: "2rem" }}>
            Page not found
          </Typography>
        ) : (
          <Login />
        )}
      </ColumnFlow>
    </Box>
  );
};

/**
 * Home serves as the main entry point for users, directing them to either manage their cases if logged in or to the splash screen if not. It checks the authentication status and dynamically renders the appropriate component based on the user's login state.
 *
 * @returns {JSX.Element} Either the ManageCases component for logged-in users or the Splash component for guests.
 *
 * This component uses the `useLoginToken` hook to determine if a user is authenticated. If a token is present, indicating the user is logged in, the ManageCases component is rendered, allowing the user to interact with their assurance cases. If no token is found, the Splash component is displayed, prompting the user to log in or indicating that the page is not found. This component orchestrates the primary user flow of the application based on authentication status.
 */
export const Home = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [token] = useLoginToken();

  /**
   * Update the login status when the token changes.
   */
  useEffect(() => {
    setIsLoggedIn(token != null);
  }, [token]);

  return isLoggedIn ? <ManageCases /> : <Splash />;
};
