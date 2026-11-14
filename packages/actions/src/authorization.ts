// Authorization responses: a policy decision that may carry a message (Laravel's `Illuminate\Auth\Access\Response`).

/**
 * Result of an authorization check. A policy rule may return one instead of a boolean, to explain a denial:
 * `update: (user, post) => post.locked ? AuthorizationResponse.deny('This post is locked.') : true`. The message is shown by
 * `authorizationTooltip()` and `authorizationNotification()`.
 */
export class AuthorizationResponse {
    private readonly _allowed: boolean;
    private readonly _message: string | null;
    private constructor(allowed: boolean, message: string | null) { this._allowed = allowed; this._message = message; }
    static allow(message: string | null = null): AuthorizationResponse { return new AuthorizationResponse(true, message); }
    static deny(message: string | null = null): AuthorizationResponse { return new AuthorizationResponse(false, message); }
    /** A boolean, a response or anything else (truthy allows) as a response. */
    static from(value: unknown): AuthorizationResponse {
        if (value instanceof AuthorizationResponse) return value;
        return value ? AuthorizationResponse.allow() : AuthorizationResponse.deny();
    }
    allowed(): boolean { return this._allowed; }
    denied(): boolean { return !this._allowed; }
    message(): string | null { return this._message; }
    /** The same decision with another message. */
    withMessage(message: string | null): AuthorizationResponse { return new AuthorizationResponse(this._allowed, message); }
}

/** Whether a value is an authorization response, or a boolean meaning "allowed". */
export const isAllowed = (value: unknown): boolean => (value instanceof AuthorizationResponse ? value.allowed() : Boolean(value));
