import { Box, Button, TextArea, DataTable, Text } from "grommet";
import { FormEdit, User, Clock } from "grommet-icons";
import React, { useState, useEffect } from "react";
import { getBaseURL } from "./utils.js";
import { formatDistanceToNow } from "date-fns";
import ModalDialog from "./common/ModalDialog.jsx";
import { ColumnFlow, RowFlow } from "./common/Layout.jsx";
import { Alert, Typography } from "@mui/material";
import LoadingSpinner from "./common/LoadingSpinner.jsx";

function CommentSection({ caseId, isOpen, onClose}){
  return (
    <ModalDialog
      // aria-labelledby={titleId}
      // aria-describedby={descriptionId}
      open={isOpen}
      onClose={onClose}
    >
      <ColumnFlow>
        <CommentSection2 assuranceCaseId={caseId} />
      </ColumnFlow>
    </ModalDialog>
  );
}

function CommentSection2({ assuranceCaseId, authorId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [sort, setSort] = useState({
    property: "created_at",
    direction: "desc",
  });

  useEffect(() => {
    fetchComments();
  }, [assuranceCaseId]);

  const fetchComments = async () => {
    const url = `${getBaseURL()}/comments/${assuranceCaseId}/`;
    const requestOptions = {
      method: "GET",
      headers: {
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
    };
    const response = await fetch(url, requestOptions);
    const data = await response.json();
    setComments(data);
  };

  const handleNewCommentChange = (event) => setNewComment(event.target.value);

  const handlePostComment = async () => {
    const url = `${getBaseURL()}/comments/${assuranceCaseId}/`;

    const commentData = {
      content: newComment,
      assurance_case: assuranceCaseId,
    };

    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${localStorage.getItem("token")}`,
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
  };
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
    <Box fill="vertical" align="start" flex="grow">
      <Box flex={false} direction="row" align="center" justify="between">
        <TextArea
          placeholder="Write your comment here..."
          value={newComment}
          onChange={handleNewCommentChange}
        />
        <Button label="Post Comment" onClick={handlePostComment} />
      </Box>
      <DataTable
        columns={columns}
        data={comments}
        sort={sort}
        onSort={(event) => onSort(event.property)}
        step={10} // Amount of items to render at a time
      />
    </Box>
  );
}

export default CommentSection;
