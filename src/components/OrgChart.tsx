import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export function OrgChart({ employees }: { employees: any[] }) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Simple auto-layout algorithm for the tree
    const levelWidth = new Map<number, number>();
    const levelCounts = new Map<number, number>();

    // Build hierarchy
    const employeeMap = new Map();
    employees.forEach(e => employeeMap.set(e.full_name, { ...e, children: [] }));

    let rootNodes: any[] = [];
    employees.forEach(e => {
      if (e.reporting_manager && employeeMap.has(e.reporting_manager)) {
        employeeMap.get(e.reporting_manager).children.push(employeeMap.get(e.full_name));
        edges.push({
          id: `e-${e.reporting_manager}-${e.full_name}`,
          source: e.reporting_manager,
          target: e.full_name,
          animated: true,
          style: { stroke: '#6366f1', strokeWidth: 2 }
        });
      } else {
        rootNodes.push(employeeMap.get(e.full_name));
      }
    });

    const calculatePositions = (node: any, level: number, xOffset: number) => {
      const currentLevelCount = levelCounts.get(level) || 0;
      const x = currentLevelCount * 250 + xOffset;
      const y = level * 150;

      levelCounts.set(level, currentLevelCount + 1);

      nodes.push({
        id: node.full_name,
        position: { x, y },
        data: {
          label: (
            <div className="flex flex-col items-center p-2 min-w-[150px]">
              <div className="size-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mb-2 shadow-sm border border-indigo-200">
                {node.full_name.charAt(0)}
              </div>
              <div className="font-bold text-sm text-slate-800 dark:text-slate-200">{node.full_name}</div>
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mt-1">{node.designation || 'Employee'}</div>
              <div className="text-[9px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full mt-2 text-slate-500">{node.department || 'General'}</div>
            </div>
          )
        },
        style: {
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        }
      });

      node.children.forEach((child: any, idx: number) => {
        calculatePositions(child, level + 1, xOffset + (idx * 50));
      });
    };

    rootNodes.forEach((root, idx) => {
      calculatePositions(root, 0, idx * 300);
    });

    return { nodes, edges };
  }, [employees]);

  if (nodes.length === 0) {
    return <div className="h-full flex items-center justify-center text-muted-foreground font-bold">No organizational data available.</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.2}>
        <Background gap={16} size={1} color="#e2e8f0" />
        <Controls />
        <MiniMap zoomable pannable nodeColor="#cbd5e1" maskColor="rgba(0,0,0,0.05)" />
      </ReactFlow>
    </div>
  );
}
