/**
 * Proxy小试牛刀
 */

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
