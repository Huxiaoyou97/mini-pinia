// @author 胡小右
// @date 2024/05/14 12:22:38
// @desc Pinia 类型文件
import type {DebuggerEvent, Ref, UnwrapRef, WatchOptions} from 'vue-demi';
import {Pinia} from './rootStore.ts';

// 状态树类型 键可以是字符串 数字或符号 值可以是任意类型
export type StateTree = Record<string | number | symbol, any>;

// 深度 Partial 类型 将对象的所有属性递归地变为可选
export type _DeepPartial<T> = { [K in keyof T]?: _DeepPartial<T[K]> };

// 订阅回调函数的 mutation 类型
export type SubscriptionCallbackMutation = {
    type: MutationType; // mutation 类型
    storeId: string; // store 的 ID
    payload?: any; // 负载数据
    events: DebuggerEvent[];
};

// 订阅回调函数类型
export type SubscriptionCallback<S> = (
    mutation: SubscriptionCallbackMutation,
    state: UnwrapRef<S>
) => void;

// store action 监听器上下文类型
export type StoreOnActionListenerContext<Id extends string, S extends StateTree, G, A> = {
    store: Store<Id, S, G, A>; // store 实例
    args: any[]; // action 的参数
    after: (callback: () => void) => void; // 在 action 执行后的回调
    onError: (callback: (error: Error) => void) => void; // 在 action 执行出错时的回调
    [key: string]: any; // 其他属性
};

// store action 监听器类型
export type StoreOnActionListener<Id extends string, S extends StateTree, G, A> = (
    context: StoreOnActionListenerContext<Id, S, G, A>
) => void;

// store 属性接口
export interface StoreProperties<Id extends string> {
    $id: Id; // store 的 ID
    _p: Pinia; // Pinia 实例
    _getters?: string[]; // getter 名称数组
    _isOptionsAPI?: boolean; // 是否使用 Options API
    _customProperties: Set<string>; // 自定义属性集合
    _hotUpdating: boolean; // 是否正在热更新
    _hmrPayload: {
        state: string[]; // 状态名称数组
        hotState: Ref<StateTree>; // 热更新状态
        actions: _ActionsTree; // action 树
        getters: _ActionsTree; // getter 树
    };

    _hotUpdate(useStore: StoreGeneric): void; // 热更新方法
}

// 带状态的 store 接口
export interface _StoreWithState<Id extends string, S extends StateTree, G, A>
    extends StoreProperties<Id> {
    $state: UnwrapRef<S> & PiniaCustomStateProperties; // store 的状态
    _r?: boolean; // 是否只读

    $patch(partialState: _DeepPartial<UnwrapRef<S>>): void; // 部分更新状态的方法

    $patch<F extends (state: UnwrapRef<S>) => any>(stateMutator: F): void; // 使用函数更新状态的方法

    $reset(): void; // 重置状态的方法

    $subscribe(
        callback: SubscriptionCallback<S>,
        options?: { detached?: boolean } & WatchOptions
    ): () => void; // 订阅状态变更的方法

    $onAction(callback: StoreOnActionListener<Id, S, G, A>, detached?: boolean): () => void; // 监听 action 的方法

    $dispose(): void; // 销毁 store 的方法
}

// 方法类型
export type _Method = (...args: any[]) => any;

// 带 action 的 store 类型
export type _StoreWithActions<A> = {
    [k in keyof A]: A[k] extends (...args: infer P) => infer R ? (...args: P) => R : never;
};

// 带 getter 的 store 类型
export type _StoreWithGetters<G> = {
    readonly [k in keyof G]: G[k] extends (...args: any[]) => infer R ? R : UnwrapRef<G[k]>;
};

// store 类型
export type Store<
    Id extends string = string,
    S extends StateTree = {},
    G = {},
    A = {},
> = _StoreWithState<Id, S, G, A> &
    UnwrapRef<S> &
    _StoreWithGetters<G> &
    (_ActionsTree extends A ? {} : A) &
    PiniaCustomProperties &
    PiniaCustomStateProperties;

// 通用 store 类型
export type StoreGeneric = Store<string, StateTree, _GettersTree<StateTree>, _ActionsTree>;

// store 定义接口
export interface StoreDefinition<
    Id extends string = string,
    S extends StateTree = StateTree,
    G = _GettersTree<S>,
    A = _ActionsTree,
> {
    $id: Id; // store 的 ID
    _pinia?: Pinia; // Pinia 实例

    (pinia?: Pinia | null | undefined, hot?: StoreGeneric): Store<Id, S, G, A>; // store 工厂函数
}

// Pinia 自定义属性接口
export interface PiniaCustomProperties {}

// Pinia 自定义状态属性接口
export interface PiniaCustomStateProperties {}

// getter 树类型
export type _GettersTree<S extends StateTree> = Record<
    string,
    ((state: UnwrapRef<S> & UnwrapRef<PiniaCustomStateProperties>) => any) | (() => any)
>;

// action 树类型
export type _ActionsTree = Record<string, _Method>;

// 定义 store 选项基础接口
export interface DefineStoreOptionsBase {}

// 定义 store 选项接口
export interface DefineStoreOptions<Id extends string, S extends StateTree, G, A>
    extends DefineStoreOptionsBase {
    id: Id; // store 的 ID
    state?: () => S; // 状态工厂函数
    // getters?: G &
    //     ThisType<UnwrapRef<S> & _StoreWithGetters<G> & PiniaCustomProperties> &
    //     _GettersTree<S>; // getter 对象
    getters?: G &
        ThisType<
            Readonly<UnwrapRef<S> & PiniaCustomStateProperties & UnwrapRef<G>> &
                A & {
                    $pinia: Pinia;
                }
        >;
    actions?: A &
        ThisType<
            A &
                UnwrapRef<S> &
                _StoreWithState<Id, S, G, A> &
                _StoreWithGetters<G> &
                PiniaCustomProperties
        >; // action 对象

    hydrate?(storeState: UnwrapRef<S>, initialState: UnwrapRef<S>): void; // 水合方法
}

// 插件中定义 store 选项接口
export interface DefineStoreOptionsInPlugin<Id extends string, S extends StateTree, G, A>
    extends Omit<DefineStoreOptions<Id, S, G, A>, 'id' | 'actions'> {
    actions: A; // action 对象
}

export enum MutationType {
    direct = 'direct',
    patchObject = 'patch object',
    patchFunction = 'patch function',
}

export function isPlainObject<S extends StateTree>(value: S | unknown): value is S;
export function isPlainObject(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    o: any
): o is StateTree {
    return (
        o &&
        typeof o === 'object' &&
        Object.prototype.toString.call(o) === '[object Object]' &&
        typeof o.toJSON !== 'function'
    );
}
