'use client'

import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react";
import EditSheet from "../ui/edit-sheet";
import { CloudFog, Plus, Trash2 } from "lucide-react"
import EditForm from "./EditForm";
import useStore from '@/data/store';
import { Autour_One } from "next/font/google";
import { addEvidenceToClaim, addPropertyClaimToNested, createAssuranceCaseNode, deleteAssuranceCaseNode } from "@/lib/case-helper";
import { useLoginToken } from "@/hooks/useAuth";

interface NodeEditProps {
  node: Node | any
  isOpen: boolean
  onClose: () => void
}

const NodeEdit = ({ node, isOpen, onClose } : NodeEditProps ) => {
  const [isMounted, setIsMounted] = useState(false);
  const { assuranceCase, setAssuranceCase } = useStore();

  const [token] = useLoginToken();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  if(!node) {
    return null
  }

  /** Function used to handle creation of a context node linked to a goal */
  const handleContextAdd = async () => {
    console.log('case', assuranceCase.goals)
    // Create a new context object to add - this should be created by calling the api 
    const newContextItem = {
      "name": "New Context",
      "short_description": "Short description",
      "long_description": "Long description",
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
  }

  /** Function used to handle creation of a strategy node linked to a goal */
  const handleStrategyAdd = async () => {
    // Create a new strategy object to add
    const newStrategyItem = {
      "name": "New Strategy",
      "short_description": "Short description",
      "long_description": "Long description",
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
  }

  /** Function used to create a property claim, whether its parent is a goal, strategy or another propery claim */
  const handleClaimAdd = async () => {
    // Create a new property claims object to add
    const newPropertyClaimItem: any = {
      name: "NEW Property Claim",
      short_description: "Short description",
      long_description: "Long description",
      claim_type: 'Property Claim'
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
    console.log('RESULT', result)

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
      }
    }

    if(node.type === 'property') {
      // Call the function to add the new property claim to the nested structure
      const added = addPropertyClaimToNested(assuranceCase.goals, result.data.property_claim_id, newPropertyClaimItem);
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
    }

    if(node.type === 'goal') {
      // Create a new property claim array by adding the new property claims item
      const newPropertyClaim = [...assuranceCase.goals[0].property_claims, newPropertyClaimItem];

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
    }
  }

  /** Function used to handle creation of a evidence node linked to a property claim */
  const handleEvidenceAdd = async () => {
    let property_claim_id: any = [node.data.id]
    
    // Create a new evidence object to add
    const newEvidenceItem = {
      name: "NEW Evidence",
      short_description: "Short description",
      long_description: "Long description",
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
  }

  /** Function used to handle deletion of the current selected item */
  const handleDelete = async () => {
    const deleted = await deleteAssuranceCaseNode(node.type, node.data.id, token)
    
    if(deleted) {
      // TODO: Remove node from selected Nodes
      window.location.reload()
    }
  }

  return (
    <EditSheet 
      title={`Editing ${node.data.name}`} 
      description="Use this form to update your goal." 
      isOpen={isOpen} onClose={onClose}
    >
      <EditForm node={node} />
      {node.type != 'context' && (
        <div className="flex flex-col justify-start items-start mt-8">
          <h3 className="text-lg font-semibold mb-2">Link to {node.data.name}</h3>
          <div className="flex flex-col justify-start items-center gap-4 w-full">
            {node.type === 'goal' && (
              <>
                <Button variant='outline' onClick={handleContextAdd} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Context</Button>
                <Button variant='outline' onClick={handleClaimAdd} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Claim</Button>
                <Button variant='outline' onClick={handleStrategyAdd}className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Strategy</Button>
              </>
            )}
            {node.type === 'strategy' && (
                <Button variant='outline' onClick={handleClaimAdd} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Claim</Button>
            )}
            {node.type === 'property' && (
              <>
                <Button variant='outline' onClick={handleEvidenceAdd} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Evidence</Button>
                <Button variant='outline' onClick={handleClaimAdd} className="w-full"><Plus className="w-4 h-4 mr-2"/>Add Claim</Button>
              </>
            )}
            {node.type === 'evidence' && (
              <>
                TODO: Property Links
              </>
            )}
          </div>
        </div>
      )}
      <div className="mt-6">
        <Button variant={'ghost'} 
          onClick={handleDelete}
          className="text-red-500 flex justify-center items-center hover:text-red-500 hover:bg-red-400/10"
        >
          <Trash2 className="mr-2"/>
          Delete&nbsp;
          <span className='capitalize'>{node.type}</span></Button>
      </div>
    </EditSheet>
  )
}

export default NodeEdit
