/**
 * 数组响应式
 */

// 工具函数：判断是否是对象
function isObject(obj) {
    return obj !== null && typeof obj === 'object'
}

class Dep {
    // static target = null

    constructor() {
        this.subscribers = []
    }

    addSub(sub) {
        this.subscribers.push(sub)
    }

    depend() {
        if (Dep.target) {
            Dep.target.addDep(this)
        }
    }

    notify() {
        this.subscribers.forEach(sub => {
            sub.update()
        })
    }
}
Dep.target = null //静态属性

class Watcher {
    constructor(func) {
        this.getter = func
        this.value = this.get()
    }

    get() {
        Dep.target = this;
        this.getter() // 触发getter并且添加依赖，因为target已存在
        Dep.target = null
    }

    addDep(dep) {
        dep.addSub(this)
    }

    update() {
        this.getter() // 模拟视图更新
    }
}

//处理数组的变化侦测
let arrayProto = Array.prototype
let arrayMethods = Object.create(arrayProto);

['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].forEach((method) => {
    const original = arrayProto[method]

    // 官方用的是def工具函数去定义
    arrayMethods[method] = function (...args) {
        const result = original.apply(this, args) // 调用原先的方法

        let inserted

        switch (method) {
            case 'push':
            case 'unshift':
                inserted = args
                break;
            case 'splice':
                inserted = args.slice(2)
                break;
        }
        if (inserted) observeArray(args) // 新增的数据也要侦测每一项

        this.__dep__.notify() // 触发更新
        return result
    }
})

/**
 * Observer类会附件到每一个被侦测的object上。
 * 一旦被附件，Observer会将所有的属性转换为getter/setters
 * 来搜集依赖和触发更新
 * --来自官方源码的注释
 */
class Observer {
    constructor(value) {
        this.value = value

        if (Array.isArray(value)) {
            value.__proto__ = arrayMethods
            // Object.setPrototypeOf(value, arrayMethods) // ES6 API

            observeArray(value)
        } else {
            this.walk(value)
        }
    }

    walk(obj) {
        Object.keys(obj).forEach(key => {
            defineReactive(obj, key, obj[key])
        });
    }
}

// 侦测数组的每一项
function observeArray(items) {
    for (let i = 0, l = items.length; i < l; i++) {
        observe(items[i])
    }
}

function observe(value) {
    if (!isObject(value)) return
    new Observer(value)
}

function defineReactive(obj, key, value) {
    observe(value) // 递归，对象的值也有可能是对象，返回一个子对象所对应的Observer实例

    let dep = new Dep()

    value.__dep__ = dep // 将dep保存起来，用于数组更新方法里面触发更新

    Object.defineProperty(obj, key, {
        configurable: true,
        enumerable: true,
        get: function () {
            if (Dep.target) {
                dep.depend() // 搜集依赖
            }
            return value
        },
        set: function (newval) {
            if (newval !== value) {
                observe(newval) // 新设置的值有可能是对象
                value = newval
                dep.notify() // 触发更新
            }
        }
    })
}

class Vue {
    constructor(data) {
        new Observer(data)

        // 一个组件可能会有多个watcher实例
        new Watcher(render) // 组件渲染过程中将数据记录为依赖
        new Watcher(sum) //这里模拟计算属性，computed（计算属性）或者 watch 也会将数据记录为依赖
    }
}

let data = {
    price: 10,
    count: 2,
    list: []
}

function render() {
    let total = data.price * data.count // 触发getter
    console.log('total:', total)
}

function sum() {
    let sum = 0
    data.list.forEach(item => sum += item) // 触发getter
    console.log('sum:', sum)
}

new Vue(data) // 模拟Vue实例化，入口

data.price = 20 // 触发更新

data.list.push(1, 2, 3) // 触发更新