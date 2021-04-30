class Events {
  constructor () {
    this.events = {}
  }
  on (type, fn) {
    if (!this.events[type]) {
      this.events[type] = []
    }
    this.events[type].push(fn)
  }
  off (type, fn) {
    if (this.events[type] && this.events[type].length) {
      this.events[type] = this.events[type].filter(ele => ele !== fn)
    }
  }
  $emit (type, params) {
    if (this.events[type] && this.events[type].length) {
      this.events[type].forEach((fn, index) => {
        fn && fn(params)
      })
    }
  }
}

class Mrtc extends Events {
  constructor(el, options) {
    super()
    // 根元素
    this.el = el
    // socket链接
    this.socketUrl = options && options.socketUrl
    // stun和turn服务器
    this.iceServer = options && options.iceServer
    this.id = this.createGuid()
    // 连接
    this.pc = null
    this.pcList = {}
    // 流
    this.stream = null
    this.streamList = []
    // 数据传输
    this.dataChannel = null
    this.dataChannelList = {}
    this.socket = null
    this.userId = ''
    this.userName = ''
    this.roomId = ''
    // 全部人
    this.userList = []
    // 状态
    this.isLogin = false
    // 监听浏览器
    this.watchWindow()
  }
  // 监听浏览器
  watchWindow () {
    window.addEventListener("beforeunload", (event) => {
      this.logout()
      // event.returnValue = '重新加载？'
    })
  }
  // 初始化
  init () {
    this.id = this.createGuid()
    // 连接
    this.pc = null
    this.pcList = {}
    // 流
    this.stream = null
    this.streamList = []
    // 数据传输
    this.dataChannel = null
    this.dataChannelList = {}
    this.socket = null
    this.userId = ''
    this.userName = ''
    this.roomId = ''
    // 全部人
    this.userList = []
    // 状态
    this.isLogin = false
  }
  // 登录
  login({
    userId,
    userName,
    roomId
  }) {
    if (this.isLogin) {
      alert('不能重复登录')
      return
    }
    if (!userId || !roomId) {
      alert('userId 或 roomId 不能为空')
      return
    }
    this.userId = userId
    this.userName = userName
    this.roomId = roomId
    const user = {
      id: this.id,
      userId: this.userId,
      userName: this.userName,
      roomId: this.roomId
    }
    this.initSocket(this.socketUrl)
    this.getLocalStream().then(_ => {
      // this.pc = this.createPc(user)
      this.sendSocket({
        event: 'join',
        data: user
      })
      this.isLogin = true
    })
  }
  // 退出
  logout() {
    if (!this.isLogin) {
      return
    }
    this.sendSocket({
      event: 'leave',
      data: {
        userId: this.userId,
        roomId: this.roomId
      }
    })
    this.clearView()
    this.init()
  }
  sendMsg (msg) {
    this.sendSocket({
      event: 'msg',
      data: {
        id: this.id,
        userId: this.userId,
        userName: this.userName,
        roomId: this.roomId,
        sendTime: Date.now(),
        msg: msg
      }
    })
  }
  // 初始化socket
  initSocket(socketUrl) {
    if (!socketUrl) {
      alert('socket链接不能为空')
      return
    }
    this.socketUrl = socketUrl
    const url = this.socketUrl + (this.socketUrl.indexOf('?') > -1 ? '&' : '?') + 'id=' + this.id
    this.socket = new WebSocket(url)
    this.receiveSocket()
  }
  // 发送socket
  sendSocket(data) {
    try {
      data = typeof data === 'string' ? data : JSON.stringify(data)
    } catch (error) {}
    this.socket.send(data)
  }
  // 接收socket
  receiveSocket() {
    this.socket.onmessage = (e) => {
      console.log('socket接受消息 -->', e)
      const json = JSON.parse(e && e.data)
      const event = json && json.event
      const data = json && json.data
      switch (event) {
        case 'join':
          this.handleReceiveJoin(data)
          break
        case 'leave':
          this.handleReceiveLeave(data)
          break
        case 'msg':
          this.handleReceiveMsg(data)
          break
        case '_ice_candidate':
          this.handleReceiveIceCandidate(data)
          break
        case '_offer':
          this.handleReceiveOffer(data)
          break
        case '_answer':
          this.handleReceiveAnswer(data)
          break
        default:
          break
      }
    }
  }
  // 有人加入
  handleReceiveJoin(data) {
    console.log('有人加入 -->', data)
    const list = (data && data.list) || []
    const user = (data && data.user) || {}
    this.userList = list
    if (list && list.length > 1) {
      // 已经有其他人加入
      list.forEach(item => {
        if (item.id === this.id) {
          // 如果是自己，不用重复创建
          return
        }
        item.link = this.getLink(item.id)
        this.createPc(item)
      })
      // 如果新加入的是自己，给其他人发送offer
      if (user.id === this.id) {
        for (let key in this.pcList) {
          this.pcList[key].createOffer(
            desc => {
              this.pcList[key].setLocalDescription(desc);
              this.socket.send(JSON.stringify({ 
                event: '_offer',
                data: {
                  link: key,
                  sdp: desc
                }
              }))
            },
            err => {
              console.log('发送offer失败 -->', err)
            }
          )
        }
      }
    }
  }
  // 有人退出
  handleReceiveLeave(data) {
    console.log('有人退出 -->', data)
    const { userId, roomId, id, kick } = data
    this.pcList[this.getLink(id)] = null
    if (kick && id === this.id) {
      // 被踢出的
      alert('你已被踢出房间！')
      this.clearView()
      this.init()
      return
    }
    this.userList = this.userList.filter(ele => ele.userId !== userId)
    this.removeView({
      id: id
    })
  }
  // 有人发送消息
  handleReceiveMsg (data) {
    this.$emit('msg', {
      userId: data.userId,
      userName: data.userName,
      roomId: data.roomId,
      sendTime: data.sendTime,
      receiveTime: Date.now(),
      msg: data.msg
    })
  }
  // 有人发送ice
  handleReceiveIceCandidate (data) {
    console.log('有人发送ice -->', data)
    const {link, candidate} = data
    if (candidate && link && this.pcList[link]) {
      this.pcList[link].addIceCandidate(new RTCIceCandidate(candidate))
    }
  }
  // 有人发送offer
  handleReceiveOffer (data) {
    console.log('有人发送offer -->', data)
    const {link, sdp} = data
    if (sdp && link && this.pcList[link]) {
      this.pcList[link].setRemoteDescription(new RTCSessionDescription(sdp))
      this.pcList[link].createAnswer((desc) => {
        this.pcList[link].setLocalDescription(desc)
        this.socket.send(JSON.stringify({ 
          event: '_answer',
          data: {
            link: link,
            sdp: desc
          }
        }))
      }, (error) => {
      })
    }
  }
  // 有人发送answer
  handleReceiveAnswer (data) {
    console.log('有人发送answer -->', data)
    const {link, sdp} = data
    if (sdp && link && this.pcList[link]) {
      this.pcList[link].setRemoteDescription(new RTCSessionDescription(sdp))
    }
  }
  // 绑定事件监听
  createPc(user) {
    let pc = new RTCPeerConnection(this.iceServer)
    // 发送ICE候选到其他客户端
    pc.onicecandidate = (e) => {
      console.log('发送ICE候选到其他客户端')
      if (e.candidate !== null) {
        this.socket.send(JSON.stringify({
          event: '_ice_candidate',
          data: {
            id: user.id,
            link: user.link,
            candidate: e.candidate
          }
        }))
      }
    }
    // 检测流媒体
    pc.onaddstream = (e) => {
      console.log('检测流媒体 -->', e)
      this.addView({
        // 非本地
        local: false,
        link: user.link,
        id: user.id,
        userId: user.userId,
        userName: user.userName,
        roomId: user.roomId,
        stream: e.stream
      })
      this.streamList[user.id] = e.stream
    }
    pc.addStream(this.stream)
    // 通信
    // let dataChannel = pc.createDataChannel('roomId')
    // dataChannel.onerror = function (error) {
    //   console.log('dataChannel -->onerror', error)
    // }
    // dataChannel.onmessage = function (event) {
    //   console.log('dataChannel -->onmessage', event)
    // }
    // dataChannel.onopen = function () {
    //   console.log('dataChannel -->onopen', dataChannel.readyState)
    // }
    // dataChannel.onclose = function () {
    //   console.log('dataChannel -->onclose')
    // }
    // pc.ondatachannel = function (e) {
    //   console.log('消息监听 -->e', e)
    //   var receiveChannel = e.channel;
    //   receiveChannel.onmessage = (res) => {
    //     console.log('消息监听 收到 -->', res)
    //   };
    //   receiveChannel.onopen = (res) => {
    //     console.log('消息监听 打开')
    //   };
    //   receiveChannel.onclose = (res) => {
    //     console.log('消息监听 关闭')
    //   };
    // }
    // 储存
    if (user.link) {
      this.pcList[user.link] = pc
      // this.dataChannelList[user.link] = pc
    }
    return pc
  }
  // 获取本地视频流
  getLocalStream() {
    return new Promise((resolve, reject) => {
      navigator.webkitGetUserMedia({
        audio: true,
        video: true
      }, (stream) => {
        this.stream = stream
        this.streamList[this.id] = stream
        // console.log('获取本地流 -->', this.pc)
        // this.pc.addStream(this.stream)
        this.addView({
          // 本地
          local: true,
          id: this.id,
          userId: this.userId,
          userName: this.userName,
          roomId: this.roomId,
          stream: this.stream
        })
        resolve()
      }, (err) => {
        console.log('获取本地视频流失败 -->', err)
        reject()
      })
    })
  }
  // 创建视频
  addView(info) {
    let video = document.getElementById('video-' + info.id)
    if (video) {
      video.srcObject = info.stream
    } else {
      video = document.createElement('video');
      video.autoplay = 'autoplay';
      video.srcObject = info.stream;
      video.id = 'video-' + info.id
      let wrap = document.createElement('div')
      wrap.id = 'wrap-' + info.id
      wrap.innerHTML = `<div>${info.userName || '-'}</div>`
      wrap.appendChild(video)
      this.el.appendChild(wrap)
    }
  }
  // 删除视频
  removeView (info) {
    const video = document.getElementById('video-' + info.id)
    if (video) {
      try {
        console.log('设备', video.srcObject.getTracks())
        video.srcObject.getTracks().forEach(ele => {
          ele && ele.stop()
        })
      } catch (error) {
        console.log('关闭摄像头失败 -->', error)
      }
      video.srcObject = null
      video.srcObject = null
    }
    const wrap = document.getElementById('wrap-' + info.id)
    if (wrap) {
      wrap.removeChild(video)
      wrap.parentNode && wrap.parentNode.removeChild(wrap)
    }
  }
  // 清空视频
  clearView () {
    this.userList.forEach(item => {
      this.removeView({
        id: item.id
      })
    })
    this.el.innerHTML = ''
  }
  getLink (id) {
    return [this.id, id].sort().join(':')
  }
  createGuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0
      var v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
}