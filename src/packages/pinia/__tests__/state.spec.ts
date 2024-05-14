import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, defineStore, setActivePinia } from '../src';

describe('State', () => {
    beforeEach(() => {
        const pinia = createPinia();
        setActivePinia(pinia);
    });

    const useStore = defineStore('main', {
        state: () => ({
            name: 'Eduardo',
            counter: 0,
            nested: { n: 0 },
        }),
    });

    it('can directly access state at the store level', () => {
        const store = useStore(); // 调用 useStore 函数获取 store 实例
        const name = store.$state.name; // 获取 store 实例的 name 属性
        console.log(name, '---------name');
        expect(store.name).toBe('Eduardo');
        store.name = 'Ed';
        expect(store.name).toBe('Ed');
    });
});
