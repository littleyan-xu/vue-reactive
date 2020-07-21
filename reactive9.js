/**
 * Vue3响应式系统之变化侦测
 */

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

    const ob = toProxy.get(target)
    if(toProxy.has(target)) return ob
    if(toRaw.has(ob)) return target

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