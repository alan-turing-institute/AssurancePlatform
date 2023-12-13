import React, { useCallback, useEffect, useState } from "react";
import { LayoutWithNav, RowFlow } from "./common/Layout";
import { Alert, Box, Button, Card, CardMedia, Typography } from "@mui/material";
import { getBaseURL } from "./utils";
import LoadingSpinner from "./common/LoadingSpinner";
import { Link } from "react-router-dom";
import CaseCreator from "./CaseCreator";
import useId from "@mui/utils/useId";
import { useEnforceLogin, useLoginToken } from "../hooks/useAuth";
import AtiButton from "./common/AtiButton";
import mockup_diagram from "../images/mockup-diagram.png";

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

  return (
    <Card>
      <Button onClick={onCreateClick}>
        <Typography variant="h3" component="h2">
          Create a new case
        </Typography>
      </Button>
      <Typography>OR</Typography>
      <AtiButton variant="text" onClick={onImportClick}>
        Import file
      </AtiButton>
      <CaseCreator
        titleId={titleId}
        isOpen={isOpen}
        onClose={onClose}
        isImport={isImport}
      />
    </Card>
  );
};

const CaseCard = ({ id, name, description, created_date }) => {
  return (
    <Card>
      <CardMedia height={227} component="img" image={mockup_diagram} alt="" />
      <Link to={"case/" + id}>
        <Typography variant="h3" component="h2">
          {name}
        </Typography>
        <Typography>{description}</Typography>
        {/* TODO, designs would prefer the updated date */}
        <Typography>Created: {created_date}</Typography>
      </Link>
    </Card>
  );
};

const LoadingCard = () => {
  return (
    <Card>
      <LoadingSpinner />
    </Card>
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
            body.map(({ id, name, description, created_date }) => ({
              id,
              name,
              description,
              created_date,
            }))
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
