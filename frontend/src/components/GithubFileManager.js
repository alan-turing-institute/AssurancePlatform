import React, { useState, useEffect } from "react";

const BASE_URL = "https://api.github.com/repos/";

const GithubFileManager = ({ user }) => {
  const [selectedRepo, setSelectedRepo] = useState("");
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [fileData, setFileData] = useState({});

  useEffect(() => {
    if (selectedRepo && path) {
      // Read file content
      GithubAPI.readFile(user, selectedRepo, path)
        .then((data) => setFileData(data))
        .catch((err) => console.error(err));
    }
  }, [selectedRepo, path, user]);

  const handleSave = () => {
    if (!fileData.sha) {
      // Create a new file
      GithubAPI.createFile(user, selectedRepo, path, content).catch((err) =>
        console.error(err),
      );
    } else {
      // Edit the existing file
      GithubAPI.editFile(user, selectedRepo, path, content, fileData.sha).catch(
        (err) => console.error(err),
      );
    }
  };

  return (
    <div>
      {/* Other components like selecting a repository can be added here */}

      <input
        placeholder="Path to file/folder"
        value={path}
        onChange={(e) => setPath(e.target.value)}
      />
      <textarea
        placeholder="File Content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button onClick={handleSave}>Save</button>
    </div>
  );
};

const GithubAPI = {
  async readFile(user, repo, path) {
    const url = `${BASE_URL}${user}/${repo}/contents/${path}`;
    const token = localStorage.getItem("token");
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
      },
    });

    const data = await response.json();
    return {
      sha: data.sha,
      content: atob(data.content), // GitHub API returns base64 encoded content
    };
  },

  async createFile(user, repo, path, content) {
    const url = `${BASE_URL}${user}/${repo}/contents/${path}`;
    const token = localStorage.getItem("token");
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Create ${path}`,
        content: btoa(content), // Convert content to base64
      }),
    });

    return response.json();
  },

  async editFile(user, repo, path, content, sha) {
    const url = `${BASE_URL}${user}/${repo}/contents/${path}`;
    const token = localStorage.getItem("token");
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Update ${path}`,
        content: btoa(content), // Convert content to base64
        sha: sha,
      }),
    });

    return response.json();
  },
};

export default GithubFileManager;
