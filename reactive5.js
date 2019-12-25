/**
 * 封装Observer类
 */

function isObject(obj){
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

/**
 * Observer类会附件到每一个被侦测的object上。
 * 一旦被附件，Observer会将所有的属性转换为getter/setters
 * 来搜集依赖和触发更新
 * --来自官方源码的注释
 */
class Observer {
    constructor(value){
        this.value = value
        
        if(!Array.isArray(value)){
            this.walk(value)
        }
    }

    walk(obj) {
        Object.keys(obj).forEach(key => {
            defineReactive(obj, key, obj[key])
        });
    }
}

function observe(value) {
    if (!isObject(value)) return
    new Observer(value)
}

function defineReactive(obj, key, value) {
    observe(value) // 递归，对象的值也有可能是对象

    let dep = new Dep()

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
        new Watcher(render)
    }
}

let data = {
    price: 10,
    count: 2,
}

function render() {
    let total = data.price * data.count // 触发getter
    console.log('total:', total)
}

new Vue(data) //入口

data.price = 20 // => 40 // 触发更新

data.count = 3 // => 60 // 触发更新