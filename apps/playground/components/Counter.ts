import { Component } from '@navette/wire';
import { view } from '../view.ts';

export class Counter extends Component {
    count = 0;
    mount(params: Record<string, unknown>) { this.count = Number(params.start ?? 0); }
    increment() { this.count++; }
    decrement() { this.count--; }
    reset() { this.count = 0; this.dispatch('counter-reset', { at: this.count }); }
    render() { return view('counter', { count: this.count }); }
}
