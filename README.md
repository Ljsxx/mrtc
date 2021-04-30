# webrtc实现多人视频通话


## setup
```
npm i
```


## configuration

1. 在当前目录下生成一对证书和密钥用于开启https服务。windows下可以使用 git Bash 终端，linux、unix可以直接使用。完成后会在本地生成*key.pem*和*cert.pem*文件。
```
openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout key.pem -out cert.pem
```


2. 修改 config.js的 ip 和 端口
```js
// 本地的ip
var host = '192.168.1.7'
// 开启服务的端口
var port = 3000
```

3. 跑起来
```js
// 引入 mrtc.js 文件
// 初始化
var app = new Mrtc(document.getElementById('videoList'), {
  // stun和turn服务，没有为null
  iceServer: null,
  // ip和端口
  socketUrl: `wss://192.168.1.7:3000`
})

// 登录
app.login({
  userId: '1',
  userName: '王大锤',
  roomId: '123'
})

// 退出登录
app.logout()

// 订阅消息
app.on('msg', msg => {})

// 退订消息
app.off('msg', msg => {})

// 发送消息
app.sendMsg('hi')
```


## server
```
npm run server
```
> 打开谷歌浏览器 https://192.168.1.7:3000
