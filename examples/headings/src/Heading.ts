import { Component, type ComponentContext } from '@navette-js/schemas';
import { configured, evaluate, views, type Lazy } from '@navette-js/support';

const LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;
type Level = (typeof LEVELS)[number];

/**
 * A heading in any schema (forms, infolists, pages): `Heading.make(2).content('Product information').color('primary')`.
 * Load its stylesheet with `headingsStylesheet()`.
 */
export class Heading extends Component {
    protected _level: Level = 'h2';
    protected _content: Lazy<string, ComponentContext> = '';
    protected _color: Lazy<string | null, ComponentContext> = 'primary';

    constructor(level: number | Level) {
        super();
        this.level(level);
    }

    static make(level: number | Level = 2): Heading {
        return configured(new Heading(level));
    }

    level(level: number | Level): this {
        const tag = typeof level === 'number' ? `h${level}` : level;
        if (!(LEVELS as readonly string[]).includes(tag)) throw new Error(`Heading: invalid level ${level}.`);
        this._level = tag as Level;
        return this;
    }

    getLevel(): Level {
        return this._level;
    }

    /** Text of the heading; a function receives the schema's context object (`record`, `get`, `operation`…). */
    content(content: Lazy<string, ComponentContext>): this {
        this._content = content;
        return this;
    }

    /** A panel color (`primary`, `success`, `gray`…), or `null` for the text color. */
    color(color: Lazy<string | null, ComponentContext>): this {
        this._color = color;
        return this;
    }

    async toHtml(): Promise<string> {
        const context = this.context();
        const color = await evaluate(this._color, context);

        return views.render('headings::heading', {
            level: this._level,
            content: String((await evaluate(this._content, context)) ?? ''),
            // Only a color name can reach the style attribute.
            color: typeof color === 'string' && /^[a-z]+$/.test(color) ? color : null,
        });
    }
}
