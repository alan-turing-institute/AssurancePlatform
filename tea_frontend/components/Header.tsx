import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  Copy,
  MessageSquareMore,
  Search,
  SearchIcon,
  X,
} from 'lucide-react';
import moment from 'moment';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type React from 'react';
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  getNodesBounds,
  useReactFlow,
  useUpdateNodeInternals,
} from 'reactflow';
// import { useLoginToken } from "@/hooks/useAuth";
import useStore from '@/data/store';
import { toggleHiddenForParent } from '@/lib/case-helper';
import LogoutButton from './auth/LogoutButton';
import ActiveUsersList from './cases/ActiveUsersList';
import { ResourcesInfo } from './cases/ResourcesInfo';
import SearchNodes from './common/SearchNodes';
import { Button } from './ui/button';
import { ModeToggle } from './ui/theme-toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

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

  // const [token] = useLoginToken();
  const { data: session } = useSession();

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
        method: 'PUT',
        headers: {
          Authorization: `Token ${session?.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newData),
      };

      const response = await fetch(url, requestOptions);
      if (!response.ok) {
        console.log('Render a new error');
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
    console.log('Focus Node');
    const nodeId: any = nodes.filter((n) => n.id === value)[0].id;

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
        console.error('Node is null');
      }
    } else {
      console.error('Node ID is undefined');
    }
  };

  useEffect(() => {
    console.log('header re-rendered', assuranceCase.published);
  }, [assuranceCase]);

  return (
    <div className="fixed top-0 left-0 z-50 w-full bg-indigo-600 text-white dark:bg-slate-900">
      <div className="container flex items-center justify-between py-3">
        <div className="flex items-center justify-start gap-2">
          <Button
            className="hover:bg-indigo-900/20 hover:text-white hover:dark:bg-gray-100/10"
            onClick={() => router.back()}
            size={'icon'}
            variant={'ghost'}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <p
            className="font-semibold hover:cursor-pointer"
            onClick={() => setOpen(true)}
          >
            {assuranceCase.name}
          </p>
        </div>

        <div className="flex items-center justify-start gap-2">
          {/* <ResourcesInfo /> */}
          <ActiveUsersList />
          <SearchNodes focusNode={focusNode} nodes={nodes} />
          <LogoutButton />
          <ModeToggle className="border-none bg-indigo-500 hover:bg-indigo-900/20 hover:text-white dark:bg-slate-900 hover:dark:bg-gray-100/10" />
          <TooltipProvider>
            {assuranceCase.published ? (
              <Tooltip>
                <TooltipTrigger>
                  <span className="inline-flex items-center rounded-md bg-green-500/10 px-3 py-2 font-medium text-green-400 text-xs ring-1 ring-green-500/20 ring-inset">
                    Published
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    Published on:{' '}
                    {moment(assuranceCase.published_date).format(
                      'DD/MM/YYYY HH:mm:ss'
                    )}
                  </p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger>
                  <span className="inline-flex items-center rounded-md bg-gray-500/10 px-3 py-2 font-medium text-gray-400 text-xs ring-1 ring-gray-500/20 ring-inset">
                    Unpublished
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    You can publish using the <strong>Share</strong>
                    <br /> action from toolbar
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

export default Header;
