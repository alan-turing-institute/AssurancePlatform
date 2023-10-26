import React, { useState, useEffect } from "react";
import { Box, TextInput, List, Button, Image, Text } from "grommet";
import { Search, Document, Image as ImageIcon } from "grommet-icons";

const GitHub = () => {
  const [repositories, setRepositories] = useState([]);
  const [selectedRepoFiles, setSelectedRepoFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);

  useEffect(() => {
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
          setSelectedFile(null);
          setFileContent(null);
        })
        .catch((error) => {
          console.error("Error fetching repo files:", error);
        });
    }
  };

  const handleFileClick = (file) => {
    setSelectedFile(file);
    if (
      file.type === "file" &&
      (file.name.endsWith(".json") || file.name.endsWith(".svg"))
    ) {
      fetch(file.download_url)
        .then((response) => response.text())
        .then((content) => {
          setFileContent(content);
        })
        .catch((error) => {
          console.error("Error fetching file content:", error);
        });
    }
  };

  if (loading) {
    return (
      <Box align="center" justify="center" fill>
        <Text>Loading repositories...</Text>
      </Box>
    );
  }

  const filteredRepos = repositories.filter((repo) =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Box pad="medium" gap="medium" direction="row" fill>
      <Box gap="small" basis="1/3">
        <Box
          direction="row"
          align="center"
          gap="small"
          margin={{ bottom: "medium" }}
        >
          <Search />
          <TextInput
            placeholder="Search Repositories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </Box>
        <Box overflow="auto" flex>
          <List
            data={filteredRepos}
            primaryKey="name"
            onClickItem={({ item }) => handleRepoClick(item.full_name)}
          />
        </Box>
      </Box>
      <Box gap="small" basis="1/3">
        <Text weight="bold">Files in selected repository:</Text>
        <Box overflow="auto" flex>
          <List
            data={selectedRepoFiles}
            primaryKey="name"
            onClickItem={({ item }) => handleFileClick(item)}
          />
        </Box>
      </Box>
      <Box gap="small" basis="1/3">
        {selectedFile && selectedFile.name.endsWith(".json") && (
          <Button label="Import as Case" />
        )}
        {selectedFile && selectedFile.name.endsWith(".svg") && (
          <>
            <Button label="Import as Case" />
            <Image src={selectedFile.download_url} />
          </>
        )}
        {selectedFile &&
          !(
            selectedFile.name.endsWith(".svg") ||
            selectedFile.name.endsWith(".json")
          ) && (
            <Text>
              <Document size="large" /> Select a JSON or SVG file to preview.
            </Text>
          )}
      </Box>
    </Box>
  );
};

export default GitHub;
