import React, { useState, useEffect } from "react";
import { Menu, Avatar, Box } from "grommet";
import { User } from "grommet-icons";
import { useNavigate } from "react-router-dom";
import { getSelfUser } from "./utils.js"; // Your utility to get user info

const UserProfileDropdown = () => {
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkLoginStatus = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        const user = await getSelfUser(token);
        setUsername(user.username);
      }
    };

    checkLoginStatus();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token"); // Or your logout logic
    navigate("/login");
  };

  const userMenuItems = [
    { label: "Groups", onClick: () => navigate("/groups") },
    { label: "GitHub Files", onClick: () => navigate("/Github") },
    { label: "Logout", onClick: handleLogout },
  ];

  // Only show the user menu if we have a username (indicating the user is logged in)
  if (!username) return null;

  return (
    <Box className="dropdown">
      <Menu
        dropAlign={{ top: "bottom", right: "right" }}
        label={<span style={{ color: "white" }}>{username}</span>}
        icon={
          <Avatar background="accent-4">
            <User />
          </Avatar>
        }
        items={userMenuItems}
      />
    </Box>
  );
};

export default UserProfileDropdown;
