import * as React from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";

function Theming({ children }) {
  const theme = createTheme({
    typography: { fontFamily: '"Plus Jakarta Sans", sans-serif' },
    palette: {
      primary: {
        main: "#0F76B8",
        light: "#A7BFD7",
        dark: "#37597B",
        contrastText: "#FFFFFF",
      },
    }
  });

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

export default Theming;
