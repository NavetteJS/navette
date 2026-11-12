import { Component } from '@navette-js/wire';
import { view } from '../view.ts';

/** Champ `live()` : validation à chaque frappe, propriété liée par Alpine ($wire.entangle), erreurs dans memo.errors. */
export class LiveField extends Component {
    name = '';
    items: string[] = [];
    open = false;

    updatedName(value: string) {
        this.resetErrorBag();
        if (value.length > 0 && value.length < 3) this.addError('name', 'The name field must be at least 3 characters.');
    }
    add() {
        this.updatedName(this.name);
        if (this.name === '' ) this.addError('name', 'The name field is required.');
        if (Object.keys(this._errors).length) return;
        this.items.push(this.name);
        this.name = '';
    }
    remove(index: number) { this.items.splice(index, 1); }
    render() { return view('live-field', { name: this.name, items: this.items, open: this.open, errors: this._errors }); }
}
