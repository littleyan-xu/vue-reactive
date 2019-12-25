> 此文档是个人根据vue源码以及网上的资料和个人理解，由一个Demo由浅入深来对vue的响应式原理一探究竟，达到深刻理解vue响应式原理的目的，若有不对的地方望大神指正。

## 一个简单的开始
套用一句经典名言：任何伟大都源于一个简单的开始！我们就从一个简单demo开始：


假设现在有2个变量：

```
let price = 10
let count = 2
```
然后我们需要得到一个总数：

```
let total = price * count
```
问题：price或者count变了，需要实现total跟着变化

思考：total跟着变化，也就是total的求值过程需要重新再执行一遍，只要将整个求值过程封装成一个方法再执行一遍就好，再加上观察者的设计模式，代码是这样的：

```
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
```
## 封装Dep类
上面的依赖搜集（record方法）和通知更新（notify方法）比较零散，如果有多个变量需要搜集依赖，不方便扩展，所以需要专门封装一个类来集中管理依赖关系，Dep（Dependency）出现了：

```
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
```
## 封装Watcher类
接着上面的例子，如果有多个变量，计算求值对应多个方法，那么定义一个target方法显示是不够的，我们接着封装一个Watcher 类，用于包装计算求值这个观察者函数：

```
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

```
这里有个疑问是为什么要把target设置为全局变量，为什么不直接作为参数传入depend方法，我们接着优化，答案就在后面。

## observer转化getter/setter
到目前为止，我们并没有实现真正意义上的响应式，在变量发生变化后，自动更新依赖，上面我们需要主动调用notify()方法通知更新。那么在JavaScript中我们如果侦测一个对象的变化？目前主要有2种方式实现：1、ES5中使用[Object.defineProperty](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty)API，将对象的属性转为==getter/setter== 2、ES6的[Proxys](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy)

鉴于vue2是用Object.defineProperty实现，我们先用Object.defineProperty来接着优化，添加一个observer方法，用来专门将需要观察的数据对象转换成getter/setter：

```
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


```
这里的代码和上面的代码的区别是：

1、将dep实例由全局挪入observer()方法，这样每一个需要观察的数据对象都对应一个dep实例，将dep.depend()方法的调用由Watcher构造函数挪入get()方法里，在getter中搜集依赖。

2、在setter中调用dep.notify()方法，从而触发更新。

这里也间接回答了上面target的问题，dep.depend()方法调用挪入getter里，Dep和Watcher完全解耦，我们需要一个全局变量来保存依赖所对应的包装函数。

## 封装Observer类
上面的代码有一个问题，就是只侦测了一个数据对象(data)，如果有多个数据对象，并且还要侦测所有子属性，很显然一个方法是不合理的，这时需要封装一个Observer类，并且封装成类在后面的数组的响应式还有大用处，这里先卖个关子，封装后的代码：

```
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

```
上面的代码加入了Observer类和Vue类，Vue类只是为了模拟vue应用响应式系统的全过程，通过创建一个Vue实例开始，传入一个数据对象(data)，将data对象的所有属性添加到响应式系统中，当属性的值发生变化时，视图将会更新(重新调用render方法)。由于这里着重讲响应式，所以render所对应的虚拟DOM、模板渲染等这里暂不涉及，只是简单的打印数据。

上面代码的重点是加入了Observer类，很多小伙伴也许开始会跟我一样，觉得Observer类和observe方法并没有什么区别嘛，observe方法也就是生成Observer类的实例而已啊，感觉这是脱掉裤子放屁--多此一举嘛，其实不然，存在即合理，我们接着往下看：


## 数组响应式
上面的代码只实现了对象的响应式，对于数组并没有添加侦测，那要怎样实现呢？


按照上面的套路，响应式主要分为依赖搜集和数据侦测，在getter中搜集依赖，在setter中触发更新。那么问题来了，数组getter中搜集依赖，那怎么触发更新？


思考一下，数组的变化主要是通过各种数组的操作（会改变原数组的操作）来实现，只要拦截这些方法，加上触发更新就OK了，具体实现为劫持数组的原型，在原型链上进行增强操作（更新依赖），对于一些插入操作，还需要对插入的值添加到响应式系统，最后对于需要观察的数组，将原型设置为劫持的新的原型对象。


嗯，一切都很完美，准备撸代码了！不过等等，对象的依赖搜集和触发更新是在同一个函数里面（defineReactive），可以操作同一个Dep实例，数组的依赖搜集和触发更新在不同的地方，触发更新是在拦截器里面，那又怎么解决呢?

再次思考一下，getter里和拦截器里我们都能获取到当前操作的值，getter里将搜集的依赖dep绑定到值上面，在拦截器里面再获取然后触发更新就解决了，代码如下：

