/**
 * getCurrentScope
 *  该函数用于获取当前组件的作用域（scope）
 *  在 Vue 3 中 每个组件都有自己的作用域 作用域中可以注册一些副作用函数 监听器等
 *  通过调用 getCurrentScope 我们可以获取当前组件的作用域对象 从而可以在作用域中注册一些需要在组件卸载时自动清理的资源
 *
 * onScopeDispose
 *  该函数用于在当前组件的作用域中注册一个清理函数 当组件被卸载时 该清理函数会自动被调用
 *  它接受一个回调函数作为参数 这个回调函数就是需要在组件卸载时执行的清理逻辑
 *  通过在作用域中注册清理函数 我们可以确保在组件被卸载时 一些需要手动清理的资源（如事件监听器、定时器等）能够被正确地清理 避免内存泄漏
 */
import { getCurrentScope, onScopeDispose } from 'vue-demi';
import { _Method } from './types.ts'; // 空函数，用于默认的 onCleanup 参数

// 空函数，用于默认的 onCleanup 参数
export const noop = () => {};

/**
 * 添加订阅回调函数到订阅列表中
 * @param subscriptions 订阅列表
 * @param callback 要添加的回调函数
 * @param detached 是否与当前组件作用域解耦 默认为 false
 * @param onCleanup 清理函数 在订阅被移除时调用 默认为空函数
 * @returns 一个移除当前订阅的函数
 */
export function addSubscription<T extends _Method>(
    subscriptions: T[],
    callback: T,
    detached = false,
    onCleanup: () => void = noop
): () => void {
    subscriptions.push(callback);

    // 创建一个移除当前订阅的函数
    const removeSubscription = () => {
        const index = subscriptions.indexOf(callback);
        if (index !== -1) {
            subscriptions.splice(index, 1);
            onCleanup();
        }
    };

    // 如果没有解耦且存在当前组件作用域，则在作用域销毁时自动移除订阅
    if (!detached) {
        const scope = getCurrentScope();
        if (scope) {
            // 使用 onScopeDispose 注册清理函数，在当前作用域销毁时自动调用
            onScopeDispose(removeSubscription);
        }
    }

    // 返回移除当前订阅的函数，供外部手动调用
    return removeSubscription;
}

/**
 * 触发订阅列表中的所有回调函数
 * @param subscriptions 订阅列表
 * @param args 回调函数的参数列表
 */
export function triggerSubscriptions<T extends _Method>(
    subscriptions: T[],
    ...args: Parameters<T>
): void {
    // 创建一个订阅列表的副本，避免在触发回调函数时修改原始列表导致的问题
    const subscriptionsCopy = subscriptions.slice();

    // 遍历订阅列表副本，触发每个回调函数
    subscriptionsCopy.forEach(callback => {
        callback(...args);
    });
}
