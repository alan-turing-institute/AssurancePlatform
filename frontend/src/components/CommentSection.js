import {
  Box,
  Button,
  TextArea,
  List,
  ListItem,
  Form,
  FormField,
} from "grommet";
import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { getBaseURL } from "./utils.js";

function CommentSection() {
  const { assuranceCaseId } = useParams();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [editCommentId, setEditCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    fetchComments();
  }, [assuranceCaseId]);

  const fetchComments = async () => {
    const url = `${getBaseURL()}/comments/${assuranceCaseId}`;
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
    const url = `${getBaseURL()}/comments/${assuranceCaseId}`;
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ text: newComment }),
    };
    const response = await fetch(url, requestOptions);
    if (response.ok) {
      setNewComment("");
      fetchComments();
    }
  };

  const handleEditComment = (commentId, commentText) => {
    setEditCommentId(commentId);
    setEditCommentText(commentText);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
  };

  const handleEditCommentChange = (event) =>
    setEditCommentText(event.target.value);

  const handleUpdateComment = async (commentId) => {
    const url = `${getBaseURL()}/comments/${commentId}`;
    const requestOptions = {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ text: editCommentText }),
    };
    const response = await fetch(url, requestOptions);
    if (response.ok) {
      setEditCommentId(null);
      fetchComments();
    }
  };

  return (
    <Box fill="vertical" overflow="auto" align="start" flex="grow">
      <Box flex={false} direction="row" align="center" justify="between">
        <TextArea
          placeholder="Write your comment here..."
          value={newComment}
          onChange={handleNewCommentChange}
        />
        <Button label="Post Comment" onClick={handlePostComment} />
      </Box>
      <List data={comments}>
        {(datum, index) => (
          <ListItem
            key={index}
            direction="row"
            align="center"
            justify="between"
          >
            {editCommentId === datum.id ? (
              <Form>
                <FormField>
                  <TextArea
                    ref={inputRef}
                    value={editCommentText}
                    onChange={handleEditCommentChange}
                  />
                </FormField>
                <Button
                  label="Update"
                  onClick={() => handleUpdateComment(datum.id)}
                />
              </Form>
            ) : (
              <>
                <span>{datum.text}</span>
                <Button
                  label="Edit"
                  onClick={() => handleEditComment(datum.id, datum.text)}
                />
              </>
            )}
          </ListItem>
        )}
      </List>
    </Box>
  );
}

export default CommentSection;
