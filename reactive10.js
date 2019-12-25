/**
 * Vue3响应式系统之依赖收集和触发更新
 */

var toProxy = new WeakMap()
var toRaw = new WeakMap()
var activeEffectStacks = []

function isObject(obj) {
    return obj !== null && typeof obj === 'object'
}

function hasOwnKey(target, key) {
    return target.hasOwnProperty(key)
}

function reactive(target) {
    return createReactiveObject(target)
}

function createReactiveObject(target) {
    if (!isObject(target)) return

    if (toProxy.has(target)) return toProxy.get(target)
    if (toRaw.has(target)) return target

    let baseHandler = {
        get(target, key, receiver) {
            console.log(key, '获取');
            track(target, key) // 收集依赖
            let result = Reflect.get(target, key, receiver)
            if (isObject(result)) {
                return reactive(result)
            }
            else {
                return result
            }
        },
        set(target, key, value, receiver) {
            let oldValue = target[key]
            let result = Reflect.set(target, key, value, receiver)
            if (!hasOwnKey(target, key)) {
                console.log(key, '新增设置');
                trigger(target, key) // 触发更新
            }
            else if (oldValue !== value) {
                console.log(key, '更改设置');
                trigger(target, key) // 触发更新
            }
            return result
        },
        deleteProperty(target, key) {
            return Reflect.deleteProperty(target, key)
        }
    }
    let observed = new Proxy(target, baseHandler)
    toProxy.set(target, observed)
    toRaw.set(observed, target)
    return observed
}

// 跟踪依赖，创建如下数据格式用来保存依赖
// {
//     target: {
//         key: [fn]
//     }
// }
var targetsMap = new WeakMap()

function track(target, key) {
    let effect = activeEffectStacks[activeEffectStacks.length - 1]
    if (!effect) return

    let depsMap = targetsMap.get(target)
    if (!depsMap) {
        targetsMap.set(target, depsMap = new Map())
    }
    let deps = depsMap.get(key)
    if (!deps) {
        depsMap.set(key, deps = new Set())
    }

    if (!deps.has(effect)) {
        deps.add(effect)
    }
}

// 触发依赖
function trigger(target, key) {
    let depsMap = targetsMap.get(target) // 取出target所对应的Map： {key:[fn,fn]}
    if (depsMap) {
        let deps = depsMap.get(key) // 取出 key所对应的set：[fn,fn]
        if (deps) {
            deps.forEach(effect => { // 遍历set取出fn并执行
                effect()
            })
        }
    }
}

// 执行fn并将fn存入栈，在数据使用时(get)将数据和fn对应起来
function effect(fn) {
    const effect = createReactiveEffect(fn)
    effect()
}

function createReactiveEffect(fn) {
    const effect = function () {
        run(effect, fn)
    }
    return effect
}

function run(effect, fn) {
    if (!activeEffectStacks.includes(effect)) {
        try {
            activeEffectStacks.push(effect)
            return fn()
        } finally {
            activeEffectStacks.pop()
        }
    }
}

let data = {
    name: '111',
    age: 12,
    list: [1, 2]
}

let state = reactive(data)

effect(() => {
    console.log('name:', state.name);
})
effect(() => {
    console.log('age:', state.age);
})
state.name = '222'