```
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

```
上面的代码有3处重点：


1、创建数组拦截器，劫持数组原型，并进行增强操作

```
let arrayMethods = Object.create(arrayProto);
.
.
.
this.__dep__.notify() // 触发更新

```



2、设置原形
```
value.__proto__ = arrayMethods
```
将当前响应式数据的原形设置为上面的拦截器arrayMethods

这里要多嘴提一句，我们知道__proto__是非标准属性，虽然大部分浏览器都默默支持了，但是也有一部分浏览器是不支持的，对于不支持__proto__设置原形的要怎么处理呢？vue2源码里面是调用了copyAugment方法，其实就是暴力的将拦截器里面拦截的方法挂载到当前值value上，巧妙的运用了js的特性：访问对象的属性时，会先从当前的对象去找，如果能找到就直接调用当前对象的方法，找不到时才去原形上找。


3、绑定依赖
```
value.__dep__ = dep
```
在当前值添加__dep__属性，将依赖dep绑定，用于在拦截器中使用

## Vue.js实现
以上是我个人的实现，但Vue2源码里面==绑定依赖==这块实现的更灵活更优雅，我们看看源码里面是怎么实现的：

```
// 工具函数：判断是否是对象
function isObject(obj) {
    return obj !== null && typeof obj === 'object'
}

// 工具函数：通过Object.defineProperty给对象设置属性
function def(obj, key, val, enumerable) {
    Object.defineProperty(obj, key, {
        value: val,
        enumerable: !!enumerable,
        writable: true,
        configurable: true
    })
}

// 工具函数：对象是是否有某个非继承的key
function hasOwnKey(target, key) {
    return target.hasOwnProperty(key)
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

//处理数组的响应
let arrayProto = Array.prototype
let arrayMethods = Object.create(arrayProto);

['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].forEach((method) => {
    const original = arrayProto[method]

    // 官方用的是def工具函数去定义
    arrayMethods[method] = function (...args) {
        const result = original.apply(this, args) // 调用原先的方法

        let inserted
        const ob = this.__ob__ // 在Observer类中定义

        switch (method) {
            case 'push':
            case 'unshift':
                inserted = args
                break;
            case 'splice':
                inserted = args.slice(2)
                break;
        }
        if (inserted) ob.observeArray(args) // 新增的数据也要侦测每一项

        ob.dep.notify() // 触发更新
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
        this.dep = new Dep()

        // 将__ob__属性添加到当前实例上，用于判断当前数据是否已转换为响应式数据和数组触发更新
        def(value, '__ob__', this)

        if (Array.isArray(value)) {
            value.__proto__ = arrayMethods
            // Object.setPrototypeOf(value, arrayMethods) es6API

            this.observeArray(value)
        } else {
            this.walk(value)
        }
    }

    walk(obj) {
        Object.keys(obj).forEach(key => {
            defineReactive(obj, key, obj[key])
        });
    }

    // 侦测数组的每一项
    observeArray(items) {
        for (let i = 0, l = items.length; i < l; i++) {
            observe(items[i])
        }
    }
}

function observe(value) {
    if (!isObject(value)) return
    let ob
    if (hasOwnKey(value, '__ob__')) { // 如果已经是响应式数据
        ob = value.__ob__
    } else {
        ob = new Observer(value)
    }
    return ob
}

function defineReactive(obj, key, value) {
    let childOb = observe(value) // 递归，对象的值也有可能是对象，返回一个子对象所对应的Observer实例

    let dep = new Dep()

    Object.defineProperty(obj, key, {
        configurable: true,
        enumerable: true,
        get: function () {
            if (Dep.target) {
                dep.depend() // 搜集依赖

                if (childOb) {
                    childOb.dep.depend()
                }
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
```
上面的代码也有3处重点：


1、将依赖dep绑定到Observer实例属性上，并将当前实例绑定到value值的__ob__属性上

```
class Observer {
    constructor(value) {
        this.dep = new Dep()

        // 将__ob__属性添加到当前实例上，用于判断当前数据是否已转换为响应式数据和数组触发更新
        def(value, '__ob__', this)
    }
}
```
我们上面的做法是直接将dep绑定到vulue上，这里的做法是将dep绑定当前Observer实例上，而把实例又绑定到vulue上，这样的做法好处多多，首先我们可以共享Observer实例方法，比如observeArray方法，在拦截器里面可以直接调用，而不用将此方法定义为全局方法；其次，通过__ob__属性，我们可以判断当前value是否已经转换为响应式。所以这种做法更灵活，也更容易扩展。

