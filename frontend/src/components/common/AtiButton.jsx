import * as React from "react";
import Button from "@mui/material/Button";
import { Link } from "react-router-dom";

function AtiButton({ sx, ...props }) {
  return <Button variant="contained" sx={{ textTransform: "none", ...sx}} {...props} />;
}

export function NavButton({...props}) {
  return <AtiButton component={Link} {...props}/>
}

export default AtiButton;
