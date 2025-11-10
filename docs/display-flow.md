# Display Flow Documentation

This document explains the process of how a Petri net or other graph structures are displayed in the application.

## Architectural Rationale

This architecture is deliberately designed for **extensibility**, **maintainability**, and **testability** by following key software design principles. It is a form of lightweight, service-based state management that is ideal for this application's scope.

- **Separation of Concerns**: Each service has a single responsibility.
    - `PetriNetLoaderService`: Only loads and parses files.
    - `SourcePetriNetService`: Only stores the master copy (the "Single Source of Truth") of the original `Diagram`.
    - `DisplayService`: Only manages the _currently visible_ `DisplayableGraph`.
    - `Components`: Only delegate logic and react to state changes.
- **Single Source of Truth (SSoT)**: The `SourcePetriNetService` acts as the "master record." All computational services (like `ReachabilityGraphService`) _must_ read from this service, ensuring data consistency across the app.
- **Extensibility (Open/Closed Principle)**: This design allows new features (like a Process Net or Reachability Graph) to be added by creating a new `ProcessNetService` and adjusting the already existing `ProcessNetComponent`. Existing, working code in other services does not need to be changed.

## Loading and Initial Display Workflow

1.  **File Loading**: The process starts when a user provides a file. This can happen via drag-and-drop onto the `DisplayComponent` or through a file upload component.
2.  **`PetriNetLoaderService`**: The `DisplayComponent` calls the `PetriNetLoaderService` with the file or file URL.
3.  **Reading and Parsing**:
    - The `PetriNetLoaderService` uses `FileReaderService` (for local files) or `HttpClient` (for URLs) to get the file content as a string.
    - The content is then passed to the `ParserService`, which parses the string (e.g., from `.json` format) into a `Diagram` object.
4.  **Updating Services**:
    - The newly created `Diagram` object is passed to `SourcePetriNetService.setSourceNet()`. This establishes it as the current "source" or "master" Petri net.
    - Simultaneously, the `Diagram` is passed to `DisplayService.display()`.
5.  **`DisplayService`**:
    - The `DisplayService` holds a `BehaviorSubject` (`diagram$`) that emits `DisplayableGraph` objects.
    - When `display()` is called, it pushes the new graph to its `diagram$` stream.
6.  **`DisplayComponent`**:
    - The `DisplayComponent` subscribes to `DisplayService.diagram$`.
    - When a new `DisplayableGraph` is emitted, the component updates its internal `diagram` signal.
    - The component's template (`display.component.html`) uses `@for` loops to iterate over the nodes and edges of the `diagram` signal and renders them using the `appSvgNode` and `appSvgArc` child components.

## Switching Views and Displaying Different Graphs per Tab

The ability to show different graphs is achieved by making each tab component responsible for updating the `DisplayService` when it becomes active, orchestrated by the `TabStateService`.

1.  **The Trigger**: The `TabStateService` exposes the currently active tab via a signal (`currentTab()`).
2.  **The Reaction**: Each main tab component (e.g., `DrawComponent`, `ReachabilityGraphComponent`) uses an `effect()` to react to changes in this signal.
3.  **The Action**: Inside its `effect()`, the component checks if _its own tab_ has just become active. If so, it takes the appropriate action to update the `DisplayService`.

### Example Workflows

- **Scenario 1: "Draw" or "Play" Tab Becomes Active**
    - The `effect()` inside `DrawComponent` (or `PlayComponent`) triggers.
    - It checks if its tab is active (e.g., `this._tabStateService.currentTab() === Tab.DRAW`).
    - If `true`, it fetches the original net directly from `SourcePetriNetService.getCurrentSourceNet()`.
    - It then calls `DisplayService.display(sourceNet)` to ensure the original Petri net is shown.
- **Scenario 2: "Reachability Graph" Tab Becomes Active**
    - The `effect()` inside `ReachabilityGraphComponent` triggers.
    - It checks if its tab is active (`this._tabStateService.currentTab() === Tab.REACHABILITY_GRAPH`).
    - If `true`, it should call the specific calculation service
    - **Note:** The functionality to compute and display the reachability graph (`ReachabilityGraphService.generateAndDisplay()`) is planned for future implementation.

### Summary

The `DisplayComponent` remains simple, rendering whatever the `DisplayService` provides. The logic for _what_ to display is encapsulated within each respective tab component, which is triggered by the `TabStateService`. This keeps concerns separate and makes the system easy to extend with new computational tabs.
