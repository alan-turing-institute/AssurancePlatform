'use client';

import {
  BookOpenText,
  Eye,
  EyeOff,
  LibraryIcon,
  MessageCirclePlus,
  Move,
  Plus,
  PlusCircle,
  Trash2,
  Unplug,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import useStore from '@/data/store';
import {
  caseItemDescription,
  deleteAssuranceCaseNode,
  detachCaseElement,
  extractGoalsClaimsStrategies,
  findParentNode,
  findSiblingHiddenState,
  removeAssuranceCaseNode,
  updateAssuranceCase,
  updateAssuranceCaseNode,
} from '@/lib/case-helper';
import NodeAttributes from '../cases/node-attributes';
import NodeComment from '../cases/node-comments';
import NodeContext from '../cases/node-context';
import OrphanElements from '../cases/orphan-elements';
import { AlertModal } from '../modals/alert-modal';
import EditSheet from '../ui/edit-sheet';
import { Separator } from '../ui/separator';
import EditForm from './edit-form';
// import { useLoginToken } from ".*/use-auth";
import NewLinkForm from './new-link-form';

interface NodeEditProps {
  node: Node | any;
  isOpen: boolean;
  setEditOpen: Dispatch<SetStateAction<boolean>>;
}

const NodeEdit = ({ node, isOpen, setEditOpen }: NodeEditProps) => {
  const [isMounted, setIsMounted] = useState(false);
  const { assuranceCase, setAssuranceCase, nodes, orphanedElements } =
    useStore();
  const [selectedLink, setSelectedLink] = useState(false);
  const [linkToCreate, setLinkToCreate] = useState('');
  const [unresolvedChanges, setUnresolvedChanges] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toggleParentDescription, setToggleParentDescription] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  // const [parentNode, setParentNode] = useState(nodes.filter(n => n.data.id === node.data.goal_id)[0])

  const [selectedClaimMove, setSelectedClaimMove] = useState<any>(null); // State for selected strategy
  const [selectedEvidenceMove, setSelectedEvidenceMove] = useState<any>(null); // State for selected strategy
  const [_moveElementType, _setMoveElementType] = useState<string | null>(null); // State for selected strategy

  // const [token] = useLoginToken();
  const { data: session } = useSession();

  let goal: any;
  let strategies: any[] = [];
  let claims: any[] = [];

  const readOnly = !!(
    assuranceCase.permissions === 'view' ||
    assuranceCase.permissions === 'review'
  );

  if (assuranceCase.goals && assuranceCase.goals.length > 0) {
    goal = assuranceCase.goals[0];
    strategies = assuranceCase.goals[0].strategies;
    const lookups = extractGoalsClaimsStrategies(assuranceCase.goals);
    claims = lookups.claims;
  }

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  if (!node) {
    return null;
  }

  const selectLink = (type: string) => {
    setSelectedLink(true);
    setLinkToCreate(type);
  };

  /** Function used to handle deletion of the current selected item */
  const handleDelete = async () => {
    setLoading(true);
    const deleted = await deleteAssuranceCaseNode(
      node.type,
      node.data.id,
      session?.key ?? ''
    );

    if (deleted) {
      const updatedAssuranceCase = await removeAssuranceCaseNode(
        assuranceCase,
        node.data.id,
        node.data.type
      );
      if (updatedAssuranceCase) {
        setAssuranceCase(updatedAssuranceCase);
        setLoading(false);
        setDeleteOpen(false);
        handleClose();
        return;
      }
    }
  };

  const handleClose = () => {
    setAction(null);
    setEditOpen(false);
    setAlertOpen(false);
    setSelectedLink(false);
    setToggleParentDescription(true);
    setUnresolvedChanges(false);
  };

  const onChange = (_open: boolean) => {
    if (unresolvedChanges) {
      setAlertOpen(true);
    } else {
      handleClose();
    }
  };

  const handleMove = async () => {
    setLoading(true);
    if (selectedClaimMove) {
      const _updatedItem = null;

      // Find id for selected move element
      const type = selectedClaimMove.name.substring(0, 1);
      if (type === 'G') {
        const updateItem = {
          goal_id: goal ? goal.id : null,
          strategy_id: null,
          property_claim_id: null,
          hidden: false,
        } as any;

        const updated = await updateAssuranceCaseNode(
          'property',
          node.data.id,
          session?.key ?? '',
          updateItem
        );
        // if (updated) {
        //   window.location.reload()
        // }
        if (updated) {
          updateItem.hidden = findSiblingHiddenState(
            assuranceCase,
            selectedClaimMove.id
          );
          const updatedAssuranceCase = await updateAssuranceCase(
            'property',
            assuranceCase,
            updateItem,
            node.data.id,
            node,
            true
          );
          if (updatedAssuranceCase) {
            setAssuranceCase(updatedAssuranceCase);
            setLoading(false);
            // window.location.reload()
            handleClose();
          }
        }
      }
      if (type === 'P') {
        const elementId = claims?.filter(
          (claim: any) => claim.id === selectedClaimMove.id
        )[0].id;

        const updateItem = {
          goal_id: null,
          strategy_id: null,
          property_claim_id: elementId,
          hidden: false,
        } as any;

        const updated = await updateAssuranceCaseNode(
          'property',
          node.data.id,
          session?.key ?? '',
          updateItem
        );
        // if (updated) {
        //   window.location.reload()
        // }
        if (updated) {
          updateItem.hidden = findSiblingHiddenState(
            assuranceCase,
            selectedClaimMove.id
          );
          const updatedAssuranceCase = await updateAssuranceCase(
            'property',
            assuranceCase,
            updateItem,
            node.data.id,
            node,
            true
          );
          if (updatedAssuranceCase) {
            setAssuranceCase(updatedAssuranceCase);
            setLoading(false);
            // window.location.reload()
            handleClose();
          }
        }
      }
      if (type === 'S') {
        const elementId = strategies?.filter(
          (strategy: any) => strategy.id === selectedClaimMove.id
        )[0].id;

        const updateItem = {
          goal_id: null,
          strategy_id: elementId,
          property_claim_id: null,
          hidden: false,
        } as any;

        const updated = await updateAssuranceCaseNode(
          'property',
          node.data.id,
          session?.key ?? '',
          updateItem
        );
        // if (updated) {
        //   window.location.reload()
        // }
        if (updated) {
          updateItem.hidden = findSiblingHiddenState(
            assuranceCase,
            selectedClaimMove.id
          );
          const updatedAssuranceCase = await updateAssuranceCase(
            'property',
            assuranceCase,
            updateItem,
            node.data.id,
            node,
            true
          );
          if (updatedAssuranceCase) {
            setAssuranceCase(updatedAssuranceCase);
            setLoading(false);
            // window.location.reload()
            handleClose();
          }
        }
      }
    }
    if (selectedEvidenceMove) {
      const updateItem = {
        property_claim_id: [selectedEvidenceMove.id],
        hidden: false,
      } as any;
      const updated = await updateAssuranceCaseNode(
        'evidence',
        node.data.id,
        session?.key ?? '',
        updateItem
      );
      // if (updated) {
      //   window.location.reload()
      // }
      if (updated) {
        updateItem.hidden = findSiblingHiddenState(
          assuranceCase,
          selectedEvidenceMove.id
        );
        const updatedAssuranceCase = await updateAssuranceCase(
          'evidence',
          assuranceCase,
          updateItem,
          node.data.id,
          node,
          true
        );
        if (updatedAssuranceCase) {
          setAssuranceCase(updatedAssuranceCase);
          setLoading(false);
          // window.location.reload()
          handleClose();
        }
      }
    }
  };

  const parentNode: any = findParentNode(nodes, node);

  const handleDetach = async () => {
    const { detached, error }: any = await detachCaseElement(
      node,
      node.type,
      node.data.id,
      session?.key ?? ''
    );
    if (error) {
    }

    if (detached) {
      const updatedAssuranceCase = await removeAssuranceCaseNode(
        assuranceCase,
        node.data.id,
        node.data.type
      );
      if (updatedAssuranceCase) {
        setAssuranceCase(updatedAssuranceCase);
        setLoading(false);
        setDeleteOpen(false);
        handleClose();
      }
    }
  };

  return (
    <EditSheet
      description={`${readOnly ? `You are viewing a ${caseItemDescription(node.type)}.` : `Use this form to update your ${caseItemDescription(node.type)}.`}`}
      isOpen={isOpen}
      onChange={onChange}
      onClose={handleClose}
      title={`${readOnly ? 'Viewing' : 'Editing'} ${node.data.name}`}
    >
      {!action && (
        <div>
          {node.type !== 'goal' && parentNode && (
            <div className="mt-6 flex flex-col text-sm">
              <div className="mb-2 flex items-center justify-start gap-2">
                <p>Parent Description</p>
                {toggleParentDescription ? (
                  <Eye
                    className="h-4 w-4"
                    onClick={() =>
                      setToggleParentDescription(!toggleParentDescription)
                    }
                  />
                ) : (
                  <EyeOff
                    className="h-4 w-4"
                    onClick={() =>
                      setToggleParentDescription(!toggleParentDescription)
                    }
                  />
                )}
              </div>
              {toggleParentDescription && (
                <>
                  <span className="mb-2 font-medium text-muted-foreground text-xs uppercase group-hover:text-white">
                    Identifier: {parentNode.data.name}
                  </span>
                  <p className="text-muted-foreground">
                    {parentNode.data.short_description}
                  </p>
                </>
              )}
            </div>
          )}
          <EditForm
            node={node}
            onClose={handleClose}
            setUnresolvedChanges={setUnresolvedChanges}
          />
          {readOnly ? (
            <>
              <Separator className="my-6" />
              <div className="">
                <h3 className="mb-2 font-semibold text-lg">Actions</h3>
                <div className="flex flex-col items-center justify-around gap-2">
                  <Button
                    className="w-full"
                    onClick={() => setAction('comment')}
                    variant={'outline'}
                  >
                    <MessageCirclePlus className="mr-2 h-4 w-4" />
                    Comments
                  </Button>
                </div>
              </div>
              <Separator className="my-6" />
            </>
          ) : (
            <>
              <Separator className="my-6" />
              <div className="">
                <h3 className="mb-2 font-semibold text-lg">Actions</h3>
                <div className="flex flex-col items-center justify-around gap-2">
                  {node.type === 'goal' && (
                    <Button
                      className="w-full"
                      onClick={() => setAction('context')}
                      variant={'outline'}
                    >
                      <BookOpenText className="mr-2 h-4 w-4" />
                      Manage Context
                    </Button>
                  )}
                  {node.type !== 'evidence' && (
                    <Button
                      className="w-full"
                      onClick={() => setAction('attributes')}
                      variant={'outline'}
                    >
                      <LibraryIcon className="mr-2 h-4 w-4" />
                      Manage Attributes
                    </Button>
                  )}
                  {node.type !== 'context' && node.type !== 'evidence' && (
                    <Button
                      className="w-full"
                      onClick={() => setAction('new')}
                      variant={'outline'}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add New Element
                    </Button>
                  )}
                  {node.type !== 'context' && node.type !== 'evidence' && (
                    <Button
                      className="w-full"
                      onClick={() => setAction('existing')}
                      variant={'outline'}
                    >
                      <Unplug className="mr-2 h-4 w-4" />
                      Reattach Element(s)
                    </Button>
                  )}
                  {node.type !== 'context' &&
                    node.type !== 'goal' &&
                    node.type !== 'strategy' && (
                      <Button
                        className="w-full"
                        onClick={() => setAction('move')}
                        variant={'outline'}
                      >
                        <Move className="mr-2 h-4 w-4" />
                        Move Item
                      </Button>
                    )}
                  <Button
                    className="w-full"
                    onClick={() => setAction('comment')}
                    variant={'outline'}
                  >
                    <MessageCirclePlus className="mr-2 h-4 w-4" />
                    Comments
                  </Button>
                </div>
              </div>
              <Separator className="my-6" />
            </>
          )}

          {!readOnly && (
            <div className="mt-12 flex items-center justify-start gap-4">
              {node.type !== 'goal' && (
                <Button
                  className="my-8 w-full"
                  onClick={handleDetach}
                  variant={'outline'}
                >
                  <Unplug className="mr-2 h-4 w-4" />
                  Detach
                </Button>
              )}
              <Button
                className="flex w-full items-center justify-center"
                onClick={() => setDeleteOpen(true)}
                variant={'destructive'}
              >
                <Trash2 className="mr-2" />
                Delete&nbsp;
                <span className="capitalize">{node.type}</span>
              </Button>
            </div>
          )}
        </div>
      )}
      {action === 'new' &&
        !readOnly &&
        (selectedLink ? (
          <NewLinkForm
            actions={{ setLinkToCreate, setSelectedLink, handleClose }}
            linkType={linkToCreate}
            node={node}
            setUnresolvedChanges={setUnresolvedChanges}
          />
        ) : (
          node.type !== 'context' &&
          node.type !== 'evidence' && (
            <div className="mt-8 flex flex-col items-start justify-start">
              <h3 className="mb-2 font-semibold text-lg">Add New</h3>
              <div className="flex w-full flex-col items-center justify-start gap-4">
                {node.type === 'goal' && (
                  <>
                    {/* <Button variant='outline' onClick={() => selectLink('context')} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Context</Button> */}
                    <Button
                      className="w-full"
                      onClick={() => selectLink('strategy')}
                      variant="outline"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Strategy
                    </Button>
                    <Button
                      className="w-full"
                      onClick={() => selectLink('claim')}
                      variant="outline"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Property Claim
                    </Button>
                  </>
                )}
                {node.type === 'strategy' && (
                  <Button
                    className="w-full"
                    onClick={() => selectLink('claim')}
                    variant="outline"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Property Claim
                  </Button>
                )}
                {node.type === 'property' && (
                  <>
                    <Button
                      className="w-full"
                      onClick={() => selectLink('claim')}
                      variant="outline"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Property Claim
                    </Button>
                    <Button
                      className="w-full"
                      onClick={() => selectLink('evidence')}
                      variant="outline"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Evidence
                    </Button>
                  </>
                )}
              </div>
              <Button
                className="my-6"
                onClick={() => setAction(null)}
                variant={'outline'}
              >
                Cancel
              </Button>
            </div>
          )
        ))}
      {action === 'existing' &&
        !readOnly &&
        node.type !== 'evidence' &&
        node.type !== 'context' && (
          <OrphanElements
            handleClose={handleClose}
            loadingState={{ loading, setLoading }}
            node={node}
            setAction={setAction}
          />
        )}
      {action === 'move' && !readOnly && (
        <>
          {node.type === 'property' || node.type === 'evidence' ? (
            <div className="w-full pt-4">
              <h3 className="mt-6 mb-2 font-semibold text-lg capitalize">
                Move {node.type}
              </h3>
              <div className="items-left flex flex-col justify-start gap-2">
                {node.type === 'property' && (
                  <Select onValueChange={setSelectedClaimMove}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {goal && (
                        <SelectItem key={crypto.randomUUID()} value={goal}>
                          <div className="flex flex-col items-start justify-start gap-1">
                            <div className="flex items-center">
                              <span className="font-medium">{goal.name}</span>
                              <svg
                                aria-hidden="true"
                                className="mx-2 inline h-0.5 w-0.5 fill-current"
                                viewBox="0 0 2 2"
                              >
                                <circle cx={1} cy={1} r={1} />
                              </svg>
                              <span className="max-w-[200px] truncate">
                                {goal.short_description}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      )}
                      {strategies?.map((strategy: any) => (
                        <SelectItem key={crypto.randomUUID()} value={strategy}>
                          <div className="flex items-start justify-start gap-1">
                            <div className="flex items-center">
                              <span className="font-medium">
                                {strategy.name}
                              </span>
                              <svg
                                aria-hidden="true"
                                className="mx-2 inline h-0.5 w-0.5 fill-current"
                                viewBox="0 0 2 2"
                              >
                                <circle cx={1} cy={1} r={1} />
                              </svg>
                              <span className="max-w-[200px] truncate">
                                {strategy.short_description}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                      {claims?.map((claim: any) => (
                        <SelectItem key={crypto.randomUUID()} value={claim}>
                          <div className="flex flex-col items-start justify-start gap-1">
                            <div className="flex items-center">
                              <span className="font-medium">{claim.name}</span>
                              <svg
                                aria-hidden="true"
                                className="mx-2 inline h-0.5 w-0.5 fill-current"
                                viewBox="0 0 2 2"
                              >
                                <circle cx={1} cy={1} r={1} />
                              </svg>
                              <span className="max-w-[200px] truncate">
                                {claim.short_description}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                      {strategies?.length === 0 && (
                        <SelectItem disabled={true} value="{strategy.id}">
                          No strategies found.
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
                {node.type === 'evidence' && (
                  <Select onValueChange={setSelectedEvidenceMove}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {claims?.map((claim: any) => (
                        <SelectItem key={crypto.randomUUID()} value={claim}>
                          <div className="flex flex-col items-start justify-start gap-1">
                            <div className="flex items-center">
                              <span className="font-medium">{claim.name}</span>
                              <svg
                                aria-hidden="true"
                                className="mx-2 inline h-0.5 w-0.5 fill-current"
                                viewBox="0 0 2 2"
                              >
                                <circle cx={1} cy={1} r={1} />
                              </svg>
                              <span className="max-w-[200px] truncate">
                                {claim.short_description}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                      {claims && claims.length === 0 && (
                        <SelectItem disabled={true} value="{strategy.id}">
                          No property claims found.
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-start gap-2">
            <Button
              className="bg-indigo-500 hover:bg-indigo-600 dark:text-white"
              onClick={handleMove}
            >
              Move
            </Button>
            <Button
              className="my-6"
              onClick={() => setAction(null)}
              variant={'outline'}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
      {action === 'comment' && (
        <NodeComment
          handleClose={handleClose}
          loadingState={{ loading, setLoading }}
          node={node}
          readOnly={assuranceCase.permissions === 'view'}
          setAction={setAction}
        />
      )}
      {action === 'context' && (
        <NodeContext
          actions={{ setSelectedLink, handleClose, setAction }}
          node={node}
          setUnresolvedChanges={setUnresolvedChanges}
        />
      )}
      {action === 'attributes' && (
        <NodeAttributes
          actions={{ setSelectedLink, handleClose, setAction }}
          node={node}
          onClose={handleClose}
          setUnresolvedChanges={setUnresolvedChanges}
        />
      )}
      <AlertModal
        cancelButtonText={'No, keep the element'}
        confirmButtonText={'Yes, delete this element!'}
        isOpen={deleteOpen}
        loading={loading}
        message={
          'Deleting this element will also remove all of the connected child elements. Please detach any child elements that you wish to keep before deleting, as the current action cannot be undone.'
        }
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
      <AlertModal
        cancelButtonText={'No, keep editing'}
        confirmButtonText={'Yes, discard changes!'}
        isOpen={alertOpen}
        loading={loading}
        message={
          'You have changes that have not been updated. Would you like to discard these changes?'
        }
        onClose={() => setAlertOpen(false)}
        onConfirm={handleClose}
      />
    </EditSheet>
  );
};

export default NodeEdit;
