const fs = require('fs')
const qs = require('qs')
const https = require('https')
const ws = require('ws')
const express = require('express')
const config = require('./config')

const app = express()
const options = {
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem')
}
const server = https.createServer(options, app)
console.log('config', config)
server.listen(config.port)

app.use(express.static(__dirname))

const WebSocketServer = ws.Server,
  wss = new WebSocketServer({
    server: server
  })

// socket连接
var wsc = {}
// 房间
var rooms = {}

// 有socket连入
wss.on('connection', function (ws, req) {
  const params = qs.parse(req.url.split('?')[1])
  const id = params && params.id
  console.log('connection -->', id)
  // 将socket存入数组
  wsc[id] = ws
  // 转发收到的消息
  ws.on('message', function (message) {
    var json = JSON.parse(message)
    const event = json.event
    const data = json.data
    console.log('message -->', id , event)
    if (event === 'join') {
      // 登录
      const { userId, roomId } = data
      if (rooms && rooms[roomId] && rooms[roomId][userId] && rooms[roomId][userId].id) {
        // 如果已经登录，踢出房间
        handleLeave({
          id: rooms[roomId][userId].id,
          data: rooms[roomId][userId],
          kick: true
        }, () => {
          // 发送完成
          handleJoin({ id, data })
        })
      } else {
        handleJoin({ id, data })
      }
    } else if (event === 'leave') {
      // 退出
      handleLeave({ id, data, kick: false })
    } else if (event === 'msg') {
      // 对话
      handleMsg({ id, data })
    } else {
      for (key in wsc) {
        if (key !== id) {
          wsc[key] && wsc[key].send(message, function (error) {
            if (error) {}
          })
        }
      }
    }
  })
  ws.on('close', function (message) {
    console.log('close -->', id)
    wsc[id] = null
    delete wsc[id]
  })
})

wss.on('close', function (ws, req) {
  rooms = {}
  wss = {}
})

// 处理有人加入
function handleJoin ({ id, data }) {
  const { userId, roomId } = data
  if (rooms[roomId] === undefined || !rooms[roomId]) {
    rooms[roomId] = {}
  }
  rooms[roomId][userId] = data
  const list = Object.values(rooms[roomId])
  for (let key in rooms[roomId]) {
    const user = rooms[roomId][key]
    const msg = JSON.stringify({
      event: 'join',
      data: {
        list: list,
        user: data
      }
    })
    // 发送
    wsc[user.id] && wsc[user.id].send(msg, function (error, success) {
      if (error) {
        return
      }
    })
  }
}
// 处理有人退出
function handleLeave ({ id, data, kick }, cb) {
  const { userId, roomId } = data
  const keys = Object.keys(rooms[roomId])
  const len = keys.length
  keys.forEach((key, index) => {
    const user = rooms[roomId][key]
    const msg = JSON.stringify({
      event: 'leave',
      data: {
        // 是否是被踢出的
        kick: kick || false,
        userId: userId,
        roomId: roomId,
        id: id
      }
    })
    // 发送
    wsc[user.id] && wsc[user.id].send(msg, function (error) {
      if (error) {
        // 发送失败
        wsc[id] = null
        delete wsc[id]
        cb && cb()
        return
      }
      if (index === len - 1) {
        // 最后一条发送成功
        // 删除连接
        wsc[id] = null
        delete wsc[id]
        // 删除数据
        if (rooms[roomId] && rooms[roomId][userId]) {
          rooms[roomId][userId] = null
          delete rooms[roomId][userId]
        }
        // 回调
        cb && cb()
      }
    })
  })
}
// 处理有人对话
function handleMsg ({ id, data }) {
  const { userId, roomId } = data
  const keys = Object.keys(rooms[roomId])
  keys.forEach((key, index) => {
    const user = rooms[roomId][key]
    // 发送
    const msg = JSON.stringify({
      event: 'msg',
      data: data
    })
    wsc[user.id] && wsc[user.id].send(msg, function (error) {
      if (error) {
        return
      }
    })
  })
}
