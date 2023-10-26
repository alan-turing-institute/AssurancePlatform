import React, { useState, useEffect } from "react";

const GitHub = () => {
  const [repositories, setRepositories] = useState([]);
  const [selectedRepoFiles, setSelectedRepoFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // not to be confused with our API token
    const token = localStorage.getItem("access_token");

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

  const handleRepoClick = (repoName) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      fetch(`https://api.github.com/repos/${repoName}/contents`, {
        headers: {
          Authorization: `token ${token}`,
        },
      })
        .then((response) => response.json())
        .then((files) => {
          setSelectedRepoFiles(files);
        })
        .catch((error) => {
          console.error("Error fetching repo files:", error);
        });
    }
  };

  if (loading) {
    return <div>Loading repositories...</div>;
  }

  console.log(repositories);
  const filteredRepos = repositories.filter((repo) =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div>
      <h2>Your GitHub Repositories</h2>
      <input
        type="text"
        placeholder="Search Repositories..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <ul>
        {filteredRepos.map((repo) => (
          <li key={repo.id} onClick={() => handleRepoClick(repo.full_name)}>
            {repo.name}
          </li>
        ))}
      </ul>
      {selectedRepoFiles.length > 0 && (
        <div>
          <h3>Files in selected repository:</h3>
          <ul>
            {selectedRepoFiles.map((file, index) => (
              <li key={index}>{file.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default GitHub;
