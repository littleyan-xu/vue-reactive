/**
 * observer转化getter/setter
 */

// 封装一个Dep（Dependency）类用于专门处理依赖搜集和触发更新
class Dep {
    constructor() {
        this.subscribers = []
    }

    depend() {
        if (target && !this.subscribers.includes(target)) {
            this.subscribers.push(target)
        }
    }

    notify() {
        this.subscribers.forEach(target => target())
    }
}

let target = null
// 封装一个Watcher类，用来包装观察者函数
class Watcher {
    constructor(func) {
        target = func
        target() // 计算求值，触发getter，从而搜集依赖
        target = null
    }
}

function observer(data) {
    Object.keys(data).forEach((key) => {
        let value = data[key]
        let dep = new Dep()
        Object.defineProperty(data, key, {
            get() {
                dep.depend()
                return value
            },
            set(newVal) {
                value = newVal
                dep.notify()
            }
        })
    })
}

let total = 0
let data = {
    price: 10,
    count: 2,
}

observer(data) // 将data转换为getter/setter

// 传入包装函数生成一个Watcher实例
let watcher = new Watcher(() => {
    total = data.price * data.count
})

console.log('total:', total) // => 20

data.price = 20 // 触发setter，从而调用notify方法重置技术求值
console.log('total:', total) // => 40
