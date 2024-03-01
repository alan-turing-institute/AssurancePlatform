'use client'

import { CardActionArea, Typography, useTheme } from '@mui/material';
import React from 'react'
import { ThemedCard } from '../common/ThemeCard';
import { PlusIcon } from 'lucide-react';

const CreateCard = () => {
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
        // onClick={onCreateClick}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: "2rem",
        }}
      >
        <PlusIcon style={{ fontSize: '26px' }} />
        <Typography variant="h3" component="h2">
          Create a new case
        </Typography>
      </CardActionArea>
    </ThemedCard>
  );
}

export default CreateCard
