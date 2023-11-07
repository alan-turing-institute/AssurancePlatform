import { Box, Button, TextArea, List, Collapsible, Text } from "grommet";
import React, { useState, useEffect } from "react";
import { getBaseURL } from "./utils.js";
import { formatDistanceToNow } from "date-fns"; // You'll need to install date-fns if you haven't

function CommentSection({ assuranceCaseId, authorId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [showReplies, setShowReplies] = useState({}); // To manage which comment's replies are visible

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

  const handlePostComment = async (parentId = null) => {
    const url = `${getBaseURL()}/comments/${assuranceCaseId}/`; // General comments endpoint
    const commentData = {
      content: newComment,
      assurance_case: assuranceCaseId,
      author: authorId,
      parent: parentId,
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

  const renderComments = (comments, depth = 0) => {
    return comments.map((comment, index) => (
      <Box key={comment.id} direction="column" pad={{ left: `${depth * 2}em` }}>
        <Box
          direction="row"
          align="center"
          justify="between"
          pad="small"
          onClick={() =>
            setShowReplies({
              ...showReplies,
              [comment.id]: !showReplies[comment.id],
            })
          }
        >
          <Text size="small">
            {comment.author.username} -{" "}
            {formatDistanceToNow(new Date(comment.created_at))} ago
          </Text>
          <Text>{comment.content}</Text>
          <Button label="Reply" onClick={() => setReplyTo(comment.id)} />
        </Box>
        {comment.replies && comment.replies.length > 0 && (
          <Collapsible open={showReplies[comment.id]}>
            {renderComments(comment.replies, depth + 1)}
          </Collapsible>
        )}
      </Box>
    ));
  };
  return (
    <Box fill="vertical" overflow="auto" align="start" flex="grow">
      <Box flex={false} direction="row" align="center" justify="between">
        <TextArea
          placeholder={`Replying to ${
            replyTo ? `Comment #${replyTo}` : "Write your comment here..."
          }`}
          value={newComment}
          onChange={handleNewCommentChange}
        />
        <Button
          label="Post Comment"
          onClick={() => handlePostComment(replyTo)}
        />
      </Box>
      {renderComments(comments)}
    </Box>
  );
}

export default CommentSection;
