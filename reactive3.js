/**
 * 封装Watcher类
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
        dep.depend() //搜集依赖
        target() // 计算求值
        target = null
    }
}

let price = 10
let count = 2
let total = 0

let dep = new Dep()

let watcher = new Watcher(() => {
    total = price * count
})

console.log('total:', total) // => 20
price = 20 //修改
console.log('total:', total) // => 20

dep.notify() // 通知,重新计算求值
console.log('total:', total) // => 40
