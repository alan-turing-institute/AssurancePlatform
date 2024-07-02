import React, { useState } from 'react';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

type Node = {
  id: string;
  data: {
    name: string;
    short_description: string;
  };
};

type SearchDropdownProps = {
  nodes: Node[];
  onSelectNode: (nodeId: string) => void;
};

const SearchDropdown: React.FC<SearchDropdownProps> = ({ nodes, onSelectNode }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredNodes, setFilteredNodes] = useState<Node[]>(nodes);

  const handleChange = (value: string) => {
    setSearchQuery(value);

    const filtered = nodes.filter(node =>
      node.data.short_description.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredNodes(filtered);
  };

  const handleSelectNode = (nodeId: string) => {
    onSelectNode(nodeId);
    setSearchQuery('');
  };

  return (
    <Popover>
      <PopoverTrigger>
        <Input
          type="text"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => handleChange(e.target.value)}
        />
      </PopoverTrigger>
      <PopoverContent>
        {filteredNodes.length === 0 && <p>No nodes found.</p>}
        {filteredNodes.map((node) => (
          <div
            key={node.id}
            className="popover-item"
            onClick={() => handleSelectNode(node.id)}
          >
            {node.data.name}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
};

export default SearchDropdown;
