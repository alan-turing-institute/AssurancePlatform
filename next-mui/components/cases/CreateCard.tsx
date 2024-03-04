'use client'

import { CardActionArea, Typography, useTheme } from '@mui/material';
import React from 'react'
import { ThemedCard } from '../common/ThemeCard';
import { PlusIcon } from 'lucide-react';
import AddSvg from "../../images/add-1--expand-cross-buttons-button-more-remove-plus-add-+-mathematics-math.svg";

interface CreateCardProps {
  onCreateClick: () => void
}

const CreateCard = ({ onCreateClick } : CreateCardProps) => {
  const theme = useTheme();

  return (
    <ThemedCard
      sx={{
        border: "none",
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
      }}
    >
      <CardActionArea
        onClick={onCreateClick}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: "2rem",
        }}
      >
        <PlusIcon size={48} />
        <Typography variant="h3" component="h2">
          Create a new case
        </Typography>
      </CardActionArea>
    </ThemedCard>
  );
}

export default CreateCard
