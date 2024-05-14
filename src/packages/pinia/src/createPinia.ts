import {Pinia, PiniaPlugin, piniaSymbol, setActivePinia} from './rootStore.ts';
import {App, effectScope, isVue2, markRaw, ref, Ref} from 'vue-demi';
import {StateTree, StoreGeneric} from './types.ts';

/**
 * 创建一个供应用程序使用的 Pinia 实例
 */
export function createPinia(): Pinia {
    // 创建一个 effect 作用域，用于管理 Pinia 实例的响应式效果
    const scope = effectScope(true);

    // 在 effect 作用域内创建一个响应式的 state 对象，用于存储所有 store 的状态
    const state = scope.run<Ref<Record<string, StateTree>>>(() =>
        ref<Record<string, StateTree>>({})
    )!;

    // 定义一个数组，用于存储 Pinia 插件
    let _p: Pinia['_p'] = [];

    // 定义一个数组，用于存储待安装的 Pinia 插件
    let toBeInstalled: PiniaPlugin[] = [];

    // 创建一个 Pinia 实例对象，并使用 markRaw 标记为非响应式
    const pinia: Pinia = markRaw({
        // 安装 Pinia 插件的方法
        install(app: App) {
            // 设置当前活动的 Pinia 实例
            setActivePinia(pinia);

            // 如果不是 Vue 2 环境
            if (!isVue2) {
                // 将 app 实例保存到 Pinia 实例的 _a 属性中
                pinia._a = app;

                // 通过 provide 提供 Pinia 实例，以便在组件中通过 inject 获取
                app.provide(piniaSymbol, pinia);

                // 将 Pinia 实例挂载到 app 的全局属性上，以便在组件中通过 this.$pinia 访问
                app.config.globalProperties.$pinia = pinia;

                // 安装待安装的插件
                toBeInstalled.forEach(plugin => _p.push(plugin));

                // 清空待安装的插件数组
                toBeInstalled = [];
            }
        },

        // 使用 Pinia 插件的方法
        use(plugin) {
            // 如果还没有安装 app 且不是 Vue 2 环境，则将插件添加到待安装的插件数组中
            if (!this._a && !isVue2) {
                toBeInstalled.push(plugin);
            } else {
                // 否则直接将插件添加到已安装的插件数组中
                _p.push(plugin);
            }

            // 返回 Pinia 实例，以支持链式调用
            return this;
        },

        // Pinia 插件数组
        _p,

        // 保存 app 实例的属性
        // @ts-expect-error
        _a: null,

        // 保存 effect 作用域的属性
        _e: scope,

        // 保存所有 store 实例的 Map 对象
        _s: new Map<string, StoreGeneric>(),

        // 保存 state 对象的属性
        state,
    });

    // TODO: 添加 devTools 注册逻辑

    // 返回创建的 Pinia 实例
    return pinia;
}

/**
 * 销毁 Pinia 实例，停止其 effect 作用域，并移除状态、插件和 store
 *
 * @param pinia - 要销毁的 Pinia 实例
 */
export function disposePinia(pinia: Pinia) {
    // 停止 Pinia 实例的 effect 作用域
    pinia._e.stop();

    // 清空 store 实例的 Map 对象
    pinia._s.clear();

    // 清空 Pinia 插件数组
    pinia._p.splice(0);

    // 重置 state 对象为空对象
    pinia.state.value = {};

    // 将 app 实例的引用设置为 null
    // @ts-expect-error: non valid
    pinia._a = null;
}
