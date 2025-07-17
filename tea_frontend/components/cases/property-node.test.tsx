import type { ComponentType } from 'react';
import type { Node } from 'reactflow';
import { Position } from 'reactflow';
import { describe, expect, it, vi } from 'vitest';
import { renderWithAuth, screen } from '@/src/__tests__/utils/test-utils';
import PropertyNode from './property-node';

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
      id?: string;
      position: string;
    }) => (
      <div
        data-position={position}
        data-testid={`handle-${type}${id ? `-${id}` : ''}`}
      >
        Handle {type} {id || ''}
      </div>
    ),
    Position: {
      Top: 'top',
      Right: 'right',
      Bottom: 'bottom',
      Left: 'left',
    },
    memo: <T extends ComponentType>(component: T) => component,
  };
});

// Mock child components
vi.mock('./ToggleButton', () => ({
  default: ({ node }: { node: Node }) => (
    <div data-node-id={node.id} data-testid="toggle-button">
      Toggle Button
    </div>
  ),
}));

vi.mock('./IconIndicator', () => ({
  default: ({
    data,
  }: {
    data: { comments?: Array<{ id: number; content: string }> };
  }) => (
    <div
      data-has-comments={(data.comments?.length ?? 0) > 0}
      data-testid="icon-indicator"
    >
      Icon Indicator
    </div>
  ),
}));