2、在依赖搜集时，将上面value值所对应的dep也搜集为依赖

```
function defineReactive(obj, key, value) {
    let childOb = observe(value) // 递归，对象的值也有可能是对象，返回一个子对象所对应的Observer实例
    ...
    Object.defineProperty(obj, key, {
        ...
        get: function () {
            if (Dep.target) {
                dep.depend() // 搜集依赖

                if (childOb) {
                    childOb.dep.depend()
                }
            }
            return value
        },
        set: function (newval) {
            ...
        }
    })
}

function observe(value) {
    if (!isObject(value)) return
    let ob
    if (hasOwnKey(value, '__ob__')) { // 如果已经是响应式数据
        ob = value.__ob__
    } else {
        ob = new Observer(value)
    }
    return ob
}
```
上面我们在实例上添加了dep依赖，在getter里收集这个依赖，然后在拦截器里面去触发更新时才会生效，childOb.dep.depend()就是为数组而生的！


3、触发更新时，通过当前值value值的__ob__属性找到所对应的Observer实例，并找到实例属性dep来更新

```
arrayMethods[method] = function (...args) {
    ...
    const ob = this.__ob__ // 在Observer类中定义

    ob.dep.notify() // 触发更新
    ...
}
```
嗯，上面做了那么多铺垫，就为了这一刻，终于大功告成！

上面我们有提到为什么一定要定义Observer类，这里也一目了然，我们将Dep类实例与Observer类实例紧密结合，灵活运用，让代码更易扩展，也更优雅。


到目前为止，一个较为完整响应式系统已经完成了，当然这里只是较为简单的实现，真实的vue.js源码里面远比这复杂，考虑的问题更多，代码更健壮，但是万变不离其宗，我们主要还是学习这个框架响应式的思路。

