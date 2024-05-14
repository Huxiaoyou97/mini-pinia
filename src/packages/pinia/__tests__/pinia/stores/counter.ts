import { defineStore } from '../../../src';

export const useCounterStore = defineStore('counter', {
    state() {
        return {
            count: 0,
        };
    },
    getters: {
        getCount(state) {
            return state.count;
        },
    },
    actions: {
        setCount(count: number) {
            this.count = count;
        },
    },
});
