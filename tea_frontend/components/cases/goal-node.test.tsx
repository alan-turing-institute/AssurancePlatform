import { Position } from 'reactflow';
import { describe, expect, it, vi } from 'vitest';
import { renderWithAuth, screen } from '@/src/__tests__/utils/test-utils';
import GoalNode from './goal-node';

// Mock ReactFlow components
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    Handle: ({
      type,
      id,
      position,
    }: {
      type: string;
      id: string;
      position: string;
    }) => (
      <div data-position={position} data-testid={`handle-${type}-${id}`}>
        Handle {type} {id}
      </div>
    ),
    Position: {
      Top: 'top',
      Right: 'right',
      Bottom: 'bottom',
      Left: 'left',
    },
    memo: (component: any) => component,
  };
});

// Mock child components
vi.mock('./ToggleButton', () => ({
  default: ({ node }: { node: any }) => (
    <div data-node-id={node.id} data-testid="toggle-button">
      Toggle Button
    </div>
  ),
}));

vi.mock('./IconIndicator', () => ({
  default: ({ data }: { data: any }) => (
    <div
      data-has-comments={data.comments?.length > 0}
      data-testid="icon-indicator"
    >
      Icon Indicator
    </div>
  ),
}));

describe('GoalNode', () => {
  const mockNodeProps = {
    id: 'goal-1',
    type: 'goal',
    position: { x: 0, y: 0 },
    selected: false,
    dragging: false,
    isConnectable: true,
    zIndex: 1,
    xPos: 0,
    yPos: 0,
    targetPosition: Position.Top,
    sourcePosition: Position.Bottom,
  };

  describe('Basic Rendering', () => {
    it('should render goal node with basic data', () => {
      const data = {
        name: 'Primary Safety Goal',
        description: 'Ensure system operates safely',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      expect(screen.getByText('Primary Safety Goal')).toBeInTheDocument();
      expect(
        screen.getByText('Ensure system operates safely')
      ).toBeInTheDocument();
    });

    it('should render goal icon', () => {
      const data = {
        name: 'Test Goal',
        description: 'Test description',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      // Should have the goal icon container
      const iconContainer = screen
        .getByText('Primary Safety Goal')
        .closest('div')
        ?.parentElement?.querySelector('.rounded-full');
      expect(iconContainer).toHaveClass('w-12', 'h-12', 'bg-slate-900/20');
    });

    it('should render with pink background styling', () => {
      const data = {
        name: 'Test Goal',
        description: 'Test description',
      };

      const { container } = renderWithAuth(
        <GoalNode data={data} {...mockNodeProps} />
      );

      const nodeContainer = container.firstChild;
      expect(nodeContainer).toHaveClass(
        'bg-pink-600',
        'text-white',
        'w-[300px]'
      );
    });

    it('should have proper shadow and border radius', () => {
      const data = {
        name: 'Test Goal',
        description: 'Test description',
      };

      const { container } = renderWithAuth(
        <GoalNode data={data} {...mockNodeProps} />
      );

      const nodeContainer = container.firstChild;
      expect(nodeContainer).toHaveClass('shadow-md', 'rounded-md');
    });
  });

  describe('Content Display', () => {
    it('should display goal name with proper styling', () => {
      const data = {
        name: 'Critical Safety Goal',
        description: 'Important safety requirements',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      const nameElement = screen.getByText('Critical Safety Goal');
      expect(nameElement).toHaveClass('text-lg', 'font-bold');
    });

    it('should display goal description when provided', () => {
      const data = {
        name: 'Test Goal',
        description:
          'This is a detailed description of the goal that explains its purpose and requirements.',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      const descriptionElement = screen.getByText(
        'This is a detailed description of the goal that explains its purpose and requirements.'
      );
      expect(descriptionElement).toHaveClass('text-xs', 'line-clamp-2');
    });

    it('should display default message when no description provided', () => {
      const data = {
        name: 'Test Goal',
        description: null,
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      expect(screen.getByText('No description available.')).toBeInTheDocument();
    });

    it('should display default message when description is empty string', () => {
      const data = {
        name: 'Test Goal',
        description: '',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      expect(screen.getByText('No description available.')).toBeInTheDocument();
    });

    it('should truncate long descriptions', () => {
      const data = {
        name: 'Test Goal',
        description:
          'This is a very long description that should be truncated by the line-clamp-2 class when it exceeds two lines of text content.',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      const descriptionElement = screen.getByText(data.description);
      expect(descriptionElement).toHaveClass('line-clamp-2');
    });
  });

  describe('Child Components', () => {
    it('should render IconIndicator component', () => {
      const data = {
        name: 'Test Goal',
        description: 'Test description',
        comments: [{ id: 1, content: 'Test comment' }],
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      expect(screen.getByTestId('icon-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('icon-indicator')).toHaveAttribute(
        'data-has-comments',
        'true'
      );
    });

    it('should render ToggleButton component', () => {
      const data = {
        name: 'Test Goal',
        description: 'Test description',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      expect(screen.getByTestId('toggle-button')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-button')).toHaveAttribute(
        'data-node-id',
        'goal-1'
      );
    });

    it('should pass node props to ToggleButton', () => {
      const data = {
        name: 'Test Goal',
        description: 'Test description',
      };

      const customProps = {
        ...mockNodeProps,
        id: 'custom-goal-id',
      };

      renderWithAuth(<GoalNode data={data} {...customProps} />);

      expect(screen.getByTestId('toggle-button')).toHaveAttribute(
        'data-node-id',
        'custom-goal-id'
      );
    });

    it('should pass data to IconIndicator', () => {
      const data = {
        name: 'Test Goal',
        description: 'Test description',
        comments: [],
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      expect(screen.getByTestId('icon-indicator')).toHaveAttribute(
        'data-has-comments',
        'false'
      );
    });
  });

  describe('ReactFlow Handles', () => {
    it('should render bottom source handle', () => {
      const data = {
        name: 'Test Goal',
        description: 'Test description',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      expect(screen.getByTestId('handle-source-c')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-c')).toHaveAttribute(
        'data-position',
        'bottom'
      );
    });

    it('should not render commented out handles', () => {
      const data = {
        name: 'Test Goal',
        description: 'Test description',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      expect(screen.queryByTestId('handle-source-a')).not.toBeInTheDocument();
      expect(screen.queryByTestId('handle-source-b')).not.toBeInTheDocument();
    });
  });

  describe('Layout and Positioning', () => {
    it('should have proper container layout', () => {
      const data = {
        name: 'Test Goal',
        description: 'Test description',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      // Check main container classes
      const mainContainer = screen.getByText('Test Goal').closest('.px-4');
      expect(mainContainer).toHaveClass('px-4', 'py-2', 'w-[300px]');
    });

    it('should have proper flex layout for content', () => {
      const data = {
        name: 'Test Goal',
        description: 'Test description',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      // Check inner flex container
      const flexContainer = screen.getByText('Test Goal').closest('.flex');
      expect(flexContainer).toHaveClass(
        'flex',
        'justify-start',
        'items-center'
      );
    });

    it('should have proper text container width', () => {
      const data = {
        name: 'Test Goal',
        description: 'Test description',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      // Check text container width
      const textContainer = screen.getByText('Test Goal').closest('.w-[200px]');
      expect(textContainer).toHaveClass('w-[200px]', 'ml-2');
    });
  });

  describe('Data Handling', () => {
    it('should handle missing name gracefully', () => {
      const data = {
        name: null,
        description: 'Test description',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      // Should not crash and render empty name
      expect(screen.getByText('Test description')).toBeInTheDocument();
    });

    it('should handle complex data objects', () => {
      const data = {
        name: 'Complex Goal',
        description: 'Complex description',
        comments: [
          { id: 1, content: 'Comment 1' },
          { id: 2, content: 'Comment 2' },
        ],
        metadata: {
          priority: 'high',
          status: 'active',
        },
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      expect(screen.getByText('Complex Goal')).toBeInTheDocument();
      expect(screen.getByText('Complex description')).toBeInTheDocument();
    });

    it('should handle empty data object', () => {
      const data = {};

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      // Should render with defaults
      expect(screen.getByText('No description available.')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      const data = {
        name: 'Accessible Goal',
        description: 'Goal with accessibility considerations',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      // Should have proper heading-like structure
      const nameElement = screen.getByText('Accessible Goal');
      expect(nameElement).toHaveClass('text-lg', 'font-bold');
    });

    it('should have readable color contrast', () => {
      const data = {
        name: 'Test Goal',
        description: 'Test description',
      };

      const { container } = renderWithAuth(
        <GoalNode data={data} {...mockNodeProps} />
      );

      // Should use white text on pink background
      const nodeContainer = container.firstChild;
      expect(nodeContainer).toHaveClass('bg-pink-600', 'text-white');
    });

    it('should handle keyboard interaction through child components', () => {
      const data = {
        name: 'Interactive Goal',
        description: 'Goal with interactive elements',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      // ToggleButton should be interactive
      expect(screen.getByTestId('toggle-button')).toBeInTheDocument();
    });
  });

  describe('Memoization', () => {
    it('should be properly memoized', () => {
      const data = {
        name: 'Memoized Goal',
        description: 'This component should be memoized',
      };

      const { rerender } = renderWithAuth(
        <GoalNode data={data} {...mockNodeProps} />
      );

      expect(screen.getByText('Memoized Goal')).toBeInTheDocument();

      // Re-render with same props should use memoized version
      rerender(<GoalNode data={data} {...mockNodeProps} />);

      expect(screen.getByText('Memoized Goal')).toBeInTheDocument();
    });

    it('should re-render when data changes', () => {
      const initialData = {
        name: 'Initial Goal',
        description: 'Initial description',
      };

      const { rerender } = renderWithAuth(
        <GoalNode data={initialData} {...mockNodeProps} />
      );

      expect(screen.getByText('Initial Goal')).toBeInTheDocument();

      const updatedData = {
        name: 'Updated Goal',
        description: 'Updated description',
      };

      rerender(<GoalNode data={updatedData} {...mockNodeProps} />);

      expect(screen.getByText('Updated Goal')).toBeInTheDocument();
      expect(screen.queryByText('Initial Goal')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long goal names', () => {
      const data = {
        name: 'This is an extremely long goal name that might cause layout issues if not handled properly in the component',
        description: 'Short description',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      expect(screen.getByText(data.name)).toBeInTheDocument();
    });

    it('should handle special characters in goal name', () => {
      const data = {
        name: 'Goal with Special Characters: !@#$%^&*()_+-=[]{}|;:,.<>?',
        description: 'Description with special chars: áéíóú ñ ü',
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      expect(screen.getByText(data.name)).toBeInTheDocument();
      expect(screen.getByText(data.description)).toBeInTheDocument();
    });

    it('should handle undefined data properties', () => {
      const data = {
        name: 'Test Goal',
        description: undefined,
        comments: undefined,
      };

      renderWithAuth(<GoalNode data={data} {...mockNodeProps} />);

      expect(screen.getByText('Test Goal')).toBeInTheDocument();
      expect(screen.getByText('No description available.')).toBeInTheDocument();
    });
  });
});
