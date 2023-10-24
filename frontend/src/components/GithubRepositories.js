import React, { useState, useEffect } from "react";

const GithubRepositories = () => {
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      fetch("https://api.github.com/user/repos", {
        headers: {
          Authorization: `token ${token}`,
        },
      })
        .then((response) => response.json())
        .then((repos) => {
          setRepositories(repos);
          setLoading(false);
        })
        .catch((error) => {
          console.error("Error fetching repositories:", error);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return <div>Loading repositories...</div>;
  }

  return (
    <div>
      <h2>Your GitHub Repositories</h2>
      <ul>
        {repositories.map((repo) => (
          <li key={repo.id}>
            <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
              {repo.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GithubRepositories;
