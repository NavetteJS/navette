// Renderer of the `/lab` "Framework fields" quantity field: a Vue component mounted by Navette's `JsField`.
// Vue is loaded from the vendored runtime build (no CDN, no build step): the component uses render functions.
import { createApp, h, shallowRef } from '../../vendor/vue/vue.runtime.esm-browser.prod.js';

const QuantityStepper = {
    props: ['value', 'configuration', 'id', 'ariaDescribedBy', 'isDisabled', 'isReadOnly', 'isRequired', 'isInvalid', 'onChange', 'onBlur'],
    setup(props) {
        const step = () => props.configuration?.step ?? 1;
        const clamp = (value) => Math.min(props.configuration?.max ?? Infinity, Math.max(props.configuration?.min ?? -Infinity, value));
        const isLocked = () => props.isDisabled || props.isReadOnly;
        const change = (value) => props.onChange(value === null ? null : clamp(value));
        const button = (label, icon, delta) => h('button', {
            type: 'button',
            class: 'fi-icon-btn fi-size-md',
            'aria-label': label,
            'aria-controls': props.id,
            disabled: isLocked(),
            onClick: () => change((Number(props.value) || 0) + delta * step()),
        }, icon);

        return () => h('div', { class: ['fi-input-wrp', { 'fi-disabled': props.isDisabled, 'fi-invalid': props.isInvalid }] }, [
            h('div', { class: 'fi-input-wrp-prefix fi-input-wrp-prefix-has-content' }, [button('Decrease', '−', -1)]),
            h('div', { class: 'fi-input-wrp-content-ctn' }, [
                h('input', {
                    id: props.id,
                    class: 'fi-input',
                    type: 'number',
                    inputmode: 'numeric',
                    step: step(),
                    min: props.configuration?.min,
                    max: props.configuration?.max,
                    value: props.value ?? '',
                    disabled: props.isDisabled,
                    readonly: props.isReadOnly,
                    required: props.isRequired,
                    'aria-invalid': props.isInvalid ? 'true' : undefined,
                    'aria-describedby': props.ariaDescribedBy || undefined,
                    onInput: (event) => change(event.target.value === '' ? null : Number(event.target.value)),
                    onBlur: props.onBlur,
                }),
            ]),
            h('div', { class: 'fi-input-wrp-suffix fi-input-wrp-suffix-has-content' }, [button('Increase', '+', 1)]),
        ]);
    },
};

export default function mountQuantityStepper({ host, props: initialProps }) {
    const props = shallowRef(initialProps);
    const application = createApp({ setup: () => () => h(QuantityStepper, props.value) });

    application.mount(host);

    return {
        update(nextProps) {
            props.value = nextProps;
        },
        destroy: () => application.unmount(),
    };
}
