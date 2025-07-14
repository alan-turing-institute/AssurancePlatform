'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CloudFog, LockIcon, LockKeyhole } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type React from 'react';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { boolean, z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import useStore from '@/data/store';
// import { useLoginToken } from '.*/use-auth'
import {
  addEvidenceToClaim,
  addHiddenProp,
  addPropertyClaimToNested,
  createAssuranceCaseNode,
  findItemById,
  findParentNode,
  findSiblingHiddenState,
  setNodeIdentifier,
  updateAssuranceCase,
  updateAssuranceCaseNode,
} from '@/lib/case-helper';
import { getLayoutedElements } from '@/lib/layout-helper';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

const formSchema = z.object({
  description: z.string().min(2, {
    message: 'Description must be atleast 2 characters',
  }),
  URL: z
    .string()
    .min(2, {
      message: 'url must be at least 2 characters.',
    })
    .optional(),
});

interface NewLinkFormProps {
  node: any;
  linkType: string;
  actions: any;
  setUnresolvedChanges: Dispatch<SetStateAction<boolean>>;
}

const NewLinkForm: React.FC<NewLinkFormProps> = ({
  node,
  linkType,
  actions,
  setUnresolvedChanges,
}) => {
  const { nodes, setNodes, assuranceCase, setAssuranceCase } = useStore();
  // const [token] = useLoginToken();
  const { data: session } = useSession();
  const [loading, setLoading] = useState<boolean>(false);

  const { setSelectedLink, setLinkToCreate, handleClose } = actions;

  const parentNode: any = findParentNode(nodes, node);

  const reset = () => {
    setLinkToCreate('');
    setSelectedLink(false);
    handleClose();
  };

  /** Function used to handle creation of a context node linked to a goal */
  const handleContextAdd = async (description: string) => {
    // Create a new context object to add - this should be created by calling the api
    const newContextItem = {
      short_description: description,
      long_description: description,
      goal_id: assuranceCase.goals[0].id,
      type: 'Context',
    };

    const result: any = await createAssuranceCaseNode(
      'contexts',
      newContextItem,
      session?.key ?? ''
    );

    if (result.error) {
      // TODO: Rendering error
    }

    result.data.hidden = findSiblingHiddenState(assuranceCase, node.data.id);

    // Create a new context array by adding the new context item
    const newContext = [...assuranceCase.goals[0].context, result.data];

    // Create a new assuranceCase object with the updated context array
    const updatedAssuranceCase = {
      ...assuranceCase,
      goals: [
        {
          ...assuranceCase.goals[0],
          context: newContext,
        },
      ],
    };

    // Update Assurance Case in state
    setAssuranceCase(updatedAssuranceCase);
    reset();
    setLoading(false);
    // window.location.reload()
  };

  /** Function used to handle creation of a strategy node linked to a goal */
  const handleStrategyAdd = async (description: string) => {
    // Create a new strategy object to add
    const newStrategyItem = {
      short_description: description,
      long_description: description,
      goal_id: assuranceCase.goals[0].id,
      property_claims: [],
      type: 'Strategy',
    };

    const result: any = await createAssuranceCaseNode(
      'strategies',
      newStrategyItem,
      session?.key ?? ''
    );

    if (result.error) {
      // TODO: Rendering error
    }

    result.data.hidden = findSiblingHiddenState(assuranceCase, node.data.id);

    // Create a new strategy array by adding the new context item
    const newStrategy = [...assuranceCase.goals[0].strategies, result.data];

    // Create a new assuranceCase object with the updated strategy array
    const updatedAssuranceCase = {
      ...assuranceCase,
      goals: [
        {
          ...assuranceCase.goals[0],
          strategies: newStrategy,
        },
        // Copy other goals if needed
      ],
    };

    // Update Assurance Case in state
    setAssuranceCase(updatedAssuranceCase);
    reset();
    setLoading(false);
    // window.location.reload()
  };

  /** Function used to create a property claim, whether its parent is a goal, strategy or another propery claim */
  const handleClaimAdd = async (description: string) => {
    // Create a new property claims object to add
    const newPropertyClaimItem: any = {
      short_description: description,
      long_description: description,
      claim_type: 'Property Claim',
      property_claims: [],
      evidence: [],
      type: 'PropertyClaim',
    };

    switch (node.type) {
      case 'strategy':
        newPropertyClaimItem.strategy_id = node.data.id;
        break;
      case 'property':
        newPropertyClaimItem.property_claim_id = node.data.id;
        break;
      default:
        newPropertyClaimItem.goal_id = assuranceCase.goals[0].id;
        break;
    }

    const result: any = await createAssuranceCaseNode(
      'propertyclaims',
      newPropertyClaimItem,
      session?.key ?? ''
    );

    if (result.error) {
      // Handle error silently
      return;
    }

    result.data.hidden = findSiblingHiddenState(assuranceCase, node.data.id);

    if (node.type === 'strategy') {
      // Find the goal containing the specific strategy
      const goalContainingStrategy = assuranceCase.goals.find(
        (goal: any) =>
          goal.strategies &&
          goal.strategies.some(
            (strategy: any) => strategy.id === result.data.strategy_id
          )
      );

      if (goalContainingStrategy) {
        // Clone the assuranceCase to avoid mutating the state directly
        const updatedAssuranceCase = { ...assuranceCase };

        // Update the strategies array in the goal containing the specific strategy
        const updatedStrategies = goalContainingStrategy.strategies.map(
          (strategy: any) => {
            if (strategy.id === result.data.strategy_id) {
              // Add the new property claim to the corresponding strategy
              return {
                ...strategy,
                property_claims: [...strategy.property_claims, result.data],
              };
            }
            return strategy;
          }
        );

        // Update the goal containing the specific strategy with the updated strategies array
        const updatedGoalContainingStrategy = {
          ...goalContainingStrategy,
          strategies: updatedStrategies,
        };

        // Update the assuranceCase goals array with the updated goal containing the specific strategy
        updatedAssuranceCase.goals = assuranceCase.goals.map((goal: any) => {
          if (goal === goalContainingStrategy) {
            return updatedGoalContainingStrategy;
          }
          return goal;
        });

        // Update Assurance Case in state
        setAssuranceCase(updatedAssuranceCase);
        reset();
        setLoading(false);
        // window.location.reload()
      }
    }

    if (node.type === 'property') {
      // Call the function to add the new property claim to the nested structure
      const added = addPropertyClaimToNested(
        assuranceCase.goals,
        result.data.property_claim_id,
        result.data
      );
      if (!added) {
        return; // Parent property claim not found
      }

      const updatedAssuranceCase = {
        ...assuranceCase,
        goals: [
          {
            ...assuranceCase.goals[0],
          },
        ],
      };

      // const formattedAssuranceCase = await addHiddenProp(updatedAssuranceCase)
      setAssuranceCase(updatedAssuranceCase);
      reset();
      setLoading(false);
      // window.location.reload()
    }

    if (node.type === 'goal') {
      // Create a new property claim array by adding the new property claims item
      const newPropertyClaim = [
        ...assuranceCase.goals[0].property_claims,
        result.data,
      ];

      // Create a new assuranceCase object with the updated property claims array
      const updatedAssuranceCase = {
        ...assuranceCase,
        goals: [
          {
            ...assuranceCase.goals[0],
            property_claims: newPropertyClaim,
          },
          // Copy other goals if needed
        ],
      };

      // Update Assurance Case in state
      setAssuranceCase(updatedAssuranceCase);
      reset();
      setLoading(false);
      // window.location.reload()
    }
  };

  /** Function used to handle creation of a evidence node linked to a property claim */
  const handleEvidenceAdd = async (description: string, url?: string) => {
    const property_claim_id: any = [node.data.id];

    // Create a new evidence object to add
    const newEvidenceItem = {
      short_description: description,
      long_description: description,
      URL: url,
      property_claim_id,
      type: 'Evidence',
    };

    const result: any = await createAssuranceCaseNode(
      'evidence',
      newEvidenceItem,
      session?.key ?? ''
    );

    if (result.error) {
      // TODO: Rendering error
    }

    result.data.hidden = findSiblingHiddenState(assuranceCase, node.data.id);

    const added = addEvidenceToClaim(
      assuranceCase.goals,
      result.data.property_claim_id[0],
      result.data
    );
    if (!added) {
      return; // Parent property claim not found
    }

    const updatedAssuranceCase = {
      ...assuranceCase,
      goals: [
        {
          ...assuranceCase.goals[0],
        },
      ],
    };

    setAssuranceCase(updatedAssuranceCase);
    reset();
    setLoading(false);
    // window.location.reload()
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    switch (linkType) {
      case 'context':
        handleContextAdd(values.description);
        break;
      case 'claim':
        handleClaimAdd(values.description);
        break;
      case 'strategy':
        handleStrategyAdd(values.description);
        break;
      case 'evidence':
        handleEvidenceAdd(values.description, values.URL);
        break;
      default:
        break;
    }
  }

  useEffect(() => {
    form.watch((values, { name }) => {
      if (name === 'description' || name === 'URL') {
        setUnresolvedChanges(true);
      }
    });
  }, [form, setUnresolvedChanges]);

  return (
    <div className="my-4 border-t">
      <div className="mt-4">
        Create new <span className="font-bold">{linkType}</span>.
      </div>
      <Form {...form}>
        <form className="mt-6 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Type your description here."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {linkType === 'evidence' && (
            <FormField
              control={form.control}
              name="URL"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Evidence URL</FormLabel>
                  <FormControl>
                    <Input placeholder="www.sample.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <div className="flex items-center justify-start gap-3 pt-4">
            <Button
              className="bg-indigo-500 hover:bg-indigo-600 dark:text-white"
              disabled={loading}
              type="submit"
            >
              Add
            </Button>
            <Button
              onClick={() => {
                setSelectedLink(false);
                setLinkToCreate('');
              }}
              variant={'outline'}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default NewLinkForm;
