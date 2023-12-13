import React, { useCallback, useEffect, useState } from "react";
import { LayoutWithNav, RowFlow } from "./common/Layout";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Typography,
  useTheme,
} from "@mui/material";
import { getBaseURL } from "./utils";
import LoadingSpinner from "./common/LoadingSpinner";
import { Link } from "react-router-dom";
import CaseCreator from "./CaseCreator";
import useId from "@mui/utils/useId";
import { useEnforceLogin, useLoginToken } from "../hooks/useAuth";
import mockup_diagram from "../images/mockup-diagram.png";

const ThemedCard = ({ sx, ...props }) => {
  return (
    <Card
      elevation={0}
      sx={{
        ...sx,
        height: "29.0625rem",
        width: "22.0625rem",
        borderRadius: "0.5rem",
      }}
      {...props}
    />
  );
};

const CreateCard = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isImport, setIsImport] = useState(false);

  const onCreateClick = useCallback(() => {
    setIsImport(false);
    setIsOpen(true);
  }, []);

  const onImportClick = useCallback(() => {
    setIsImport(true);
    setIsOpen(true);
  }, []);

  const onClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const titleId = useId();

  const theme = useTheme();

  return (
    <ThemedCard
      sx={{
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Button
        onClick={onCreateClick}
        sx={{ flexGrow: 1, maxHeight: "55%", alignItems: "end" }}
      >
        <Typography variant="h3" component="h2">
          Create a new case
        </Typography>
      </Button>
      <Typography variant="body2" sx={{ textAlign: "center" }}>
        OR
      </Typography>
      <Button
        onClick={onImportClick}
        sx={{ textDecoration: "underline", fontWeight: "bold" }}
      >
        Import file
      </Button>
      <CaseCreator
        titleId={titleId}
        isOpen={isOpen}
        onClose={onClose}
        isImport={isImport}
      />
    </ThemedCard>
  );
};

const formatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "2-digit",
  year: "numeric",
});

const CaseCard = ({ id, name, description, createdDate }) => {
  const theme = useTheme();

  return (
    <ThemedCard component={Link} to={"case/" + id}>
      <CardMedia
        height={227}
        component="img"
        image={mockup_diagram}
        alt=""
        sx={{ background: theme.palette.grey[200] }}
      />
      <CardContent
        sx={{
          padding: "1.5rem",
          display: "inline-flex",
          flexDirection: "column",
          gap: "0.5rem",
          width: "100%",
          height: "50%",
          textDecoration: "none",
          color: "unset",
        }}
      >
        <Typography variant="h3" component="h2">
          {name}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            flexGrow: 1,
            textWrap: "wrap",
            textOverflow: "ellipsis",
            overflow: "clip",
          }}
        >
          {description}
        </Typography>
        {/* TODO, designs would prefer the updated date */}
        <Typography variant="body2">
          Created: {formatter.format(createdDate)}
        </Typography>
      </CardContent>
    </ThemedCard>
  );
};

const LoadingCard = () => {
  return (
    <ThemedCard sx={{ display: "flex" }}>
      <LoadingSpinner sx={{ margin: "auto" }} />
    </ThemedCard>
  );
};

const ManageCases = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [error, setError] = useState("");

  useEnforceLogin();
  const [token] = useLoginToken();

  useEffect(() => {
    let isMounted = true;

    let url = `${getBaseURL()}/cases/`;
    const requestOptions = {
      headers: {
        Authorization: `Token ${token}`,
      },
    };

    fetch(url, requestOptions)
      .then((response) => response.json())
      .then((body) => {
        if (isMounted && body.map !== undefined) {
          setCases(
            body
              .map(({ id, name, description, created_date }) => ({
                id,
                name,
                description,
                createdDate: new Date(created_date),
              }))
              // descending
              .sort((a, b) => b.createdDate - a.createdDate)
          );
          setIsLoading(false);
        }
      })
      .catch((ex) => {
        console.error(ex);
        setIsLoading(false);
        setError("Something went wrong. Please try again later.");
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <LayoutWithNav>
      <Box sx={{ overflowY: "auto" }}>
        <Typography variant="h1">Assurance Cases</Typography>
        {error ? <Alert variant="error"> {error}</Alert> : <></>}
        {/* TODO split into mine and shared with me */}
        <RowFlow sx={{ flexWrap: "wrap" }}>
          <CreateCard />
          {isLoading ? (
            <LoadingCard />
          ) : (
            <>
              {cases.map(({ id, ...props }) => (
                <CaseCard id={id} key={id} {...props} />
              ))}
            </>
          )}
        </RowFlow>
      </Box>
    </LayoutWithNav>
  );
};

export default ManageCases;
