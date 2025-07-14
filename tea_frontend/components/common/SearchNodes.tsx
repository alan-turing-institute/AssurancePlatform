'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '../ui/button';
import { Search } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import ActionTooltip from '../ui/action-tooltip';

type SearchNodesProps = {
  nodes: any[];
  focusNode: (value: string) => void;
};
const SearchNodes = ({ nodes, focusNode }: SearchNodesProps) => {
  const [value, setValue] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filteredNodes, setFilteredNodes] = useState(nodes);

  const handleSearch = (searchValue: string) => {
    console.log(searchValue);
    setValue(searchValue);

    if (searchValue !== '') {
      const result = nodes.filter((node) =>
        node.data.short_description.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredNodes(result);
    }
  };

  const handleSearchClose = () => {
    setValue('');
    setSearchOpen(false);
    setFilteredNodes(nodes);
  };

  const handleSelection = (nodeId: string) => {
    focusNode(nodeId);
    setSearchOpen(false);
  };

  useEffect(() => {
    setFilteredNodes(nodes);
  }, [nodes]);

  return (
    <>
      <ActionTooltip label="Search">
        <Button
          size={'sm'}
          variant={'ghost'}
          onClick={() => setSearchOpen(true)}
        >
          <Search className="w-4 h-4" />
          <span className="sr-only">Search</span>
        </Button>
      </ActionTooltip>
      <Dialog open={searchOpen} onOpenChange={handleSearchClose}>
        <DialogContent className="sm:max-w-md md:max-w-xl lg:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Search Nodes</DialogTitle>
            <DialogDescription>
              Enter your keywords into the input below to find a node.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="link" className="sr-only">
                Link
              </Label>
              <Input
                id="searchValue"
                defaultValue=""
                value={value}
                onChange={(e: any) => handleSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {filteredNodes.map((node) => (
              <div key={node.id}>
                <div
                  className="group flex flex-col justify-start items-start gap-1 p-2 my-2 rounded-md hover:bg-indigo-500 hover:text-white hover:cursor-pointer"
                  onClick={() => handleSelection(node.id)}
                >
                  <div className="flex flex-col items-start">
                    <span className="text-xs uppercase text-muted-foreground mb-2 font-medium group-hover:text-white">
                      Identifier: {node.data.name}
                    </span>
                    {/* <svg viewBox="0 0 2 2" className="mx-2 inline h-0.5 w-0.5 fill-current" aria-hidden="true">
                    <circle cx={1} cy={1} r={1} />
                  </svg> */}
                    <span className="w-full line-clamp-2 text-sm">
                      {node.data.short_description}
                    </span>
                  </div>
                </div>
                <Separator />
              </div>
            ))}
          </div>
          {/* <DialogFooter className="sm:justify-start">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </DialogClose>
          </DialogFooter> */}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SearchNodes;
