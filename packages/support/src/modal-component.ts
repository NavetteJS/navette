// App-wide defaults of every modal (Filament's `Filament\Support\View\Components\ModalComponent`): action modals and the
// standalone `modal()` / `<x-modal>` component use them unless they set their own value.

export class ModalComponent {
    /** Whether modals have a close button in their header. */
    static hasCloseButton = true;
    /** Whether clicking outside a modal closes it. */
    static isClosedByClickingAway = true;
    /** Whether the Escape key closes a modal. */
    static isClosedByEscaping = true;
    /** Whether the first focusable element of a modal is focused when it opens. */
    static isAutofocused = true;

    /** `ModalComponent.closeButton(false)`: no close button in any modal header, unless a modal asks for one. */
    static closeButton(condition = true): void { this.hasCloseButton = condition; }
    /** `ModalComponent.closedByClickingAway(false)`: clicking outside a modal no longer closes it. */
    static closedByClickingAway(condition = true): void { this.isClosedByClickingAway = condition; }
    /** `ModalComponent.closedByEscaping(false)`: the Escape key no longer closes modals. */
    static closedByEscaping(condition = true): void { this.isClosedByEscaping = condition; }
    /** `ModalComponent.autofocus(false)`: nothing is focused when a modal opens. */
    static autofocus(condition = true): void { this.isAutofocused = condition; }
}