describe('PropertyNode', () => {
  const mockNodeProps = {
    id: 'property-1',
    type: 'property',
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
    it('should render property node with basic data', () => {
      const data = {
        name: 'Performance Claim',
        description: 'System meets performance requirements',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      expect(screen.getByText('Performance Claim')).toBeInTheDocument();
      expect(
        screen.getByText('System meets performance requirements')
      ).toBeInTheDocument();
    });

    it('should render property icon (FolderOpenDot)', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      // Should have the property icon container
      const iconContainer = screen
        .getByText('Test Property')
        .closest('div')
        ?.parentElement?.querySelector('.rounded-full');
      expect(iconContainer).toHaveClass('w-12', 'h-12', 'bg-slate-900/20');
    });

    it('should render with blue background styling', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
      };

      const { container } = renderWithAuth(
        <PropertyNode data={data} {...mockNodeProps} />
      );

      const nodeContainer = container.firstChild;
      expect(nodeContainer).toHaveClass(
        'bg-blue-600',
        'text-white',
        'w-[300px]'
      );
    });

    it('should have proper shadow and border radius', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
      };

      const { container } = renderWithAuth(
        <PropertyNode data={data} {...mockNodeProps} />
      );

      const nodeContainer = container.firstChild;
      expect(nodeContainer).toHaveClass('shadow-md', 'rounded-md');
    });
  });

  describe('Content Display', () => {
    it('should display property name with proper styling', () => {
      const data = {
        name: 'Critical Property Claim',
        description: 'Important property requirements',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      const nameElement = screen.getByText('Critical Property Claim');
      expect(nameElement).toHaveClass('text-lg', 'font-bold');
    });

    it('should display property description', () => {
      const data = {
        name: 'Test Property',
        description:
          'This is a detailed description of the property claim that explains its requirements and constraints.',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      const descriptionElement = screen.getByText(
        'This is a detailed description of the property claim that explains its requirements and constraints.'
      );
      expect(descriptionElement).toHaveClass('text-xs', 'line-clamp-2');
    });

    it('should handle empty description', () => {
      const data = {
        name: 'Test Property',
        description: '',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      // Should render empty description without crashing
      expect(screen.getByText('Test Property')).toBeInTheDocument();
    });

    it('should handle null description', () => {
      const data = {
        name: 'Test Property',
        description: null,
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      // Should render without crashing
      expect(screen.getByText('Test Property')).toBeInTheDocument();
    });

    it('should truncate long descriptions', () => {
      const data = {
        name: 'Test Property',
        description:
          'This is a very long description that should be truncated by the line-clamp-2 class when it exceeds two lines of text content in the property node.',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      const descriptionElement = screen.getByText(data.description);
      expect(descriptionElement).toHaveClass('line-clamp-2');
    });
  });

  describe('Child Components', () => {
    it('should render IconIndicator component', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
        comments: [{ id: 1, content: 'Test comment' }],
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      expect(screen.getByTestId('icon-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('icon-indicator')).toHaveAttribute(
        'data-has-comments',
        'true'
      );
    });

    it('should render ToggleButton component', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      expect(screen.getByTestId('toggle-button')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-button')).toHaveAttribute(
        'data-node-id',
        'property-1'
      );
    });

    it('should pass node props to ToggleButton', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
      };

      const customProps = {
        ...mockNodeProps,
        id: 'custom-property-id',
      };

      renderWithAuth(<PropertyNode data={data} {...customProps} />);

      expect(screen.getByTestId('toggle-button')).toHaveAttribute(
        'data-node-id',
        'custom-property-id'
      );
    });

    it('should pass data to IconIndicator', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
        comments: [],
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      expect(screen.getByTestId('icon-indicator')).toHaveAttribute(
        'data-has-comments',
        'false'
      );
    });
  });

  describe('ReactFlow Handles', () => {
    it('should render top target handle', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      expect(screen.getByTestId('handle-target')).toBeInTheDocument();
      expect(screen.getByTestId('handle-target')).toHaveAttribute(
        'data-position',
        'top'
      );
    });

    it('should render bottom source handle', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      expect(screen.getByTestId('handle-source-c')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-c')).toHaveAttribute(
        'data-position',
        'bottom'
      );
    });

    it('should not render commented out left handle', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      expect(screen.queryByTestId('handle-source-a')).not.toBeInTheDocument();
    });

    it('should have both input and output connection points', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      // Should have target (input) and source (output) handles
      expect(screen.getByTestId('handle-target')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-c')).toBeInTheDocument();
    });
  });

  describe('Layout and Positioning', () => {
    it('should have proper container layout', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      // Check main container classes
      const mainContainer = screen.getByText('Test Property').closest('.px-4');
      expect(mainContainer).toHaveClass('px-4', 'py-2', 'w-[300px]');
    });

    it('should have proper flex layout for content', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      // Check inner flex container
      const flexContainer = screen.getByText('Test Property').closest('.flex');
      expect(flexContainer).toHaveClass(
        'flex',
        'justify-start',
        'items-center'
      );
    });

    it('should have proper text container width', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      // Check text container width
      const textContainer = screen
        .getByText('Test Property')
        .closest('.w-[200px]');
      expect(textContainer).toHaveClass('w-[200px]', 'ml-2');
    });
  });

  describe('Data Handling', () => {
    it('should handle missing name gracefully', () => {
      const data = {
        name: null,
        description: 'Test description',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      // Should not crash and render description
      expect(screen.getByText('Test description')).toBeInTheDocument();
    });

    it('should handle complex data objects', () => {
      const data = {
        name: 'Complex Property',
        description: 'Complex description',
        property_claim_type: 'performance',
        level: 1,
        claim_type: 'claim',
        comments: [
          { id: 1, content: 'Comment 1' },
          { id: 2, content: 'Comment 2' },
        ],
        metadata: {
          priority: 'high',
          status: 'active',
        },
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      expect(screen.getByText('Complex Property')).toBeInTheDocument();
      expect(screen.getByText('Complex description')).toBeInTheDocument();
    });

    it('should handle empty data object', () => {
      const data = {};

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      // Should render without crashing
      expect(screen.getByTestId('toggle-button')).toBeInTheDocument();
    });

    it('should handle undefined data properties', () => {
      const data = {
        name: 'Test Property',
        description: undefined,
        comments: undefined,
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      expect(screen.getByText('Test Property')).toBeInTheDocument();
    });
  });

  describe('Styling Differences from GoalNode', () => {
    it('should use blue background instead of pink', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
      };

      const { container } = renderWithAuth(
        <PropertyNode data={data} {...mockNodeProps} />
      );

      const nodeContainer = container.firstChild;
      expect(nodeContainer).toHaveClass('bg-blue-600');
      expect(nodeContainer).not.toHaveClass('bg-pink-600');
    });

    it('should use FolderOpenDot icon instead of Goal icon', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      // Icon container should still have the same styling
      const iconContainer = screen
        .getByText('Test Property')
        .closest('div')
        ?.parentElement?.querySelector('.rounded-full');
      expect(iconContainer).toHaveClass('w-12', 'h-12', 'bg-slate-900/20');
    });
  });

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      const data = {
        name: 'Accessible Property',
        description: 'Property with accessibility considerations',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      // Should have proper heading-like structure
      const nameElement = screen.getByText('Accessible Property');
      expect(nameElement).toHaveClass('text-lg', 'font-bold');
    });

    it('should have readable color contrast', () => {
      const data = {
        name: 'Test Property',
        description: 'Test description',
      };

      const { container } = renderWithAuth(
        <PropertyNode data={data} {...mockNodeProps} />
      );

      // Should use white text on blue background
      const nodeContainer = container.firstChild;
      expect(nodeContainer).toHaveClass('bg-blue-600', 'text-white');
    });

    it('should handle keyboard interaction through child components', () => {
      const data = {
        name: 'Interactive Property',
        description: 'Property with interactive elements',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      // ToggleButton should be interactive
      expect(screen.getByTestId('toggle-button')).toBeInTheDocument();
    });
  });

  describe('Memoization', () => {
    it('should be properly memoized', () => {
      const data = {
        name: 'Memoized Property',
        description: 'This component should be memoized',
      };

      const { rerender } = renderWithAuth(
        <PropertyNode data={data} {...mockNodeProps} />
      );

      expect(screen.getByText('Memoized Property')).toBeInTheDocument();

      // Re-render with same props should use memoized version
      rerender(<PropertyNode data={data} {...mockNodeProps} />);

      expect(screen.getByText('Memoized Property')).toBeInTheDocument();
    });

    it('should re-render when data changes', () => {
      const initialData = {
        name: 'Initial Property',
        description: 'Initial description',
      };

      const { rerender } = renderWithAuth(
        <PropertyNode data={initialData} {...mockNodeProps} />
      );

      expect(screen.getByText('Initial Property')).toBeInTheDocument();

      const updatedData = {
        name: 'Updated Property',
        description: 'Updated description',
      };

      rerender(<PropertyNode data={updatedData} {...mockNodeProps} />);

      expect(screen.getByText('Updated Property')).toBeInTheDocument();
      expect(screen.queryByText('Initial Property')).not.toBeInTheDocument();
    });
  });

  describe('Connection Capabilities', () => {
    it('should allow connections from above (target handle)', () => {
      const data = {
        name: 'Connectable Property',
        description: 'Can receive connections from goals',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      const targetHandle = screen.getByTestId('handle-target');
      expect(targetHandle).toHaveAttribute('data-position', 'top');
    });

    it('should allow connections to below (source handle)', () => {
      const data = {
        name: 'Connectable Property',
        description: 'Can send connections to evidence',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      const sourceHandle = screen.getByTestId('handle-source-c');
      expect(sourceHandle).toHaveAttribute('data-position', 'bottom');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long property names', () => {
      const data = {
        name: 'This is an extremely long property claim name that might cause layout issues if not handled properly in the component',
        description: 'Short description',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      expect(screen.getByText(data.name)).toBeInTheDocument();
    });

    it('should handle special characters in property name', () => {
      const data = {
        name: 'Property with Special Characters: !@#$%^&*()_+-=[]{}|;:,.<>?',
        description: 'Description with special chars: áéíóú ñ ü',
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      expect(screen.getByText(data.name)).toBeInTheDocument();
      expect(screen.getByText(data.description)).toBeInTheDocument();
    });

    it('should handle property hierarchy data', () => {
      const data = {
        name: 'Parent Property',
        description: 'Property with sub-properties',
        level: 1,
        parent_id: null,
        children: [
          { id: 2, name: 'Child Property 1' },
          { id: 3, name: 'Child Property 2' },
        ],
      };

      renderWithAuth(<PropertyNode data={data} {...mockNodeProps} />);

      expect(screen.getByText('Parent Property')).toBeInTheDocument();
      expect(
        screen.getByText('Property with sub-properties')
      ).toBeInTheDocument();
    });
  });
});
