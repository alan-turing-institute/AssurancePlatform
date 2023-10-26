import React, { useState, useEffect } from "react";
import { Box, TextInput, List, Image, Button, Select, Grid } from "grommet";
import { useNavigate } from "react-router-dom";
import { getSelfUser } from "./utils.js";

const GitHub = () => {
  const [selectedOrg, setSelectedOrg] = useState({});
  const [organizations, setOrganizations] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [selectedRepoFiles, setSelectedRepoFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const [githubUsername, setGithubUsername] = useState("");

  useEffect(() => {
    const fetchInitialData = async () => {
      const userGithubHandle = await getSelfUser()["username"];
      setSelectedOrg({ login: userGithubHandle || "Your Profile" });

      const token = localStorage.getItem("access_token");

      if (token) {
        // Fetch user organizations
        const orgsResponse = await fetch("https://api.github.com/user/orgs", {
          headers: {
            Authorization: `token ${token}`,
          },
        });
        const orgs = await orgsResponse.json();
        setOrganizations(orgs);

        // Fetch user's own repos
        const reposResponse = await fetch("https://api.github.com/user/repos", {
          headers: {
            Authorization: `token ${token}`,
          },
        });
        const repos = await reposResponse.json();
        setRepositories(repos);
      }
      setLoading(false);
    };

    fetchInitialData();
  }, []);

  const fetchUserRepos = (username) => {
    const token = localStorage.getItem("access_token");

    if (token) {
      fetch(`https://api.github.com/users/${username}/repos`, {
        headers: {
          Authorization: `token ${token}`,
        },
      })
        .then((response) => response.json())
        .then((repos) => {
          setRepositories(repos);
        });
    }
  };

  const handleAddGithubUser = () => {
    fetchUserRepos(githubUsername);
    setSelectedOrg({ login: githubUsername });
    setGithubUsername("");
  };

  const fetchReposForOrg = (orgLogin) => {
    const token = localStorage.getItem("access_token");

    if (token) {
      fetch(`https://api.github.com/orgs/${orgLogin}/repos`, {
        headers: {
          Authorization: `token ${token}`,
        },
      })
        .then((response) => response.json())
        .then((repos) => {
          // Filter by permissions
          const filteredRepos = repos.filter(
            (repo) => repo.permissions.admin || repo.permissions.maintain,
          );
          setRepositories(filteredRepos);
        });
    }
  };

  const handleOrgChange = ({ option }) => {
    setSelectedOrg(option);
    if (option) {
      fetchReposForOrg(option.login);
    }
  };

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

  const handleImportClick = async () => {
    try {
      const response = await fetch(selectedFile.download_url);
      const fileContent = await response.text();
      navigate("/case/new", { state: { fileContent } });
    } catch (error) {
      console.error("Error fetching file content:", error);
    }
  };

  if (loading) {
    return <Box pad="medium">Loading repositories...</Box>;
  }

  const filteredRepos = repositories.filter((repo) =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Box pad="medium">
      <Grid columns={["flex", "flex", "flex"]} gap="medium">
        <Box>
          <Box direction="row" gap="small">
            <TextInput
              placeholder="GitHub Username"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
            />
            <Button label="Add" onClick={handleAddGithubUser} />
          </Box>
          <Select
            placeholder="Select organization or user"
            options={[{ login: selectedOrg.login }, ...organizations]}
            labelKey="login"
            valueKey="login"
            onChange={handleOrgChange}
            value={selectedOrg && selectedOrg.login}
          />
          <TextInput
            placeholder="Search Repositories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Box height="medium" overflow="auto">
            <List
              data={filteredRepos}
              primaryKey="name"
              onClickItem={({ item }) => handleRepoClick(item.full_name)}
            />
          </Box>
        </Box>

        <Box height="medium" overflow="auto">
          <List
            data={selectedRepoFiles}
            primaryKey="name"
            onClickItem={({ item }) => setSelectedFile(item)}
          />
        </Box>

        <Box>
          {selectedFile && (
            <Box>
              {selectedFile.name.endsWith(".svg") && (
                <Image src={selectedFile.download_url} />
              )}
              {(selectedFile.name.endsWith(".json") ||
                selectedFile.name.endsWith(".svg")) && (
                <Button label="Import as Case" onClick={handleImportClick} />
              )}
            </Box>
          )}
        </Box>
      </Grid>
    </Box>
  );
};

export default GitHub;
