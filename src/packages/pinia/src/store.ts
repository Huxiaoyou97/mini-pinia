import {
    DebuggerEvent,
    effectScope,
    EffectScope,
    inject,
    isReactive,
    isRef,
    reactive,
    UnwrapRef,
    watch,
    WatchOptions,
} from 'vue-demi';
import {
    _ActionsTree,
    _DeepPartial,
    _GettersTree,
    _Method,
    DefineStoreOptions,
    isPlainObject,
    MutationType,
    PiniaCustomStateProperties,
    StateTree,
    Store,
    StoreDefinition,
    StoreOnActionListener,
    SubscriptionCallback,
    SubscriptionCallbackMutation,
} from './types.ts';

import { activePinia, Pinia, piniaSymbol, setActivePinia } from './rootStore.ts';
import { addSubscription, triggerSubscriptions } from './subscriptions.ts';

function mergeReactiveObjects<T extends Record<any, unknown>>(
    target: T,
    patchToApply: Partial<T>
): T {
    // 遍历需要合并的对象属性
    for (const key in patchToApply) {
        if (!patchToApply.hasOwnProperty(key)) continue;
        const subPatch = patchToApply[key];
        const targetValue = target[key];

        if (
            isPlainObject(targetValue) &&
            isPlainObject(subPatch) &&
            target.hasOwnProperty(key) &&
            !isRef(subPatch) &&
            !isReactive(subPatch)
        ) {
            // 如果目标对象的属性值和需要合并的属性值都是普通对象,
            // 且目标对象存在该属性,同时需要合并的属性值不是 ref 或 reactive,
            // 则递归调用 mergeReactiveObjects 进行深度合并
            (target as any)[key] = mergeReactiveObjects(
                targetValue as Record<any, unknown>,
                subPatch as Record<any, unknown>
            );
        } else {
            // 否则直接将需要合并的属性值赋值给目标对象的对应属性
            (target as any)[key] = subPatch;
        }
    }

    return target;
}

// 创建选项式 Store
function createOptionsStore<
    Id extends string,
    S extends StateTree,
    G extends _GettersTree<S>,
    A extends _ActionsTree,
>(id: Id, options: DefineStoreOptions<Id, S, G, A>, pinia: Pinia): Store<Id, S, G, A> {
    const { state, actions, getters } = options;

    // 初始化 state
    const initialState: StateTree | undefined = pinia.state.value[id];
    if (!initialState && state) {
        pinia.state.value[id] = state ? state() : {};
    }

    const val = pinia.state.value[id];
    console.log(val);

    const subscriptions: SubscriptionCallback<S>[] = [];
    const actionSubscriptions: StoreOnActionListener<Id, S, G, A>[] = [];

    // 创建 store
    const store: Store<Id, S, G, A> = reactive({
        _p: pinia,
        $id: id,
        $patch: (partialStateOrMutator: _DeepPartial<S> | ((state: S) => void)) => {
            if (typeof partialStateOrMutator === 'function') {
                partialStateOrMutator(pinia.state.value[id] as S);
            } else {
                Object.assign(pinia.state.value[id], partialStateOrMutator);
            }
        },
        $reset: () => {
            const newState = state ? state() : {};
            store.$patch(newState);
        },
        $subscribe: (
            callback: SubscriptionCallback<S>,
            options: { detached?: boolean } & WatchOptions = {}
        ) => {
            // 添加订阅回调函数到订阅列表中
            const removeSubscription = addSubscription(
                subscriptions,
                callback,
                options.detached,
                () => stopWatcher()
            );

            // 创建一个监听器,监听 pinia.state.value[id] 的变化
            const stopWatcher = watch(
                () => pinia.state.value[id] as S,
                state => {
                    // 创建 SubscriptionCallbackMutation 对象
                    const mutation: SubscriptionCallbackMutation = {
                        storeId: store.$id,
                        type: MutationType.direct,
                        events: [] as DebuggerEvent[], // 假设没有调试器事件
                    };

                    // 触发订阅回调函数 传递 mutation 和 state 作为参数
                    triggerSubscriptions(subscriptions, mutation, state as UnwrapRef<S>);
                },
                { ...options, flush: options.flush ?? 'sync' }
            );

            // 返回一个移除当前订阅的函数
            return removeSubscription;
        },
        $onAction: (callback: StoreOnActionListener<Id, S, G, A>, detached?: boolean) => {
            // 添加 action 监听回调函数到 actionSubscriptions 列表中
            return addSubscription(actionSubscriptions, callback, detached);
        },
        $dispose: () => {
            // 销毁 store
            // 省略实现...
        },
    }) as Store<Id, S, G, A>;

    pinia._s.set(id, store as Store);

    // 定义 state 属性
    Object.defineProperty(store, '$state', {
        get: () => pinia.state.value[id] as UnwrapRef<S> & PiniaCustomStateProperties,
        set: (state: UnwrapRef<S>) => {
            store.$patch((currentState: UnwrapRef<S>) => {
                Object.assign(currentState as S, state);
            });
        },
    });

    // 定义 getters
    if (getters) {
        Object.keys(getters).forEach(name => {
            const getter = getters[name];
            Object.defineProperty(store, name, {
                get: () => getter.call(store, store.$state),
            });
        });
    }

    // 定义 actions
    if (actions) {
        Object.keys(actions).forEach(name => {
            const action = actions[name];
            // @ts-ignore
            store[name] = function (this: Store<Id, S, G, A>, ...args: any[]) {
                return action.apply(this, args);
            };
        });
    }

    return store;
}

