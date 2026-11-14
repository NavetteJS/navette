// `/lab/welcome`: a page whose `mount()` sends a notification, shown on that page. Not in the navigation; left out of the
// parity screenshots (NAVETTE_NO_THEMES).
import { Notification, Page } from '@navette-js/panels';

export class LabWelcomePage extends Page {
    static slug = 'welcome';
    static title = 'Welcome';
    static shouldRegisterNavigation = false;

    async mount(): Promise<void> {
        Notification.make().title('Welcome back').body('Sent while the page was rendering.').success().send();
    }
}
