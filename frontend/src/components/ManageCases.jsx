import React, { useCallback, useEffect, useState } from "react";
import { LayoutWithNav, RowFlow } from "./common/Layout";
import { Alert, Card, Modal, Typography } from "@mui/material";
import { getBaseURL } from "./utils";
import LoadingSpinner from "./common/LoadingSpinner";
import { Link } from "react-router-dom";
import CaseCreator from "./CaseCreator";
import useId from "@mui/utils/useId";

const CreateCard = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  const onClick = useCallback(() => {
    setIsOpen(true);
  }, []);

  const onClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const titleId = useId();

  return <Card onClick={onClick} component="button">
    <Typography variant="h3" component="h2">Create a new case</Typography>
    <Typography>OR</Typography>
    <Typography>Import file</Typography>
    <Modal open={isOpen} onClose={onClose}>
      <CaseCreator titleId={titleId} onClose={onClose}/>
    </Modal>
  </Card>;
};

const CaseCard = ({ id, name, description, created_date }) => {
  return <Card component={Link} to={"case/" + id}>
    <Typography variant="h3" component="h2">{name}</Typography>
    <Typography>{description}</Typography>
    {/* TODO, designs would prefer the updated date */}
    <Typography>Created: {created_date}</Typography>
  </Card>;
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

  useEffect(() => {
    let isMounted = true;

    let url = `${getBaseURL()}/cases/`;
    const requestOptions = {
      headers: {
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
    };

    fetch(url, requestOptions)
      .then((response) => response.json())
      .then((body) => {
        if (isMounted && body.map !== undefined) {
          setCases(body.map(({ id, name, description, created_date }) => ({ id, name, description, created_date })));
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
  }, []);

  return (
    <LayoutWithNav>
      <Typography variant="h1">Assurance Cases</Typography>
      {error ? <Alert variant="error"> {error}</Alert> : <></>}
      {/* TODO split into mine and shared with me */}
      <RowFlow>
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
    </LayoutWithNav>
  );
};

export default ManageCases;
