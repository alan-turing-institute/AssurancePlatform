import { Box, Button, TextArea, Text } from "grommet";
import React, { useState, useEffect } from "react";
import { getBaseURL } from "./utils.js";
import { formatDistanceToNow } from "date-fns"; // Ensure you have date-fns installed

function CommentSection({ assuranceCaseId, authorId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null); // To track which comment is being edited

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

  const handleEditComment = async (commentId, content) => {
    // Function to handle comment edit submission
    const url = `${getBaseURL()}/comments/${commentId}/`;
    const commentData = { content: content };

    const requestOptions = {
      method: "PATCH", // Use PATCH for partial updates
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(commentData),
    };

    const response = await fetch(url, requestOptions);
    if (response.ok) {
      fetchComments();
      setEditingCommentId(null); // Reset editing state
    } else {
      // Handle the error response here
      const errorData = await response.json();
      console.error("Failed to edit comment:", errorData);
    }
  };

  const handlePostComment = async () => {
    const url = `${getBaseURL()}/comments/${assuranceCaseId}/`; // General comments endpoint for a specific case

    const commentData = {
      content: newComment,
      assurance_case: assuranceCaseId,
      author: authorId, // Assuming you still want to send the author ID
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

  const renderComments = (comments) => {
    return comments.map((comment) => (
      <Box key={comment.id} direction="column" pad={{ left: "1em" }}>
        <Box direction="row" align="center" justify="between" pad="small">
          <Text size="small">
            {console.log(comment)}
            {comment.author} -{" "}
            {formatDistanceToNow(new Date(comment.created_at))} ago
          </Text>
          {editingCommentId === comment.id ? (
            <TextArea
              value={newComment}
              onChange={handleNewCommentChange}
              onBlur={() => handleEditComment(comment.id, newComment)}
            />
          ) : (
            <Text>{comment.content}</Text>
          )}
          <Button
            label="Edit"
            onClick={() => {
              setNewComment(comment.content);
              setEditingCommentId(comment.id);
            }}
          />
        </Box>
      </Box>
    ));
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
      {renderComments(comments)}
    </Box>
  );
}

export default CommentSection;
