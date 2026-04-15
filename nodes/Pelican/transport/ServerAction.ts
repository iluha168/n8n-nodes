export const ServerActions = ['start', 'stop', 'restart', 'kill'] as const
export type ServerAction = typeof ServerActions[number];

export function includes<T, U>(array: readonly T[], searchElement: U): searchElement is T & U {
    const array_: readonly (U | T)[] = array
    return array_.includes(searchElement);
}

export function asServerAction(action: string): ServerAction {
    if (includes(ServerActions, action)) {
        return action;
    }
    throw new Error(`'${action}' is not a valid action`);
}