在此顺便附上vue官网的响应式架构图，对应Vue的响应式系统更加一目了然：
![image](https://cn.vuejs.org/images/data.png)

目前为止虽然功能实现了，但是总有些不完美：1、只能侦测对象属性的改变，对于添加/删除属性无法监测，数组length改变或某一项值的改变也无法侦测；2、在将对象属性转换为getter/setter时进行了遍历和递归，如果嵌套的很深，则会影响性能。

对于问题1，Vue添加了set和delete方法，专门用来处理这些情况的影响式：

```
function set(target, key, val) {
    // ...
    // 前面会进行一系列的检查判断
    // ...

  const ob = target.__ob__ // __ob__属性对应的是数据对象的Observer实例对象，

  if (!ob) {
    target[key] = val
    return val
  }

  defineReactive(ob.value, key, val) // 将传入的对象转换为getter/setter从而添加到响应式系统中
  ob.dep.notify() // 触发更新
  return val
}


function del(target, key) {
    // ...
    // 前面会进行一系列的检查判断
    // ...

  const ob = target.__ob__ // __ob__属性对应的是数据对象的Observer实例对象，

  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}
```

对于问题2，ES5似乎没有完美的解决办法，而使用 ES6的Proxy则完美解决了以上2个问题，Proxy代理是针对整个对象，而不是对象的某个属性，只要代理了对象，就可以监听同级结构下的所有属性的变化，包括添加/删除新属性，当然对于深层结构，递归在所难免，另外Proxy也完美支持代理数组，甚至函数，我们先拿Proxy来小试牛刀：

## Proxy小试牛刀

```
let handler = {
    get(target, key, receiver){
        console.log('触发了getter:', key);
        if(typeof target[key] === 'object' && target[key] !== null){
            return new Proxy(target[key], handler)
        }
        return Reflect.get(target, key, receiver);
    },

    set(target, key, value){
        console.log('触发了setter:',key+ ' -  '+value);
        return Reflect.set(target, key, value)
    }
}

let data = {
    list: []
}

let proxy = new Proxy(data, handler)

proxy.list[0] = 1 // 设置数组某一项会触发setter
proxy.list.push(2)  // push()会触发setter

proxy.info = {name:'test'} // 新增一个info属性，也会触发setter
```
可以看到不管是数组操作，还是新增属性等，无需特殊处理，全部都能监听到，下面我们就来看看Vue3中的基于Proxy的响应式系统

## Vue3响应式系统
vue2中，响应式系统主要分为依赖收集和数据侦测，vue3也是一样。研究Vue3的响应式之前，我们先了解一下Vue3创建响应式数据的方法，为了兼容Vue2，Vue3保留了data选项的用法，不过我们主要来研究新增的reactive API和effact API，Vue3的响应式架构如下图：
![image](https://image-static.segmentfault.com/316/741/3167419386-5dce708ae4bb2_articlex)

Vue3中通过调用reactive方法将数据转换成一个可观察的Proxy代理对象，通过effact方法实现依赖收集，在数据发生变化后调用传入回调函数，用法大致如下：

```
import {reactive, effect} from 'vue'

const state = reactive({
    name: 'hello'
})

effect(() => {
    console.log(state.name); // => 打印出hello
})
state.name = 'world' // => 再次打印出hello
```


可以看到核心就是reactive和effect这两个方法，一个用来数据侦测，一个用来依赖收集和响应，下面我们就来看看Vue3响应式具体怎样实现的，先从reactive数据侦测说起，上面我们已经见识了Proxy的威力，现在就来继续优化：

```
var toProxy = new WeakMap()
var toRaw = new WeakMap()

function isObject(obj){
    return obj !== null && typeof obj === 'object'
}

function hasOwnKey(target, key){
    return target.hasOwnProperty(key)
}

function reactive(target){
    return createReactiveObject(target)
}

function createReactiveObject(target){
    if(!isObject(target)) return

    if(toProxy.has(target)) return toProxy.get(target)
    if(toRaw.has(target)) return target

    let baseHandler = {
        get(target, key, receiver){
            console.log(key,'获取');
            let result = Reflect.get(target, key, receiver)
            if(isObject(result)){
                return reactive(result)
            }
            else{
                return result
            }
            
        },
        set(target, key, value, receiver){
            let oldValue = target[key]
            let result = Reflect.set(target, key, value, receiver)
            
            if(!hasOwnKey(target, key)){
                console.log(key,'新增设置');
            }
            else if(oldValue !== value){
                console.log(key,'更改设置');
            }
            return result
        },
        deleteProperty(target, key){
            return Reflect.deleteProperty(target, key)
        }
    }
    let observed = new Proxy(target, baseHandler)
    toProxy.set(target, observed)
    toRaw.set(observed, target)
    return observed
}

var data = {
    name: 'hello',
    list:[1,2],
    info: {
        age: 0
    }
}

var  state = reactive(data)
// state = reactive(data) // => 代码正常运行，因为有toProxy的判断
// state = reactive(state) // => 代码正常运行，因为有toRaw的判断

state.name = 'world'
state.list.push(3)
state.info.age = 18
```
上面的代码主要做了这几件事情：


1、创建一个代理对象。
 

2、get时判断value是否是对象，如果是需要递归。上面例子中，如果get中没有递归判断，那么list.push和info.age都无法正常运行，因为我们只代理了一级，后面的操作无法检测！这里有人也许会有疑问，上面不是说Vue2的缺点是递归么，那你Vue3也有递归啊？要说明的是，Vue2的递归，是程序一进入就开始递归，不管你数据有没有用上，如果数据复杂层级结构深会对性能有一定影响，而Vue3的递归是在用的时候（get）才会对当前的对象递归，性能更优化！


3、set时需要处理数组push方法产生set多次的情况（一次是值个改变，一次是length的改变），需要明确的是，只有数据发生变化我们才做响应，如果是新增key那肯定是发生了变化；如果key已存在则判断新值和旧值是否相等。


4、 判断数据对象被重复代理，和代理被重复代理的情况。这里用到了WeakMap，他的特点是对象可以作为key，并且对象是弱引用的，也就是一旦对象被删除，那么这里的引用不会影响垃圾回收机制，用WeakMap完美的实现了我们的需求！


实现了reactive，我们接着来看看effect，effect接受一个函数参数fn，默认会执行一次fn，并且在数据发生变化后再次自动执行，我们来看看怎么实现：

```
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
//obj.list.push(3)
```
这里的代码和上面比起来，多了effect、createReactiveEffect、run、track、trigger这几个函数，前3个函数其实主要就做了一件事：执行fn并将fn存起来，后面的track函数通过多层Map和set将数据和fn对应起来，trigger则是反向操作取出数据对应的fn遍历执行。

可以看到Vue3比起Vue2，代码更直观明了，Vue2用了3个类来实现，而Vue3则用起ES6的Proxy、Map、Set等API轻松实现，而且天生解决了Vue2中那些令人苦恼的问题，不得不说这些API简直好用到飞起啊。。。

到此为止，Vue2和Vue3的响应式就理完了，会不会有一种豁然开朗的感觉？整个过程下来，让我对Vue也有了更深的认识，它的设计思想和很多技巧让我受益匪浅，接下来还要继续研究它的虚拟DOM与diff、模板解析等，用框架就要去读懂它，既可以让我们在开发时少犯错误，又可以提升自己，何乐而不为？

> 写在最后：


1、上面的代码都已放入GitHub对应的目录里


2、强烈建议安装VsCode插件Code Runner来直接运行上面的代码