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

export const GRAPH_FILENAMES = {
    [GRAPH_IDS.PETRI_NET]: 'petri-netz',
    [GRAPH_IDS.REACHABILITY]: 'erreichbarkeitsgraph',
    [GRAPH_IDS.PROCESS_NET]: 'prozessnetz',
} as const;
