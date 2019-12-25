/**
 * 一个简单的开始
 * 简单的观察者模式：先将观察者存储起来（保存到数组中），在观察目标（data）发生变化后，通知所有的观察者（遍历数组）
 */

let price = 10
let count = 2
let total = 0
let target = null
let subscribers = []

function record() {
    subscribers.push(target)
}

function notify() {
    subscribers.forEach((target) => target())
}

target = () => {
    total = price * count
}

record() // 存储

target() // 计算求值
console.log('total:', total) // => 20

price = 20 //修改
console.log('total:', total) // => 20

notify() // 通知,重新计算求值
console.log('total:', total) // => 40

