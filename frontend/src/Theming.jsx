import * as React from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import configData from "./config.json";

function Theming({ children }) {
  const theme = createTheme({
    typography: {
      fontFamily: configData.styling.mainFont,
      fontSize: configData.styling.mainFontSize,
      h1: {
        fontSize: `${configData.styling.mainFontSize * 0.1640625}rem`,
        fontWeight: 700,
      },
      h2: {
        fontSize: `${configData.styling.mainFontSize * 0.125}rem`,
        fontWeight: 600,
      },
      h3: {
        fontSize: `${configData.styling.mainFontSize * 0.09375}rem`,
        fontWeight: 600,
      },
    },
    palette: {
      primary: {
        main: "#0F76B8",
        light: "#A7BFD7",
        dark: "#37597B",
        contrastText: "#FFFFFF",
      },
      error: {
        main: "#E42451",
      },
      background: {
        default: "#FAFAFA",
        paper: "#FFFFFF",
      },
      text: {
        primary: "#2F3337",
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            borderRadius: "3.125rem",
            borderWidth: "2px !important", // else its lost on hover...
          },
          outlined: {
            background: "#FFFFFF"
          }
        },
        defaultProps: {
          variant: "contained",
          disableElevation: true,
        },
      },
      MuiPaper: {
        styleOverrides: {
          "rounded": {
            borderRadius: "0.5rem",
          }
        },
        defaultProps: {
          elevation: 4
        }
      }
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export default Theming;
