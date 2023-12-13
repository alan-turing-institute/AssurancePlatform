import * as React from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";

function Theming({ children }) {
  const theme = createTheme({
    typography: {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: 16,
      h1: {
        fontSize: "2.625rem",
        fontWeight: 700,
      },
      h2: {
        fontSize: "2rem",
        fontWeight: 600,
      },
      h3: {
        fontSize: "1.5rem",
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
          elevation: 8
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
