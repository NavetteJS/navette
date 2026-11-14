// `/lab/actions`: action features (policy messages, rate limits, links opening an action, modal options, nested actions,
// JavaScript actions). Left out of the parity screenshots (NAVETTE_NO_THEMES).
import { Action, ActionGroup, AuthorizationResponse } from '@navette-js/actions';
import { TextInput } from '@navette-js/forms';
import { Notification, Page } from '@navette-js/panels';
import { Actions, Grid, Section, type Schema } from '@navette-js/schemas';
import { e, HtmlString } from '@navette-js/support';

export class LabActionsPage extends Page {
    static slug = 'actions';
    static title = 'Actions';
    static navigationIcon = 'o-cursor-arrow-rays';
    static navigationGroup = 'Forms';
    static navigationSort = 90;

    /** State of the form of the content schema. */
    title = '';
    slug = '';
    static callable = ['mountAction', 'unmountAction', 'callMountedAction', 'callSchemaComponentMethod'];

    getSubheading(): string { return 'Open an action from a link: /lab/actions?action=feedback&actionArguments[topic]=billing'; }

    contentSchema(schema: Schema): Schema {
        return schema.components([
            Section.make('JavaScript actions').schema([
                Grid.make(3).schema([
                    TextInput.make('title').label('Title'),
                    TextInput.make('slug').label('Slug'),
                    // Runs in the browser: no request, `$get()` / `$set()` read and change the fields.
                    Actions.make([
                        Action.make('generateSlug').label('Generate slug').icon('m-link').color('gray')
                            .actionJs("$set('slug', ($get('title') ?? '').toLowerCase().trim().replaceAll(' ', '-'))")
                            .extraAttributes({ 'data-cy': 'generate-slug' }),
                    ]).verticalAlignment('end'),
                ]),
            ]),
        ]);
    }

    getHeaderActions(): Action[] {
        return [
            // Opened from a link with its arguments: `?action=feedback&actionArguments[topic]=billing`.
            Action.make('feedback').label('Feedback').icon('m-chat-bubble-left')
                .modalHeading(({ arguments: args }) => `Feedback about ${typeof args.topic === 'string' && args.topic ? args.topic : 'anything'}`)
                .schema([TextInput.make('message').required()])
                .action(({ data, arguments: args }) => { Notification.make().success().title('Thanks for your feedback').body(`${String(args.topic ?? 'general')}: ${String(data.message)}`).send(); }),
            // Rate limited: two clicks a minute.
            Action.make('ping').label('Ping').icon('m-signal').color('gray').rateLimit(2)
                .rateLimitedNotificationTitle('Slow down!')
                .action(() => { Notification.make().success().title('Pong').send(); }),
            ActionGroup.make([
                // Denied with a message: disabled, the message as tooltip.
                Action.make('lockedAction').label('Archive (locked)').icon('m-lock-closed')
                    .authorize(() => AuthorizationResponse.deny('Archiving is locked during the demo.')).authorizationTooltip()
                    .action(() => { Notification.make().title('Archived').send(); }),
                // Denied with a message: clickable, the message as notification.
                Action.make('restrictedAction').label('Export (restricted)').icon('m-arrow-down-tray')
                    .authorize(() => AuthorizationResponse.deny('Exports need the admin role.')).authorizationNotification()
                    .action(() => { Notification.make().title('Exported').send(); }),
                // Denied without message: hidden.
                Action.make('hiddenAction').label('Hidden').authorize(() => false).action(() => {}),
            ]).label('Restricted').icon('m-shield-check').button().color('gray').dropdownAutoPlacement().dropdownMaxHeight('16rem'),
            // Modal options: eyebrow, custom content with an action, content footer, slide-over from the start, extra attributes.
            Action.make('advance').label('Advance order').icon('m-forward').color('warning')
                .modalEyebrow('Order workflow').modalHeading('Order #1042').modalIcon('o-truck').modalIconColor('info')
                .registerModalActions([
                    Action.make('report').label('Report a problem').color('danger').requiresConfirmation().overlayParentActions()
                        .action(() => { Notification.make().warning().title('Problem reported').send(); }),
                ])
                .modalContent(async (ctx) => new HtmlString(`<p class="nv-modal-description" data-cy="advance-content">${e('The order moves to "Shipped".')}</p><div class="nv-ac" data-cy="advance-report">${await ctx.action!.renderModalAction('report', ctx)}</div>`))
                .modalContentFooter(new HtmlString('<p class="nv-modal-description" data-cy="advance-footer">The customer is notified by email.</p>'))
                .slideOver().slideOverPosition('start')
                .extraModalWindowAttributes({ 'data-cy': 'advance-window' })
                .modalSubmitAction((submit) => submit.label('Advance'))
                .action(() => { Notification.make().success().title('Order advanced').send(); }),
            // Nested actions: parent data, a submit button with arguments, a child cancelling its parent when closed.
            Action.make('note').label('Write a note').icon('m-pencil-square').color('gray')
                .schema([TextInput.make('text').label('Note').required()])
                .extraModalFooterActions((parent) => [
                    parent.makeModalSubmitAction('saveDraft', { draft: true }).label('Save as draft'),
                    Action.make('fillTemplate').label('Use template').color('gray')
                        .action(({ parentAction }) => parentAction!.fillData({ text: 'Call the customer back.' })),
                    Action.make('discard').label('Discard').color('danger').requiresConfirmation().cancelParentActions().cancelParentActionsOnClose()
                        .action(({ parentAction }) => { Notification.make().title(`Discarded: ${String(parentAction!.getRawData().text ?? '')}`).send(); }),
                ])
                .action(({ data, arguments: args }) => { Notification.make().success().title(args.draft ? 'Draft saved' : 'Note saved').body(String(data.text)).send(); }),
            // The page behind stays usable; no autofocus.
            Action.make('peek').label('Peek').icon('m-eye').color('gray').modalHeading('Peek').modalDescription('The page behind stays usable.')
                .modalClickThrough().modalAutofocus(false).modalSubmitAction(false).modalCancelAction((cancel) => cancel.label('Close'))
                .extraModalOverlayAttributes({ 'data-cy': 'peek-overlay' }),
        ];
    }
}