// 创建组合式 Store
function createSetupStore<
    Id extends string,
    SS extends Record<string, unknown>,
    S extends StateTree,
    G extends Record<string, _Method>,
    A extends _ActionsTree,
>(
    id: Id,
    setup: () => SS,
    options: Partial<DefineStoreOptions<Id, S, G, A>> = {},
    pinia: Pinia
): Store<Id, S, G, A> {
    let scope: EffectScope;

    // 初始化 state
    const initialState: StateTree | undefined = pinia.state.value[id];
    if (!initialState) {
        pinia.state.value[id] = {};
    }

    // 创建 store 对象
    const store: Store<Id, S, G, A> = reactive({
        _p: pinia, // 保存对 pinia 实例的引用
        $id: id, // store 的唯一标识符
        $patch: (partialStateOrMutator: Partial<S> | ((state: S) => void)) => {
            // 用于修改 state 的方法
            if (typeof partialStateOrMutator === 'function') {
                partialStateOrMutator(pinia.state.value[id] as S);
            } else {
                mergeReactiveObjects(pinia.state.value[id], partialStateOrMutator);
            }
        },
        $reset: () => {
            // 重置 state 为初始状态
            const newState = options.state ? options.state() : {};
            store.$patch(newState);
        },
        $subscribe: (
            callback: SubscriptionCallback<S>,
            options: { detached?: boolean } & WatchOptions = {}
        ) => {
            // 订阅 state 变更
            const stopWatch = watch(
                () => pinia.state.value[id] as UnwrapRef<S>,
                state => {
                    callback(
                        {
                            storeId: id,
                            type: MutationType.direct,
                            events: [],
                        },
                        state
                    );
                },
                options
            );
            return () => stopWatch();
        },
        $onAction: (callback: StoreOnActionListener<Id, S, G, A>) => {
            // 监听 action
            const actionSubscriptions = pinia._s.get(id)!.actionSubscriptions;
            actionSubscriptions.push(callback);
            return () => {
                const idx = actionSubscriptions.indexOf(callback);
                if (idx > -1) {
                    actionSubscriptions.splice(idx, 1);
                }
            };
        },
        $dispose: () => {
            // 销毁 store
            scope.stop();
            pinia._s.delete(id);
        },
    }) as Store<Id, S, G, A>;

    pinia._s.set(id, store as Store);

    // 定义 state 属性
    Object.defineProperty(store, '$state', {
        get: () => pinia.state.value[id] as UnwrapRef<S> & PiniaCustomStateProperties,
        set: (state: UnwrapRef<S>) => {
            store.$patch((currentState: UnwrapRef<S>) => {
                Object.assign(currentState as S, state);
            });
        },
    });

    // 执行 setup 函数,创建响应式数据和计算属性
    const setupStore = pinia._e.run(() => (scope = effectScope()).run(() => setup()));

    // 处理 setup 返回的数据
    Object.keys(setupStore as Record<string, unknown>).forEach(key => {
        const value = setupStore?.[key];
        if (isRef(value) || isReactive(value)) {
            // 如果是响应式数据,则同步到 pinia.state
            if (initialState && key in initialState) {
                if (isRef(value)) {
                    // value.value = initialState[key];
                    pinia.state.value[id][key] = value;
                    // 将响应式数据暴露给 store 对象
                    // @ts-ignore
                    store[key] = value;
                } else {
                    // @ts-ignore
                    mergeReactiveObjects(value, initialState[key]);
                }
            }
            pinia.state.value[id][key] = value;
        } else if (typeof value === 'function') {
            // 如果是函数,则作为 action
            const action = value;
            // @ts-ignore
            store[key] = function (this: Store<Id, S, G, A>, ...args: any[]) {
                const actionSubscriptions = pinia._s.get(id)!.actionSubscriptions;
                const after: Array<(resolvedReturn: any) => any> = [];
                const onError: Array<(error: Error) => void> = [];

                actionSubscriptions.forEach((callback: StoreOnActionListener<Id, S, G, A>) => {
                    callback({
                        args,
                        name: key,
                        store,
                        after: (callback: (resolvedReturn: any) => any) => after.push(callback),
                        onError: (callback: (error: Error) => void) => onError.push(callback),
                    });
                });

                let ret: any;
                try {
                    ret = action.apply(this, args);
                } catch (error) {
                    onError.forEach(callback => callback(error as Error));
                    throw error;
                }

                if (ret instanceof Promise) {
                    return ret
                        .then(value => {
                            after.forEach(callback => callback(value));
                            return value;
                        })
                        .catch(error => {
                            onError.forEach(callback => callback(error));
                            return Promise.reject(error);
                        });
                }

                after.forEach(callback => callback(ret));
                return ret;
            };
        }
    });

    // 处理 options 中的 getters
    if (options.getters) {
        Object.keys(options.getters).forEach(name => {
            const getter = options.getters![name];
            Object.defineProperty(store, name, {
                get: () => getter.call(store, store),
            });
        });
    }

    // 处理 options 中的 actions
    if (options.actions) {
        Object.keys(options.actions).forEach(name => {
            const action = options.actions![name];
            // @ts-ignore
            store[name] = function (this: Store<Id, S, G, A>, ...args: any[]) {
                return action.apply(this, args);
            };
        });
    }

    // 应用插件
    pinia._p.forEach(plugin => {
        Object.assign(
            store,
            plugin({
                store,
                app: pinia._a,
                pinia,
                options: { ...options, state: pinia.state.value[id] },
            } as any)
        );
    });

    // 初始化 state
    if (options.state) {
        store.$patch(options.state());
    }

    return store;
}

