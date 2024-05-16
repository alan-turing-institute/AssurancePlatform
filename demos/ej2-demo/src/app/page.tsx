'use client'
import { DataManager, Query } from '@syncfusion/ej2-data';
import { StackPanel, TextElement, DataBinding, HierarchicalTree, DiagramComponent, Inject, NodeModel } from "@syncfusion/ej2-react-diagrams";
import { data } from '@/datasource';

export default function Home() {
  // let items: DataManager = new DataManager(data as JSON[], new Query().take(7));

  const nodes: any = [
    {
      id: 'start',
      offsetX: 100,
      offsetY: 100,
      shape: { type: 'Flow', shape: 'Terminator' },
      annotations: [{ content: 'Start' }]
    },
    {
      id: 'process',
      offsetX: 300,
      offsetY: 100,
      shape: { type: 'Flow', shape: 'Process' },
      annotations: [{ content: 'Process' }]
    },
    {
      id: 'datasource',
      offsetX: 500,
      offsetY: 200,
      shape: { type: 'Flow', shape: 'Data' },
      annotations: [{ content: 'Data Source' }]
    },
    {
      id: 'decision',
      offsetX: 500,
      offsetY: 100,
      shape: { type: 'Flow', shape: 'Decision' },
      annotations: [{ content: 'Decision' }]
    },
    {
      id: 'end',
      offsetX: 700,
      offsetY: 100,
      shape: { type: 'Flow', shape: 'Terminator' },
      annotations: [{ content: 'End' }]
    }
  ];

  // Define connectors for the flow chart
  const connectors = [
    { id: 'connector1', sourceID: 'start', targetID: 'process' },
    { id: 'connector2', sourceID: 'process', targetID: 'decision' },
    { id: 'connector3', sourceID: 'datasource', targetID: 'decision' }, // Connect datasource to decision
    { id: 'connector4', sourceID: 'decision', targetID: 'end' }
  ];


  return (
    <>
      <h2>Syncfusion React Diagram Component</h2>
      <DiagramComponent id="diagram" width="100%" height="500px" nodes={nodes} connectors={connectors}>
        <Inject services={[]} />
      </DiagramComponent>
    </>
  )
}
