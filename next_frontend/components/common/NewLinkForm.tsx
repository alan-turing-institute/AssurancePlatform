import React from 'react'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Textarea } from "../ui/textarea"
import { Button } from '../ui/button'
import useStore from '@/data/store';
import { CloudFog, LockIcon, LockKeyhole } from 'lucide-react'
import { getLayoutedElements } from '@/lib/layout-helper'
import { useLoginToken } from '@/hooks/useAuth'
import { addEvidenceToClaim, addPropertyClaimToNested, createAssuranceCaseNode, findItemById, setNodeIdentifier, updateAssuranceCase, updateAssuranceCaseNode } from '@/lib/case-helper'

const formSchema = z.object({
  description: z.string().min(2, {
    message: "Description must be atleast 2 characters"
  })
})

interface NewLinkFormProps {
  node: any;
  linkType: string
  actions: any
};

const NewLinkForm: React.FC<NewLinkFormProps> = ({
  node,
  linkType,
  actions
}) => {
  const { nodes, setNodes, assuranceCase, setAssuranceCase } = useStore();
  const [token] = useLoginToken();

  const { setSelectedLink, setLinkToCreate, handleClose } = actions

  const reset = () => {
    setLinkToCreate('')
    setSelectedLink(false)
    handleClose()
  }

  /** Function used to handle creation of a context node linked to a goal */
  const handleContextAdd = async (description: string) => {
    const identifier = await setNodeIdentifier(node, 'context')

    // Create a new context object to add - this should be created by calling the api
    const newContextItem = {
      "name": `C${identifier}`,
      "short_description": description,
      "long_description": description,
      "goal_id": assuranceCase.goals[0].id
    };

    const result: any = await createAssuranceCaseNode('contexts', newContextItem, token)

    if(result.error) {
      // TODO: Rendering error
    }

    // Create a new context array by adding the new context item
    const newContext = [...assuranceCase.goals[0].context, result.data];

    // Create a new assuranceCase object with the updated context array
    const updatedAssuranceCase = {
      ...assuranceCase,
      goals: [
        {
          ...assuranceCase.goals[0],
          context: newContext
        },
        // Copy other goals if needed
      ]
    }

    // Update Assurance Case in state
    setAssuranceCase(updatedAssuranceCase)
    reset()
  }

  /** Function used to handle creation of a strategy node linked to a goal */
  const handleStrategyAdd = async (description: string) => {
    const identifier = await setNodeIdentifier(node, 'strategy')

    // Create a new strategy object to add
    const newStrategyItem = {
      "name": `S${identifier}`,
      "short_description": description,
      "long_description": description,
      "goal_id": assuranceCase.goals[0].id,
      "property_claims": []
    };

    const result: any = await createAssuranceCaseNode('strategies', newStrategyItem, token)

    if(result.error) {
      // TODO: Rendering error
    }

    // Create a new strategy array by adding the new context item
    const newStrategy = [...assuranceCase.goals[0].strategies, result.data];

    // Create a new assuranceCase object with the updated strategy array
    const updatedAssuranceCase = {
      ...assuranceCase,
      goals: [
        {
          ...assuranceCase.goals[0],
          strategies: newStrategy
        },
        // Copy other goals if needed
      ]
    }

    // Update Assurance Case in state
    setAssuranceCase(updatedAssuranceCase)
    reset()
  }

  /** Function used to create a property claim, whether its parent is a goal, strategy or another propery claim */
  const handleClaimAdd = async (description: string) => {
    const identifier = await setNodeIdentifier(node, 'property')

    // Create a new property claims object to add
    const newPropertyClaimItem: any = {
      name: `P${identifier}`,
      short_description: description,
      long_description: description,
      claim_type: 'Property Claim',
      property_claims: [],
      evidence: []
    };

    switch (node.type) {
      case 'strategy':
        newPropertyClaimItem.strategy_id = node.data.id
        break;
      case 'property':
        newPropertyClaimItem.property_claim_id = node.data.id
        break;
      default:
        newPropertyClaimItem.goal_id = assuranceCase.goals[0].id
        break;
    }

    const result: any = await createAssuranceCaseNode('propertyclaims', newPropertyClaimItem, token)

    if(result.error) {
      console.log('RESULT ERROR', result.error)
      return
    }

    if(node.type === 'strategy') {
      // Find the goal containing the specific strategy
      const goalContainingStrategy = assuranceCase.goals.find((goal:any) => goal.strategies && goal.strategies.some((strategy:any) => strategy.id === result.data.strategy_id));

      if (goalContainingStrategy) {
        // Clone the assuranceCase to avoid mutating the state directly
        const updatedAssuranceCase = { ...assuranceCase };

        // Update the strategies array in the goal containing the specific strategy
        const updatedStrategies = goalContainingStrategy.strategies.map((strategy: any) => {
          if (strategy.id === result.data.strategy_id) {
            // Add the new property claim to the corresponding strategy
            return {
              ...strategy,
              property_claims: [...strategy.property_claims, result.data]
            };
          }
          return strategy;
        });

        // Update the goal containing the specific strategy with the updated strategies array
        const updatedGoalContainingStrategy = {
          ...goalContainingStrategy,
          strategies: updatedStrategies
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
        reset()
      }
    }

    if(node.type === 'property') {
      // Call the function to add the new property claim to the nested structure
      const added = addPropertyClaimToNested(assuranceCase.goals, result.data.property_claim_id, result.data);
      if (!added) {
          return console.error("Parent property claim not found!");
      }

      const updatedAssuranceCase = {
        ...assuranceCase,
        goals: [
          {
            ...assuranceCase.goals[0],
          }
        ]
      }

      setAssuranceCase(updatedAssuranceCase)
      reset()
    }

    if(node.type === 'goal') {
      // Create a new property claim array by adding the new property claims item
      const newPropertyClaim = [...assuranceCase.goals[0].property_claims, result.data];

      // Create a new assuranceCase object with the updated property claims array
      const updatedAssuranceCase = {
        ...assuranceCase,
        goals: [
          {
            ...assuranceCase.goals[0],
            property_claims: newPropertyClaim
          },
          // Copy other goals if needed
        ]
      }

      // Update Assurance Case in state
      setAssuranceCase(updatedAssuranceCase)
      reset()
    }
  }

  /** Function used to handle creation of a evidence node linked to a property claim */
  const handleEvidenceAdd = async (description: string) => {
    const identifier = await setNodeIdentifier(node, 'evidence')

    let property_claim_id: any = [node.data.id]

    // Create a new evidence object to add
    const newEvidenceItem = {
      name: `E${identifier}`,
      short_description: description,
      long_description: description,
      URL: 'ww.some-evidence.com',
      property_claim_id
    };

    const result: any = await createAssuranceCaseNode('evidence', newEvidenceItem, token)

    if(result.error) {
      // TODO: Rendering error
    }

    const added = addEvidenceToClaim(assuranceCase.goals, result.data.property_claim_id[0], result.data);
    if (!added) {
      return console.error("Parent property claim not found!");
    }

    const updatedAssuranceCase = {
      ...assuranceCase,
      goals: [
        {
          ...assuranceCase.goals[0],
        }
      ]
    }

    setAssuranceCase(updatedAssuranceCase)
    reset()
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: ''
    }
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    switch (linkType) {
      case 'context':
        handleContextAdd(values.description)
        break;
      case 'claim':
        handleClaimAdd(values.description)
        break;
      case 'strategy':
        handleStrategyAdd(values.description)
        break;
      case 'evidence':
        handleEvidenceAdd(values.description)
        break;
      default:
        break;
    }
  }

  return (
    <div className='my-4 border-t'>
      <div className='mt-4'>
        Create new <span className='font-bold'>{linkType}</span>.
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-6">
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Type your description here." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className='flex justify-start items-center gap-3'>
            <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600 dark:text-white">Add</Button>
            <Button variant={"outline"} onClick={() => {
              setSelectedLink(false)
              setLinkToCreate('')
            }}>Cancel</Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

export default NewLinkForm
