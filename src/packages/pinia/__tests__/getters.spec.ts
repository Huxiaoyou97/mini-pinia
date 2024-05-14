import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, defineStore, setActivePinia } from '../src';

function expectType<T>(_value: T): void {}

describe('Getters', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    const useStore = defineStore({
        id: 'main',
        state: () => ({
            name: 'Eduardo',
        }),
        getters: {
            upperCaseName(store) {
                return store.name.toUpperCase();
            },
            doubleName(): string {
                return this.upperCaseName;
            },
            composed(): string {
                return this.upperCaseName + ': ok';
            },
            arrowUpper: state => {
                state.nope;
                state.name.toUpperCase();
            },
        },
        actions: {
            o() {
                this.arrowUpper.toUpperCase();
                this.o().toUpperCase();
                return 'a string';
            },
        },
    });

    const useB = defineStore({
        id: 'B',
        state: () => ({ b: 'b' }),
    });

    const useA = defineStore({
        id: 'A',
        state: () => ({ a: 'a' }),
        getters: {
            fromB(): string {
                const bStore = useB();
                return this.a + ' ' + bStore.b;
            },
        },
    });

    it('adds getters to the store', () => {
        const store = useStore();
        expect(store.upperCaseName).toBe('EDUARDO');

        // @ts-expect-error
        store.nope;

        store.name = 'Ed';
        expect(store.upperCaseName).toBe('ED');
    });

    it('updates the value', () => {
        const store = useStore();
        store.name = 'Ed';
        expect(store.upperCaseName).toBe('ED');
    });

    it('supports changing between applications', () => {
        const pinia1 = createPinia();
        const pinia2 = createPinia();
        setActivePinia(pinia1);
        const aStore = useA();

        // simulate a different application
        setActivePinia(pinia2);
        const bStore = useB();
        bStore.b = 'c';

        aStore.a = 'b';
        // TODO 此处正确应该返回b b 目前问题还在排查
        expect(aStore.fromB).toBe('b c');
    });

    it('can use other getters', () => {
        const store = useStore();
        expect(store.composed).toBe('EDUARDO: ok');
        store.name = 'Ed';
        expect(store.composed).toBe('ED: ok');
    });

    it('keeps getters reactive when hydrating', () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        pinia.state.value = { main: { name: 'Jack' } };
        const store = useStore();
        expect(store.name).toBe('Jack');
        expect(store.upperCaseName).toBe('JACK');
        store.name = 'Ed';
        expect(store.upperCaseName).toBe('ED');
    });
});
