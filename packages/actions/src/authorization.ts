// Authorization responses: a policy decision that may carry a message.

/**
 * Result of an authorization check. A policy rule may return one instead of a boolean, to explain a denial:
 * `update: (user, post) => post.locked ? AuthorizationResponse.deny('This post is locked.') : true`. The message is shown by
 * `authorizationTooltip()` and `authorizationNotification()`.
 */
export class AuthorizationResponse {
    protected readonly _allowed: boolean;
    protected readonly _message: string | null;
    protected constructor(allowed: boolean, message: string | null) { this._allowed = allowed; this._message = message; }
    static allow(message: string | null = null): AuthorizationResponse { return new AuthorizationResponse(true, message); }
    static deny(message: string | null = null): AuthorizationResponse { return new AuthorizationResponse(false, message); }
    /** A boolean, a response or anything else (truthy allows) as a response. */
    static from(value: unknown): AuthorizationResponse {
        if (value instanceof AuthorizationResponse) return value;
        return value ? AuthorizationResponse.allow() : AuthorizationResponse.deny();
    }
    allowed(): boolean { return this._allowed; }
    denied(): boolean { return !this._allowed; }
    /**
     * The message. A `DenyResponse` built with a message function computes it from the number of records denied with its key
     * and the number of selected records (1 and 1 outside a bulk action).
     */
    message(_failureCount = 1, _totalCount = 1): string | null { return this._message; }
    /** The same decision with another message. */
    withMessage(message: string | null): AuthorizationResponse { return new AuthorizationResponse(this._allowed, message); }
}

/** Message of a `DenyResponse`: a text, or a function of the number of records denied with its key and of the records selected. */
export type DenyMessage = string | ((failureCount: number, totalCount: number) => string | null | undefined);

/**
 * A denial identified by a key. In a bulk action using `authorizeIndividualRecords()`, the records
 * denied with the same key are grouped, and the failure notification shows one message per key, computed from the number of
 * records denied with that key and the number selected:
 * `DenyResponse.make('cannot_delete_admin', (failureCount, totalCount) => `${failureCount} of the selected users were admins.`)`.
 */
export class DenyResponse extends AuthorizationResponse {
    private _key: string | null;
    private _getMessageUsing: ((failureCount: number, totalCount: number) => string | null | undefined) | null;
    protected constructor(key: string | null, message: DenyMessage | null) {
        super(false, typeof message === 'string' ? message : null);
        this._key = key;
        this._getMessageUsing = typeof message === 'function' ? message : null;
    }
    /** A denial with a key and a message: a text, or a function of the failure count and of the total count. */
    static make(key: string, message: DenyMessage): DenyResponse { return new DenyResponse(key, message); }
    key(key: string | null): this { this._key = key; return this; }
    getKey(): string | null { return this._key; }
    /** Computes the message from the number of records denied with this key and the number selected. */
    getMessageUsing(callback: ((failureCount: number, totalCount: number) => string | null | undefined) | null): this { this._getMessageUsing = callback; return this; }
    override message(failureCount = 1, totalCount = 1): string | null {
        if (this._getMessageUsing) return this._getMessageUsing(failureCount, totalCount) ?? this._message;
        return this._message;
    }
    override withMessage(message: string | null): AuthorizationResponse { return new DenyResponse(this._key, message); }
}

/** Whether a value is an authorization response, or a boolean meaning "allowed". */
export const isAllowed = (value: unknown): boolean => (value instanceof AuthorizationResponse ? value.allowed() : Boolean(value));
