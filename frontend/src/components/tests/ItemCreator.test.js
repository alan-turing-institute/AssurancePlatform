import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom'
import React from 'react';
import { Link } from 'react-router-dom';
import ItemCreator from '../ItemCreator.js';

test('renders item creator layer', () => {
  render(<ItemCreator type="TopLevelNormativeGoal"/>);
  const textElement = screen.getByText(/TopLevelNormativeGoal/i);
  expect(textElement).toBeInTheDocument();
});
