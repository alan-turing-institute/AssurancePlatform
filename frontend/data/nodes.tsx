'use client'

import { Node } from "reactflow";
import { BookOpenText, Database, FolderOpenDot, Goal, Route } from "lucide-react";

export const initNodes = [
  {
    id: '1',
    type: 'goal',
    data: { name: 'G1', type: 'goal', description: 'Lorem ipsum testing description', icon: <Goal /> },
    position: { x: 0, y: 50 },
    hidden: false
  },
  {
    id: '2',
    type: 'context',
    data: { name: 'C1', type: 'context', description: 'Lorem ipsum testing description, Lorem ipsum testing description', icon: <BookOpenText /> },

    position: { x: -350, y: 50 },
    hidden: false
  },
  {
    id: '3',
    type: 'property',
    data: { name: 'P1', type: 'property', description: 'Lorem ipsum testing description', icon: <FolderOpenDot /> },
    position: { x: -200, y: 200 },
    hidden: false
  },
  {
    id: '4',
    type: 'strategy',
    data: { name: 'S1', type: 'strategy', description: 'Lorem ipsum testing description', icon: <Route /> },
    position: { x: 200, y: 200 },
    hidden: false
  },
  {
    id: '5',
    type: 'evidence',
    data: { name: 'E1', type: 'evidence', description: 'Lorem ipsum testing description', icon: <Database /> },
    position: { x: -400, y: 350 },
    hidden: false
  },
  {
    id: '6',
    type: 'evidence',
    data: { name: 'E2', type: 'evidence', description: 'Lorem ipsum testing description', icon: <Database /> },
    position: { x: 0, y: 350 },
    hidden: false
  },
] as Node[];