// 定义 Store
export function defineStore<
    Id extends string,
    S extends StateTree = {},
    G extends _GettersTree<S> = {},
    A /* extends ActionsTree */ = {},
>(id: Id, options: Omit<DefineStoreOptions<Id, S, G, A>, 'id'>): StoreDefinition<Id, S, G, A>;

export function defineStore<
    Id extends string,
    S extends StateTree = {},
    G extends _GettersTree<S> = {},
    A /* extends ActionsTree */ = {},
>(options: DefineStoreOptions<Id, S, G, A>): StoreDefinition<Id, S, G, A>;

export function defineStore<
    Id extends string,
    S extends StateTree = {},
    G extends _GettersTree<S> = {},
    A /* extends ActionsTree */ = {},
>(
    idOrOptions: Id | DefineStoreOptions<Id, S, G, A>,
    options?: Omit<DefineStoreOptions<Id, S, G, A>, 'id'>
): StoreDefinition<Id, S, G, A> {
    let id: Id;
    let storeOptions: DefineStoreOptions<Id, S, G, A>;

    if (typeof idOrOptions === 'string') {
        id = idOrOptions;
        storeOptions = options as DefineStoreOptions<Id, S, G, A>;
    } else {
        storeOptions = idOrOptions as DefineStoreOptions<Id, S, G, A>;
        id = storeOptions.id;
    }

    function useStore(pinia?: Pinia | null): Store<Id, S, G, A> {
        // 获取 pinia 实例
        pinia = pinia || inject(piniaSymbol);
        if (pinia) setActivePinia(pinia);

        if (!activePinia) {
            throw new Error(
                `[🍍]: getActivePinia()" 被调用，但没有活动的 Pinia。您是否在调用 "app.use(pinia)" 之前尝试使用Pinia?`
            );
        }

        pinia = activePinia!;

        // 如果 store 不存在,则创建 store
        if (!pinia?._s.has(id)) {
            if (typeof storeOptions === 'function') {
                createSetupStore(
                    id,
                    storeOptions as () => S,
                    {} as DefineStoreOptions<Id, S, G, _ActionsTree>,
                    pinia
                );
            } else {
                createOptionsStore(
                    id,
                    { ...storeOptions, id, actions: storeOptions.actions as _ActionsTree },
                    pinia
                );
            }
        }

        // 获取 store 实例
        const store = pinia?._s.get(id)!;

        return store as Store<Id, S, G, A>;
    }

    useStore.$id = id;

    return useStore;
}
