'use client';

import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import {
  Camera,
  ExternalLink,
  Group,
  Info,
  Notebook,
  Plus,
  RotateCw,
  Trash2,
  Users2,
} from 'lucide-react';
import { neatJSON } from 'neatjson';
// import { useLoginToken } from "@/hooks/useAuth";
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import NodeCreate from '@/components/common/NodeCreate';
import useStore from '@/data/store';
import { AlertModal } from '../modals/alertModal';
import ActionTooltip from '../ui/action-tooltip';
import CaseNotes from './case-notes';
import 'react-toastify/dist/ReactToastify.css';
import { useSession } from 'next-auth/react';
import { usePermissionsModal } from '@/hooks/usePermissionsModal';
import { useResourcesModal } from '@/hooks/useResourcesModal';
import { useShareModal } from '@/hooks/useShareModal';

interface ActionButtonProps {
  showCreateGoal: boolean;
  actions: any;
  notify: (message: string) => void;
  notifyError: (message: string) => void;
}

const ActionButtons = ({
  showCreateGoal,
  actions,
  notify,
  notifyError,
}: ActionButtonProps) => {
  const [open, setOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // const [token] = useLoginToken();
  const { data: session } = useSession();
  const { assuranceCase, setAssuranceCase } = useStore();
  const router = useRouter();

  const { onLayout } = actions;

  const shareModal = useShareModal();
  const permissionModal = usePermissionsModal();
  const resourcesModal = useResourcesModal();

  const onDelete = async () => {
    try {
      setLoading(true);
      const requestOptions: RequestInit = {
        headers: {
          Authorization: `Token ${session?.key}`,
        },
        method: 'DELETE',
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${assuranceCase.id}/`,
        requestOptions
      );
      if (response.ok) {
        router.push('/dashboard');
      }
    } catch (_error: any) {
    } finally {
      setLoading(false);
      setDeleteOpen(false);
    }
  };

  const _handleExport = () => {
    setLoading(true);

    let json = neatJSON(assuranceCase, {});
    // Remove the `id` fields, since they are only meaningful to the backend, and might
    // confuse it when importing the JSON exported here.
    json = json.replaceAll(/"id":\d+(,)?/g, '');

    const name = assuranceCase.name;

    // Write to a file, which to the user shows as a download.
    const blob = new Blob([json], {
      type: 'text/plain;charset=utf-8',
    });

    const now = new Date();
    // Using a custom date format because the ones that Date offers are either very long
    // or include characters not allowed in filenames on Windows.
    const datestr =
      now.getFullYear() +
      '-' +
      now.getMonth() +
      '-' +
      now.getDate() +
      'T' +
      now.getHours() +
      '-' +
      now.getMinutes() +
      '-' +
      now.getSeconds();
    const filename = `${name}-${datestr}.json`;
    saveAs(blob, filename);
    setLoading(false);
  };

  const handleCapture = async () => {
    const token = session?.key ?? '';
    const screenshotTarget = document.getElementById('ReactFlow');
    if (screenshotTarget) {
      const canvas = await html2canvas(screenshotTarget);

      const base64image = canvas.toDataURL('image/png');

      const myHeaders = new Headers();
      myHeaders.append('Content-Type', 'application/json');

      const newImage = JSON.stringify({
        id: assuranceCase.id,
        base64image,
        token,
      });

      const requestOptions: RequestInit = {
        method: 'POST',
        headers: myHeaders,
        body: newImage,
        redirect: 'follow',
      };

      const response = await fetch('/api/screenshot', requestOptions);
      const { error, message, data } = await response.json();

      if (error) {
        notifyError(message);
      }

      notify('Screenshot Saved!');
    }
  };

  const handleNameReset = async () => {
    try {
      setLoading(true);
      const requestOptions: RequestInit = {
        headers: {
          Authorization: `Token ${session?.key}`,
        },
        method: 'POST',
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${assuranceCase.id}/update-ids`,
        requestOptions
      );
      if (response.ok) {
        window.location.reload();
      }
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="-translate-x-1/2 fixed bottom-4 left-1/2 z-40 flex transform items-center justify-center">
      <div className="m-auto flex w-1/8 items-center justify-center gap-2 rounded-full bg-indigo-100 px-4 py-2 text-white shadow-lg dark:bg-indigo-500/20">
        <div className="flex items-center justify-center gap-2 border-r-2 border-r-indigo-200 pr-2 dark:border-r-indigo-800/60">
          {showCreateGoal &&
            (assuranceCase.permissions !== 'view' ||
              assuranceCase.permissions !== 'review') && (
              <ActionTooltip label="New Goal">
                <button
                  className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
                  onClick={() => setOpen(true)}
                >
                  <Plus className="h-5 w-5" />
                  <span className="sr-only">Add Goal</span>
                </button>
              </ActionTooltip>
            )}
          <ActionTooltip label="Focus">
            <button
              className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
              id="FocusBtn"
              onClick={() => onLayout('TB')}
            >
              <Group className="h-5 w-5" />
              <span className="sr-only">Focus</span>
            </button>
          </ActionTooltip>
          {assuranceCase.permissions !== 'view' &&
            assuranceCase.permissions !== 'review' && (
              <ActionTooltip label="Reset Identifiers">
                <button
                  className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
                  onClick={() => setAlertOpen(true)}
                >
                  <RotateCw className="h-5 w-5" />
                  <span className="sr-only">Reset Identifiers</span>
                </button>
              </ActionTooltip>
            )}
          <ActionTooltip label="Resources">
            <button
              className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
              onClick={() => resourcesModal.onOpen()}
            >
              <Info className="h-5 w-5" />
              <span className="sr-only">Resources</span>
            </button>
          </ActionTooltip>
        </div>
        <div className="flex items-center justify-center gap-2">
          {assuranceCase.permissions !== 'view' && (
            <ActionTooltip label="Share & Export">
              <button
                className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
                onClick={() => shareModal.onOpen()}
              >
                <ExternalLink className="h-5 w-5" />
                <span className="sr-only">Share & Export</span>
              </button>
            </ActionTooltip>
          )}
          {assuranceCase.permissions === 'manage' && (
            <ActionTooltip label="Permissions">
              <button
                className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
                onClick={() => permissionModal.onOpen()}
              >
                <Users2 className="h-5 w-5" />
                <span className="sr-only">Permissions</span>
              </button>
            </ActionTooltip>
          )}
          <ActionTooltip label="Notes">
            <button
              className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
              onClick={() => setNotesOpen(true)}
            >
              <Notebook className="h-5 w-5" />
              <span className="sr-only">Notes</span>
            </button>
          </ActionTooltip>
          {(assuranceCase.permissions === 'manage' ||
            assuranceCase.permissions === 'editor') && (
            <ActionTooltip label="Capture">
              <button
                className="h-50 w-50 rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800"
                onClick={handleCapture}
              >
                <Camera className="h-5 w-5" />
                <span className="sr-only">Capture</span>
              </button>
            </ActionTooltip>
          )}
          {assuranceCase.permissions === 'manage' && (
            <ActionTooltip label="Delete">
              <button
                className="h-50 w-50 rounded-full bg-rose-500 p-3 transition-all hover:bg-rose-600"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-5 w-5" />
                <span className="sr-only">Delete</span>
              </button>
            </ActionTooltip>
          )}
        </div>
        <NodeCreate isOpen={open} setOpen={setOpen} />
        <CaseNotes isOpen={notesOpen} onClose={() => setNotesOpen(false)} />
        <AlertModal
          confirmButtonText={'Delete'}
          isOpen={deleteOpen}
          loading={loading}
          onClose={() => setDeleteOpen(false)}
          onConfirm={onDelete}
        />
        <AlertModal
          cancelButtonText={'No, keep current identifiers'}
          confirmButtonText={'Yes, reset all identifiers'}
          isOpen={alertOpen}
          loading={loading}
          message={
            'Updating the identifiers will systematically reset all of the unique labels that are displayed for each of the elements (e.g. P1, E1), so that they are continuous. This cannot be undone.'
          }
          onClose={() => setAlertOpen(false)}
          onConfirm={handleNameReset}
        />
      </div>
    </div>
  );
};

export default ActionButtons;
