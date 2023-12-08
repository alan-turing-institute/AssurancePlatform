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
import { getSelfUser, getBaseURL } from "./utils.js";
import { LayoutWithNav } from "./common/Layout.jsx";

const GitHub = () => {
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
  const [selectedBranch, setSelectedBranch] = useState("");
  const [repoContentsLoading, setRepoContentsLoading] = useState(false);

  // Effect to fetch repository contents when branch or repository changes
  useEffect(() => {
    const fetchContents = async () => {
      if (selectedRepoFullName && selectedBranch) {
        setRepoContentsLoading(true);
        await fetchRepoContentsByPath(
          currentPath,
          selectedRepoFullName,
          selectedBranch
        );
        setRepoContentsLoading(false);
      }
    };

    fetchContents();
  }, [selectedBranch, selectedRepoFullName, currentPath]);

  const handleBranchChange = ({ option }) => {
    setSelectedBranch(option);
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      const userGithubHandle = await getSelfUser()["username"];
      const token = localStorage.getItem("access_token");

      if (token) {
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

  const handleImportRepo = async () => {
    const url = `${getBaseURL()}/github_repositories/`;
    const [owner, name] = selectedRepoFullName.split("/");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        name: name,
        url: `https://github.com/${selectedRepoFullName}`,
        repoFullName: selectedRepoFullName, // only if it's still required by the backend
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log("Repository imported successfully:", data);
      alert("Successfully imported!"); // This line adds the popup
    } else {
      throw new Error(
        `Failed to import repository. Status: ${response.status}`
      );
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
        }
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
        /https:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/
      );
      if (matches && matches.length >= 3) {
        const username = matches[1];
        const repoName = matches[2];
        fetchSingleRepo(username, repoName);
      }
    } else {
      console.error("Invalid GitHub repository URL");
    }
    setInputValue("");
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
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch branches. HTTP Status: ${response.status}`
        );
      }

      const branches = await response.json();

      if (!Array.isArray(branches)) {
        throw new Error("Invalid response structure for branches.");
      }

      setBranches(branches.map((branch) => branch.name));

      // Set the selectedBranch to default if none has been selected
      if (branches.length > 0) {
        const defaultBranch =
          branches.find((branch) => branch.name === "main") || branches[0];
        setSelectedBranch(defaultBranch.name);
      } else {
        console.error("No branches found for this repository.");
      }
    } catch (error) {
      console.error("Error fetching repo branches:", error);
    }
  };

  const fetchRepoContentsByPath = async (
    path,
    repoName = selectedRepoFullName,
    branch = selectedBranch
  ) => {
    const token = localStorage.getItem("access_token");
    const branchQuery = branch ? `?ref=${branch}` : ""; // Handle the case where no branch is selected
    if (token) {
      setRepoContentsLoading(true); // Start loading
      try {
        const response = await fetch(
          `https://api.github.com/repos/${repoName}/contents${path}${branchQuery}`,
          {
            headers: {
              Authorization: `token ${token}`,
            },
          }
        );
        const contents = await response.json();
        if (Array.isArray(contents)) {
          setSelectedRepoFiles(contents);
        } else if (contents && typeof contents === "object" && contents.name) {
          setSelectedRepoFiles([contents]); // Convert the single file object into an array
        } else {
          console.warn("The folder is empty or there's an error:", contents);
          setSelectedRepoFiles([]); // Set to an empty array
        }
      } catch (error) {
        console.error("Error fetching repo contents by path:", error);
      } finally {
        setRepoContentsLoading(false); // End loading
      }
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
    repo.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <LayoutWithNav>
      <Box pad="small" flex="grow" overflow={{ vertical: "scroll" }}>
        <Grid columns={["1fr", "1fr", "1fr"]} gap="small" fill>
          <Box flex="grow" overflow={{ vertical: "scroll" }}>
            <Box direction="row" gap="small">
              <TextInput
                placeholder="GitHub Repository URL"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <Button label="Add" onClick={handleAddInput} />
            </Box>
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
                  onChange={handleBranchChange}
                  plain={true}
                />
                <Button label="Import Repo" onClick={handleImportRepo} />
              </Box>
            )}

            {repoContentsLoading ? (
              <Box
                pad="medium"
                fill="horizontal"
                align="center"
                justify="center"
              >
                Loading ...
              </Box>
            ) : (
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
            )}
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
    </LayoutWithNav>
  );
};

export default GitHub;
