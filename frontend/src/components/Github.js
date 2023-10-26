import React, { useState, useEffect } from "react";
import hljs from "highlight.js";
import "highlight.js/styles/default.css";
import {
  Box,
  TextInput,
  List,
  Image,
  Button,
  Select,
  Grid,
  Text,
} from "grommet";
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
  const [inputValue, setInputValue] = useState("");
  const [currentPath, setCurrentPath] = useState("/");
  const [selectedRepoFullName, setSelectedRepoFullName] = useState("");
  const [lastModified, setLastModified] = useState(null);
  const [lastModifiedBy, setLastModifiedBy] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("main");

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

      fetchSpecificRepo();

      setLoading(false);
    };

    fetchInitialData();
  }, []);

  const handleFileOrFolderClick = (item) => {
    if (item.type === "dir") {
      const newPath =
        currentPath === "/" ? `/${item.name}` : `${currentPath}/${item.name}`;
      setCurrentPath(newPath);
      fetchRepoContentsByPath(newPath);
    } else {
      if (item.type === "file") {
        fetchFileCommitHistory(item.path);
      }
      setSelectedFile(item);
      if (item.name.endsWith(".json")) {
        fetchFileContent(item.download_url);
      }
    }
  };

  const fetchFileCommitHistory = async (path) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      const response = await fetch(
        `https://api.github.com/repos/${selectedRepoFullName}/commits?path=${path}`,
        {
          headers: {
            Authorization: `token ${token}`,
          },
        },
      );
      const commits = await response.json();
      if (commits && commits.length > 0) {
        const lastCommit = commits[0];
        setLastModified(lastCommit.commit.committer.date);
        setLastModifiedBy(lastCommit.commit.committer.name);
      }
    }
  };

  const fetchSpecificRepo = async () => {
    try {
      const repoURL =
        "https://api.github.com/repos/alan-turing-institute/AssurancePlatform";
      const response = await fetch(repoURL);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const repo = await response.json();
      setRepositories((prevRepos) => [...prevRepos, repo]);
    } catch (error) {}
  };

  const handleAddInput = () => {
    if (isRepositoryURL(inputValue)) {
      const matches = inputValue.match(
        /https:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/,
      );
      const username = matches[1];
      const repoName = matches[2];
      fetchSingleRepo(username, repoName);
    } else {
      fetchUserRepos(inputValue);
      setSelectedOrg({ login: inputValue });
    }
    setInputValue("");
  };

  const handleOrgChange = ({ option }) => {
    setSelectedOrg(option);
    if (option) {
      fetchReposForOrg(option.login);
    }
  };

  const isRepositoryURL = (value) => {
    const regex = /https:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/;
    return regex.test(value);
  };

  const fetchSingleRepo = (username, repoName) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      fetch(`https://api.github.com/repos/${username}/${repoName}`, {
        headers: {
          Authorization: `token ${token}`,
        },
      })
        .then((response) => response.json())
        .then((repo) => {
          setRepositories((prevRepos) => [...prevRepos, repo]);
        });
    }
  };

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

  const [fileContent, setFileContent] = useState("");

  const fetchFileContent = async (url) => {
    try {
      const response = await fetch(url);
      const textContent = await response.text();
      setFileContent(textContent);
    } catch (error) {
      console.error("Error fetching file content:", error);
    }
  };

  const handleRepoClick = async (repoName) => {
    setCurrentPath("/"); // Reset the path when switching repositories
    setSelectedRepoFullName(repoName);

    try {
      await fetchRepoBranches(repoName);
      await fetchRepoContentsByPath("/", repoName); // Pass the repoName as an argument here
    } catch (error) {
      console.error("Error in handleRepoClick:", error);
    }
  };

  const fetchRepoBranches = async (repoName) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      console.error("Access token not available");
      return;
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${repoName}/branches`,
        {
          headers: {
            Authorization: `token ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch branches. HTTP Status: ${response.status}`,
        );
      }

      const branches = await response.json();

      if (!Array.isArray(branches)) {
        throw new Error("Invalid response structure for branches.");
      }

      setBranches(branches.map((branch) => branch.name));
      setSelectedBranch("main");
    } catch (error) {
      console.error("Error fetching repo branches:", error);
    }
  };

  const fetchRepoContentsByPath = (path, repoName = selectedRepoFullName) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      fetch(`https://api.github.com/repos/${repoName}/contents${path}`, {
        headers: {
          Authorization: `token ${token}`,
        },
      })
        .then((response) => response.json())
        .then((contents) => {
          if (Array.isArray(contents)) {
            setSelectedRepoFiles(contents);
          } else if (
            contents &&
            typeof contents === "object" &&
            contents.name
          ) {
            // Checks if it's a single file object
            setSelectedRepoFiles([contents]); // Convert the single file object into an array
          } else {
            console.warn("The folder is empty or there's an error:", contents);
            setSelectedRepoFiles([]); // set to an empty array
          }
        })
        .catch((error) => {
          console.error("Error fetching repo contents by path:", error);
        });
    }
  };

  const handleGoUp = () => {
    const pathSegments = currentPath
      .split("/")
      .filter((segment) => segment.trim() !== "");
    pathSegments.pop();
    const newPath =
      pathSegments.length === 0 ? "/" : `/${pathSegments.join("/")}`;
    setCurrentPath(newPath);
    fetchRepoContentsByPath(newPath);
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
    <Box pad="small" flex="grow" overflow={{ vertical: "scroll" }}>
      <Grid columns={["1fr", "1fr", "1fr"]} gap="small" fill>
        <Box flex="grow" overflow={{ vertical: "scroll" }}>
          <Box direction="row" gap="small">
            <TextInput
              placeholder="GitHub Username or Repository URL"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <Button label="Add" onClick={handleAddInput} />
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
          <Box flex overflow="hidden">
            <List
              data={filteredRepos}
              primaryKey="name"
              onClickItem={({ item }) => handleRepoClick(item.full_name)}
            />
          </Box>
        </Box>

        <Box flex="grow" overflow={{ vertical: "auto" }}>
          {selectedRepoFullName && (
            <Box
              direction="row"
              align="center"
              gap="small"
              margin={{ bottom: "small" }}
            >
              {currentPath !== "/" && (
                <>
                  <Button label=".. go up" onClick={handleGoUp} />
                  <Text>{currentPath}</Text>
                </>
              )}
              <Text>Branch:</Text>
              <Select
                options={branches}
                value={selectedBranch}
                onChange={({ option }) => {
                  setSelectedBranch(option);
                  fetchRepoContentsByPath(currentPath);
                }}
                plain={true}
              />
            </Box>
          )}

          <Box flex overflow="auto">
            <List
              data={selectedRepoFiles}
              onClickItem={({ item }) => handleFileOrFolderClick(item)}
              children={(item) => (
                <Box direction="row" gap="small">
                  <Text>
                    {item.type === "dir" ? "📁" : "📄"} {item.name}
                  </Text>
                </Box>
              )}
            />
          </Box>
        </Box>

        <Box flex="grow" overflow={{ vertical: "auto" }}>
          {selectedFile && (
            <Box>
              {selectedFile.name.endsWith(".svg") && (
                <Image src={selectedFile.download_url} />
              )}
              {(selectedFile.name.endsWith(".json") ||
                selectedFile.name.endsWith(".svg")) && (
                <Button label="Import as Case" onClick={handleImportClick} />
              )}
              {selectedFile.name.endsWith(".json") && (
                <Box flex overflow="auto">
                  <pre>
                    <code
                      dangerouslySetInnerHTML={{
                        __html: hljs.highlight("json", fileContent).value,
                      }}
                    ></code>
                  </pre>
                </Box>
              )}
              {lastModified && (
                <Text>
                  Last Modified: {new Date(lastModified).toLocaleString()} by{" "}
                  {lastModifiedBy}
                </Text>
              )}
            </Box>
          )}
        </Box>
      </Grid>
    </Box>
  );
};

export default GitHub;
