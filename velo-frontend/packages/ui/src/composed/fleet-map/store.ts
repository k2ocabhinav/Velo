import type { FleetMapDriver, FleetMapFocusRequest, FleetMapRide, FleetMapSelection } from "./types";

export interface FleetMapState {
  drivers: FleetMapDriver[];
  rides: FleetMapRide[];
  focusRequest: FleetMapFocusRequest | null;
}

export type FleetMapChange = "data" | "focus";
type Listener = (change: FleetMapChange) => void;

export class FleetMapStore {
  private state: FleetMapState;
  private readonly listeners = new Set<Listener>();
  private selectionChange: ((selection: FleetMapSelection) => void) | undefined;

  constructor(state: FleetMapState) {
    this.state = state;
  }

  getState(): FleetMapState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setData(drivers: FleetMapDriver[], rides: FleetMapRide[]): void {
    if (this.state.drivers === drivers && this.state.rides === rides) return;
    this.state = { ...this.state, drivers, rides };
    this.emit("data");
  }

  setFocusRequest(focusRequest: FleetMapFocusRequest | null): void {
    if (this.state.focusRequest?.sequence === focusRequest?.sequence) return;
    this.state = { ...this.state, focusRequest };
    this.emit("focus");
  }

  setSelectionChange(callback: ((selection: FleetMapSelection) => void) | undefined): void {
    this.selectionChange = callback;
  }

  select(selection: FleetMapSelection): void {
    this.selectionChange?.(selection);
  }

  private emit(change: FleetMapChange): void {
    for (const listener of this.listeners) listener(change);
  }
}
