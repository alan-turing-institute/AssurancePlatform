import { Card } from "@mui/material";

export const ThemedCard = ({ sx, ...props } : any) => {
  return (
    <Card
      elevation={0}
      sx={{
        ...sx,
        height: "29.0625rem",
        width: "22.0625rem",
        borderRadius: "0.5rem",
      }}
      {...props}
    />
  );
};