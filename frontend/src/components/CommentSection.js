import { DataTable, Text } from "grommet";
import { User, Clock } from "grommet-icons";
import React, { useState, useEffect, useCallback } from "react";
import { getBaseURL } from "./utils.js";
import { formatDistanceToNow } from "date-fns";
import ModalDialog from "./common/ModalDialog.jsx";
import { ColumnFlow, RowFlow } from "./common/Layout.jsx";
import { Button, Typography } from "@mui/material";
import useId from "@mui/material/utils/useId.js";
import TextInput from "./common/TextInput.jsx";
import { useLoginToken } from "../hooks/useAuth.js";

function CommentSection({ caseId, isOpen, onClose }) {
  const titleId = useId();

  return (
    <ModalDialog aria-labelledby={titleId} open={isOpen} onClose={onClose}>
      <ColumnFlow>
        <Typography variant="h3" id={titleId}>
          Notes
        </Typography>
        <CommentSectionInner assuranceCaseId={caseId} onClose={onClose} />
      </ColumnFlow>
    </ModalDialog>
  );
}

function CommentSectionInner({ assuranceCaseId, onClose }) {
  const [comments, setComments] = useState([]);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sort, setSort] = useState({
    property: "created_at",
    direction: "desc",
  });

  const [token] = useLoginToken();

  const fetchComments = useCallback(async () => {
    const url = `${getBaseURL()}/comments/${assuranceCaseId}/`;
    const requestOptions = {
      method: "GET",
      headers: {
        Authorization: `Token ${token}`,
      },
    };
    const response = await fetch(url, requestOptions);
    const data = await response.json();
    setComments(data);
  }, [assuranceCaseId, token]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if(!newComment){
        setDirty(true);
        return;
      }

      const url = `${getBaseURL()}/comments/${assuranceCaseId}/`;

      const commentData = {
        content: newComment,
        assurance_case: assuranceCaseId,
      };

      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify(commentData),
      };

      const response = await fetch(url, requestOptions);
      if (response.ok) {
        setNewComment("");
        fetchComments();
      } else {
        // Handle the error response here
        const errorData = await response.json();
        console.error("Failed to post comment:", errorData);
      }
    },
    [assuranceCaseId, token, fetchComments, newComment]
  );

  const onSort = (property) => {
    const direction = sort.direction === "asc" ? "desc" : "asc";
    setSort({ property, direction });
    const sortedComments = [...comments].sort((a, b) => {
      if (a[property] < b[property]) {
        return sort.direction === "asc" ? 1 : -1;
      }
      if (a[property] > b[property]) {
        return sort.direction === "asc" ? -1 : 1;
      }
      return 0;
    });
    setComments(sortedComments);
  };

  const columns = [
    {
      property: "author",
      header: (
        <Text>
          User <User />
        </Text>
      ),
      render: (datum) => datum.author,
    },
    {
      property: "created_at",
      header: (
        <Text>
          Time <Clock />
        </Text>
      ),
      render: (datum) =>
        formatDistanceToNow(new Date(datum.created_at)) + " ago",
      sortable: true,
    },
    {
      property: "content",
      header: "Comment",
      render: (datum) => datum.content,
    },
  ];

  return (
    <>
      <ColumnFlow component="form" onSubmit={onSubmit}>
        <TextInput
          label="New note"
          multiline
          value={newComment}
          setValue={setNewComment}
          error={error}
          setError={setError}
          placeholder="Write your comment here..."
          dirty={dirty}
        />
        <RowFlow>
          <Button
            onClick={onClose}
            variant="outlined"
            sx={{ marginLeft: "auto" }}
          >
            Cancel
          </Button>
          <Button type="submit">Post Comment</Button>
        </RowFlow>
      </ColumnFlow>

      {/* TODO migrate from Grommet */}
      <DataTable
        columns={columns}
        data={comments}
        sort={sort}
        onSort={(event) => onSort(event.property)}
        step={10} // Amount of items to render at a time
      />
    </>
  );
}

export default CommentSection;
