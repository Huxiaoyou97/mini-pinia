// @author 胡小右
// @date 2024/05/14 12:22:38
// @desc Pinia 根 store 类型文件

import { App, EffectScope, hasInjectionContext, inject, InjectionKey, Ref } from 'vue-demi';
import {
    _ActionsTree,
    _GettersTree,
    DefineStoreOptionsInPlugin,
    PiniaCustomProperties,
    PiniaCustomStateProperties,
    StateTree,
    Store,
    StoreGeneric,
} from './types.ts';

const __DEV__ = true;
// 当前活动的 Pinia 实例
export let activePinia: Pinia | undefined;

// 设置或取消设置活动的 Pinia 实例。用于 SSR 和内部调用 actions 和 getters 时使用
export const setActivePinia = (pinia: Pinia | undefined) => (activePinia = pinia);

// 获取当前活动的 Pinia 实例(如果有的话)
export const getActivePinia = () => (hasInjectionContext() && inject(piniaSymbol)) || activePinia;

// 每个应用程序都必须拥有自己的 Pinia 实例才能创建 store
export interface Pinia {
    install: (app: App) => void;

    // 根状态
    state: Ref<Record<string, StateTree>>;

    // 已安装的 store 插件
    _p: PiniaPlugin[];

    // 链接到此 Pinia 实例的应用程序
    _a: App;

    // Pinia 实例所附加的 EffectScope
    _e: EffectScope;

    // 此 Pinia 实例使用的 store 注册表
    _s: Map<string, StoreGeneric>;

    // 由 `createTestingPinia()` 添加,用于绕过 `useStore(pinia)`
    _testing?: boolean;

    // 添加一个 store 插件来扩展每个 store
    use(plugin: PiniaPlugin): Pinia;
}

// Pinia 的注入键
export const piniaSymbol = (
    __DEV__ ? Symbol('pinia') : /* istanbul ignore next */ Symbol()
) as InjectionKey<Pinia>;

// 传递给 Pinia 插件的上下文参数
export interface PiniaPluginContext<
    Id extends string = string,
    S extends StateTree = StateTree,
    G = _GettersTree<S>,
    A = _ActionsTree,
> {
    // Pinia 实例
    pinia: Pinia;

    // 使用 `Vue.createApp()` 创建的当前应用程序
    app: App;

    // 当前正在扩展的 store
    store: Store<Id, S, G, A>;

    // 调用 `defineStore()` 时定义 store 的初始选项
    options: DefineStoreOptionsInPlugin<Id, S, G, A>;
}

// 用于扩展每个 store 的插件
export interface PiniaPlugin {
    // 用于扩展每个 store 的插件。返回一个对象来扩展 store 或不返回任何内容
    // context: 插件上下文
    (
        context: PiniaPluginContext
    ): Partial<PiniaCustomProperties & PiniaCustomStateProperties> | void;
}

// 用于扩展每个 store 的插件 使用 PiniaPlugin 代替
export type PiniaStorePlugin = PiniaPlugin;
