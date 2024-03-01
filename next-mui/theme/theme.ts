'use client';

import { Roboto } from 'next/font/google';
import { createTheme } from '@mui/material/styles';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

const theme = createTheme({
  typography: {
    fontFamily: roboto.style.fontFamily,
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

export default theme;
