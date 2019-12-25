/**
 * 封装Dep类
 */

// 封装一个Dep（Dependency）类用于专门处理依赖搜集和触发更新
class Dep {
    constructor() {
        this.subscribers = []
    }

    depend() {
        if(target && !this.subscribers.includes(target)){
            this.subscribers.push(target)
        }
    }

    notify(){
        this.subscribers.forEach(target => target())
    }
}

let dep = new Dep()

let price = 10
let count = 2
let total = 0

let target = () => {
    total = price * count
}

dep.depend() //搜集依赖
target() // 计算求值
console.log('total:', total) // => 20

price = 20 //修改
console.log('total:', total) // => 20

dep.notify() // 通知,重新计算求值
console.log('total:', total) // => 40
