export interface ViewBox {
    minX: number;
    minY: number;
    width: number;
    height: number;
}

export const viewBoxValues: ViewBox = {
    minX: 200,
    minY: -50,
    width: 900,
    height: 450,
};

export const PLACE_RADIUS = 25;
export const TRANSITION_SIZE = 60;

export const GRAPH_IDS = {
    PETRI_NET: 'petri-net',
    REACHABILITY: 'reachability-graph',
    PROCESS_NET: 'process-net',
} as const;

export type GraphId = (typeof GRAPH_IDS)[keyof typeof GRAPH_IDS];

export const GRAPH_FILENAMES: Record<GraphId, string> = {
    [GRAPH_IDS.PETRI_NET]: 'petri-net',
    [GRAPH_IDS.REACHABILITY]: 'reachability-graph',
    [GRAPH_IDS.PROCESS_NET]: 'process-net',
};

export const VIEW_MODES = {
    SIMPLE: 'simple',
    DESCRIPTIVE: 'descriptive',
} as const;

export type ViewMode = (typeof VIEW_MODES)[keyof typeof VIEW_MODES];
