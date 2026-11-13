// Navette: WebAuthn ceremonies of the SecurityKeyInput field (security keys and passkeys). No dependency.
document.addEventListener('alpine:init', () => {
    const toBuffer = (value) => {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
        return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (character) => character.charCodeAt(0)).buffer;
    };
    const toBase64url = (buffer) => {
        let binary = '';
        for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    const withIds = (credentials) => (credentials ?? []).map((credential) => ({ ...credential, id: toBuffer(credential.id) }));
    const creationOptions = (options) => (typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function'
        ? PublicKeyCredential.parseCreationOptionsFromJSON(options)
        : { ...options, challenge: toBuffer(options.challenge), user: { ...options.user, id: toBuffer(options.user.id) }, excludeCredentials: withIds(options.excludeCredentials) });
    const requestOptions = (options) => (typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function'
        ? PublicKeyCredential.parseRequestOptionsFromJSON(options)
        : { ...options, challenge: toBuffer(options.challenge), allowCredentials: withIds(options.allowCredentials) });
    const serialize = (credential) => {
        try { if (typeof credential.toJSON === 'function') return credential.toJSON(); } catch (error) { /* some password managers return incomplete objects */ }
        const response = credential.response;
        const result = { id: credential.id, rawId: toBase64url(credential.rawId), type: credential.type, response: { clientDataJSON: toBase64url(response.clientDataJSON) } };
        if (response.attestationObject) {
            result.response.attestationObject = toBase64url(response.attestationObject);
            result.response.transports = typeof response.getTransports === 'function' ? response.getTransports() : [];
        } else {
            result.response.authenticatorData = toBase64url(response.authenticatorData);
            result.response.signature = toBase64url(response.signature);
            result.response.userHandle = response.userHandle ? toBase64url(response.userHandle) : null;
        }
        return result;
    };

    window.Alpine.data('navetteSecurityKey', ({ state, mode, key, submitOnSuccess, autoStart, messages }) => ({
        state,
        isWaiting: false,
        isError: false,
        message: null,
        init() {
            if (autoStart && !this.state) this.$nextTick(() => this.start(true));
        },
        async start(isAutomatic = false) {
            if (this.isWaiting) return;
            if (!window.PublicKeyCredential || !navigator.credentials) { this.fail(messages.unsupported); return; }
            this.isWaiting = true;
            this.isError = false;
            this.message = messages.waiting;
            try {
                const options = await this.$wire.callSchemaComponentMethod(key, 'getPublicKeyOptions', {});
                if (!options) throw new Error('No options.');
                const credential = mode === 'register'
                    ? await navigator.credentials.create({ publicKey: creationOptions(options) })
                    : await navigator.credentials.get({ publicKey: requestOptions(options) });
                if (!credential) throw new Error('No credential.');
                this.state = JSON.stringify(serialize(credential));
                this.message = messages.success;
                if (submitOnSuccess) this.$nextTick(() => this.$root.closest('form')?.requestSubmit());
            } catch (error) {
                // An automatic start may be refused without a click: the button stays there, without an error.
                if (isAutomatic && error?.name === 'NotAllowedError') this.message = null;
                else if (['NotAllowedError', 'AbortError'].includes(error?.name)) this.fail(messages.cancelled);
                else { console.error(error); this.fail(messages.failed); }
            } finally {
                this.isWaiting = false;
            }
        },
        fail(text) {
            this.isError = true;
            this.message = text;
        },
    }));
});
