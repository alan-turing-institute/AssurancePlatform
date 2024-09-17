import React, {
  useState,
  useRef,
  useEffect,
  Dispatch,
  SetStateAction,
} from "react";
import { Button } from "./ui/button";
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  Copy,
  MessageSquareMore,
  Search,
  SearchIcon,
  X,
} from "lucide-react";
import { ModeToggle } from "./ui/theme-toggle";
import { useRouter } from "next/navigation";
import { useLoginToken } from "@/hooks/useAuth";
import useStore from "@/data/store";
import { CaseNavigation } from "./cases/CaseNavigation";
import Link from "next/link";
import {
  useReactFlow,
  useUpdateNodeInternals,
  getNodesBounds,
} from "reactflow";
import SearchNodes from "./common/SearchNodes";

import { toggleHiddenForParent } from "@/lib/case-helper";
import LogoutButton from "./auth/LogoutButton";
import ActiveUsersList from "./cases/ActiveUsersList";

interface HeaderProps {
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const Header = ({ setOpen }: HeaderProps) => {
  const { nodes, assuranceCase, setAssuranceCase } = useStore();
  const router = useRouter();
  const updateNodeInternals = useUpdateNodeInternals();

  const [editName, setEditName] = useState<boolean>(false);
  const [newCaseName, setNewCaseName] = useState<string>(assuranceCase.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const { fitView, setViewport, setCenter } = useReactFlow();

  const [token] = useLoginToken();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewCaseName(e.target.value);
  };

  const handleEditClick = () => {
    setEditName(!editName);
  };

  const updateAssuranceCaseName = async () => {
    try {
      const newData = {
        name: newCaseName,
      };
      const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${assuranceCase.id}/`;
      const requestOptions: RequestInit = {
        method: "PUT",
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newData),
      };

      const response = await fetch(url, requestOptions);
      if (!response.ok) {
        console.log("Render a new error");
      }
      setEditName(false);
      setAssuranceCase({ ...assuranceCase, name: newCaseName });
    } catch (error) {
      console.log(error);
    }
  };

  const unhideParents = (nodeId: string) => {
    const currentNode = nodes.find((node) => node.id == nodeId);

    const updatedAssuranceCase = toggleHiddenForParent(
      currentNode,
      assuranceCase
    );

    setAssuranceCase(updatedAssuranceCase);
  };

  const focusNode = (value: string) => {
    console.log("Focus Node");
    let nodeId: any = nodes.filter((n) => n.id === value)[0].id;

    unhideParents(nodeId);

    // nodes.map(n => {
    //   (n.data.name === 'P2') ? nodeId = n.id : null
    // })

    if (nodeId) {
      // const { nodes } = useStore();
      const node = nodes.find((n) => n.id === nodeId);

      if (node) {
        const zoomLevel = 1.5; // Adjust the zoom level as needed

        // Assuming node dimensions (update these with actual dimensions if available)
        const nodeWidth = node.width || 0;
        const nodeHeight = node.height || 0;

        // Calculate center position
        const centerX = node.position.x + nodeWidth / 2;
        const centerY = node.position.y + nodeHeight / 2;

        setCenter(centerX, centerY);
      } else {
        console.error("Node is null");
      }
    } else {
      console.error("Node ID is undefined");
    }
  };

  return (
    <div className="fixed top-0 left-0 bg-indigo-600 dark:bg-slate-900 text-white w-full z-50">
      <div className="container py-3 flex justify-between items-center">
        <div className="flex justify-start items-center gap-2">
          <Button
            variant={"ghost"}
            size={"icon"}
            onClick={() => router.back()}
            className="hover:bg-indigo-900/20 hover:dark:bg-gray-100/10 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          {/* {editName ? (
            <div className='flex justify-start items-center gap-4'>
              <input
                ref={inputRef}
                type='text'
                name='newCaseName'
                value={newCaseName}
                onChange={handleInputChange}
                className={`bg-transparent rounded-md border border-indigo-500 focus:border-indigo-500 outline-none px-4 py-2`}
              />
              <div className='flex justify-start items-center'>
                <Button variant={'ghost'} size={'icon'} onClick={updateAssuranceCaseName}><Check className='w-4 h-4 text-emerald-500'/></Button>
                <Button variant={'ghost'} size={'icon'} onClick={handleEditClick}><X className='w-4 h-4'/></Button>
              </div>
            </div>
          ) : (
            <p className='font-semibold' onClick={handleEditClick}>
              {assuranceCase.name}
            </p>
          )} */}
          <p
            onClick={() => setOpen(true)}
            className="font-semibold hover:cursor-pointer"
          >
            {assuranceCase.name}
          </p>
        </div>

        <div className="flex justify-start items-center gap-4">
          <SearchNodes nodes={nodes} focusNode={focusNode} />
          <CaseNavigation />
          {/* <Link
            href={
              "https://alan-turing-institute.github.io/AssurancePlatform/community/community-support/"
            }
            target="_blank"
            className="flex justify-center items-center gap-2 bg-indigo-600 text-white py-2 px-3 rounded-md"
          >
            <MessageSquareMore className="w-4 h-4" />
            <span className="font-medium text-sm">Feedback</span>
          </Link> */}
          <ActiveUsersList />
          <ModeToggle className="bg-indigo-500 dark:bg-slate-900 hover:bg-indigo-900/20 hover:dark:bg-gray-100/10 hover:text-white border-none" />
          <LogoutButton />
        </div>
      </div>
    </div>
  );
};

export default Header;
