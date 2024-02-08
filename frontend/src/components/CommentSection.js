import React, { useState, useEffect, useCallback } from "react";
import { getBaseURL } from "./utils.js";
import { formatDistanceToNow } from "date-fns";
import ModalDialog from "./common/ModalDialog.jsx";
import { ColumnFlow, RowFlow } from "./common/Layout.jsx";
import { Button, Typography } from "@mui/material";
import useId from "@mui/utils/useId";
import TextInput from "./common/TextInput.jsx";
import { useLoginToken } from "../hooks/useAuth.js";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { visuallyHidden } from "@mui/utils";
import TableSortLabel from "@mui/material/TableSortLabel";
import Box from "@mui/material/Box";

/**
 * CommentSection provides an interface for users to view and add comments to an assurance case. It presents a modal dialog with a form to submit new comments and a list of existing comments.
 *
 * @param {Object} props - Component props.
 * @param {string} props.caseId - The unique identifier of the assurance case to which comments are related.
 * @param {boolean} props.isOpen - Boolean state to control the visibility of the comment section modal.
 * @param {Function} props.onClose - Function to call when closing the comment section modal.
 * @returns {JSX.Element} A modal dialog component that allows users to manage comments for an assurance case.
 */
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

/**
 * CommentSectionInner handles the display and management of comments for a specific assurance case, including posting new comments and sorting existing ones.
 *
 * @param {Object} props - Component props.
 * @param {string} props.assuranceCaseId - The unique identifier of the assurance case.
 * @param {Function} props.onClose - Function to call when the user wishes to close the comment section.
 * @returns {JSX.Element} The inner content of the comment section, including a form for new comments and a list of existing comments.
 */
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

  /**
   * Fetch comments from the server.
   *
   * @returns {undefined}
   */
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

  /**
   * Fetch comments when the component mounts.
   *
   * @returns {undefined}
   */
  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  /**
   * Post a new comment to the server.
   *
   * @param {Event} e - The form submission event.
   * @returns {undefined}
   */
  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if (!newComment) {
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
    [assuranceCaseId, token, fetchComments, newComment],
  );

  /**
   * Sort comments by a given property.
   *
   * @param {string} property - The property to sort by.
   * @returns {undefined}
   */
  const onSort = (property) => {
    const opositeDir = sort.direction === "asc" ? "desc" : "asc";
    const direction = sort.property === property ? opositeDir : sort.direction;
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
      header: "User",
    },
    {
      property: "created_at",
      header: "Time",
    },
    {
      property: "content",
      header: "Comment",
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

      <TableContainer component={Paper}>
        <Table sx={{ width: "100%" }} size="small">
          <TableHead>
            <TableRow>
              {columns.map((headCell) => (
                <TableCell
                  key={headCell.header}
                  sortDirection={
                    sort.property === headCell.property ? sort.direction : false
                  }
                >
                  <TableSortLabel
                    active={sort.property === headCell.property}
                    direction={sort.direction}
                    onClick={() => onSort(headCell.property)}
                  >
                    {headCell.header}
                    {sort.property === headCell.property ? (
                      <Box component="span" sx={visuallyHidden}>
                        {sort.direction === "desc"
                          ? "sorted descending"
                          : "sorted ascending"}
                      </Box>
                    ) : null}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {comments.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.author}</TableCell>
                <TableCell>
                  {formatDistanceToNow(new Date(row.created_at)) + " ago"}
                </TableCell>
                <TableCell>{row.content}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

export default CommentSection;
