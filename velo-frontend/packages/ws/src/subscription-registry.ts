import type { Client, IFrame } from "@stomp/stompjs";
import type { StompFrameHandler, StompSubscriptionHandle } from "./stomp-client";

type ConnectHandler = Client["onConnect"];

interface DestinationEntry {
  handlers: Map<StompFrameHandler, number>;
  subscription?: StompSubscriptionHandle;
}

interface ClientSubscriptionsState {
  destinations: Map<string, DestinationEntry>;
  baseOnConnect: ConnectHandler;
  wrappedOnConnect: (frame: IFrame) => void;
}

const subscriptionsByClient = new WeakMap<Client, ClientSubscriptionsState>();

function ensureState(client: Client): ClientSubscriptionsState {
  const existing = subscriptionsByClient.get(client);
  if (existing) {
    return existing;
  }

  const state: ClientSubscriptionsState = {
    destinations: new Map<string, DestinationEntry>(),
    baseOnConnect: typeof client.onConnect === "function" ? client.onConnect : () => undefined,
    wrappedOnConnect: (frame: IFrame) => {
      state.baseOnConnect(frame);
      subscribeAllDestinations(client, state);
    },
  };

  subscriptionsByClient.set(client, state);
  client.onConnect = state.wrappedOnConnect;
  return state;
}

function subscribeAllDestinations(client: Client, state: ClientSubscriptionsState): void {
  for (const [destination, entry] of state.destinations) {
    subscribeDestination(client, destination, entry);
  }
}

function subscribeDestination(client: Client, destination: string, entry: DestinationEntry): void {
  if (!client.connected || entry.handlers.size === 0) {
    return;
  }

  // on reconnect, replace any stale subscription before re-subscribing.
  entry.subscription?.unsubscribe();
  entry.subscription = client.subscribe(destination, (message) => {
    for (const [handler, registrationCount] of entry.handlers) {
      for (let index = 0; index < registrationCount; index += 1) {
        handler(message);
      }
    }
  });
}

function decrementRegistrationCount(
  handlers: Map<StompFrameHandler, number>,
  handler: StompFrameHandler,
): void {
  const registrationCount = handlers.get(handler);
  if (!registrationCount) {
    return;
  }

  if (registrationCount <= 1) {
    handlers.delete(handler);
    return;
  }

  handlers.set(handler, registrationCount - 1);
}

function resetClientOnConnect(client: Client, state: ClientSubscriptionsState): void {
  if (client.onConnect === state.wrappedOnConnect) {
    client.onConnect = state.baseOnConnect;
  }
}

export function registerStompSubscription(
  client: Client,
  destination: string,
  handler: StompFrameHandler,
): () => void {
  const state = ensureState(client);
  const entry = state.destinations.get(destination) ?? { handlers: new Map<StompFrameHandler, number>() };

  entry.handlers.set(handler, (entry.handlers.get(handler) ?? 0) + 1);
  state.destinations.set(destination, entry);

  if (!entry.subscription) {
    subscribeDestination(client, destination, entry);
  }

  return () => {
    const currentEntry = state.destinations.get(destination);
    if (!currentEntry) {
      return;
    }

    decrementRegistrationCount(currentEntry.handlers, handler);

    if (currentEntry.handlers.size > 0) {
      return;
    }

    currentEntry.subscription?.unsubscribe();
    state.destinations.delete(destination);

    if (state.destinations.size === 0) {
      resetClientOnConnect(client, state);
      subscriptionsByClient.delete(client);
    }
  };
}
