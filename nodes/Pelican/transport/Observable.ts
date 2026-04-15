export class Observable<Events extends Record<
    string, // The name of the event
    readonly unknown[] // Arguments passed to the event listeners
>> {
    private readonly listeners = new Map<keyof Events, Set<(...args: Events[keyof Events]) => void>>();

    private listenersForEvent<K extends keyof Events>(event: K): Set<(...args: Events[K]) => void> {
        let listeners = this.listeners.get(event);
        if (!listeners) {
            listeners = new Set();
            this.listeners.set(event, listeners);
        }
        return listeners;
    }

    on<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void, signal: AbortSignal): void {
        const listeners = this.listenersForEvent(event);
        listeners.add(listener);
        signal.addEventListener('abort', () => listeners.delete(listener));
    }

    protected emit<K extends keyof Events>(event: K, ...args: Events[K]): void {
        const listeners = this.listeners.get(event) ?? [];
        for (const listener of listeners) {
            listener(...args);
        }
    }
}
