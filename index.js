const fs = require('fs')
const axios = require('axios')
const WebSocket = require('ws')
const moment = require('moment')
const Rank = require('./mongo')
const cors = require('cors')

var express = require('express')
var app = express()
app.use(cors({ origin: '*' }))


app.get('/bestTraders/:tagId', function (req, res) {
    let number = req.params.tagId
    Rank.find({}).limit(parseInt(number)).sort([['percentageWins', -1], ['totalTrades', -1]]).exec((err, docs)=> {
        log(docs)
        let itemsBack = []
        for (let index = 0; index < docs.length; index++) {
            const element = docs[index];
            itemsBack.push(element.userId)
        }
        res.send(itemsBack)
    })

})

const PORT = process.env.PORT || 3000
app.listen(PORT)
const log = m => {
    console.log(m)
}

const url = 'wss://iqoption.com/echo/websocket'

let name
let ssid

let pricesMap = new Map()
let buysMap = new Map()

const activesMap = [108, 7, 943, 101, 7, 943, 101, 944, 99, 107, 2, 4, 1, 104, 102, 103, 3, 947, 5, 8, 100, 72, 6, 168, 105, 212]
const activesMapDigital = [7, 943, 7, 943, 101, 944, 99, 107, 2, 4, 1, 104, 102, 103, 3, 947, 5, 8, 100, 72, 6, 168, 105]
const otcActives = [76, 77, 78, 79, 80, 81, 84, 85, 86]
const otcActivesDigital = [76, 77, 78, 79, 80, 81, 84, 85, 86]

const onOpen = () => {
    console.log(`Connected with websocket..`)
}

const onError = error => {
    console.log(`WebSocket error: ${error}`)
}

const messageHeader = (body, name) => {
    return { 'name': name, 'msg': body, "request_id": "" }
}

const subscribeLiveDeal = (name, active_id, type, expirationTime) => {
    let data
    if (type == 'digital') {
        data = {
            "name": name,
            "params": {
                "routingFilters": {
                    "instrument_active_id": active_id,
                    "expiration_type": "PT" + expirationTime + "M"
                }
            },
            "version": "2.0"
        }
    } else {
        data = {
            'name': name,
            'params': {
                'routingFilters': {
                    'active_id': active_id,
                    'option_type': type
                }
            },
            'version': '2.0'
        }
    }

    ws.send(JSON.stringify(messageHeader(data, 'subscribeMessage')))
}

let currentTime

const sendToDataBase = () => {
    for (let [key, value] of buysMap) {
        if (parseInt(value.expiration) <= parseInt(currentTime)) {
            let won = value.direction == 'call' && value.priceAtBuy <= pricesMap.get(value.active) || value.direction == 'put' && value.priceAtBuy >= pricesMap.get(value.active)
            let win = won ? 1 : 0
            let loss = !won ? 1 : 0

            Rank.find({ userId: value.userId }, function (err, docs) {
                if (docs.length == 0) {
                    new Rank({ userId: value.userId, win, loss, percentageWins: 0, totalTrades: 1, ...value }).save()
                } else {
                    const wins = win ? docs[0].win + 1 : docs[0].win
                    const totalTrades = docs[0].win + docs[0].loss + 1
                    const percentageWins = (wins * 100) / totalTrades
                    Rank.findOneAndUpdate({ userId: value.userId }, { $inc: { win, loss }, percentageWins, totalTrades }, (err, result) => {
                        if (err)
                            log(err)
                    })
                }
            }).exec();
            buysMap.delete(key)
        }
    }
}

setInterval(() => {
    log(buysMap.size)
}, 5000);

const onMessage = e => {
    const message = JSON.parse(e.data)
    if (message.name == 'heartbeat') {
        currentTime = message.msg
        sendToDataBase()
    }

    if (message.name == 'candles-generated') {
        pricesMap.set(message.msg.active_id, message.msg.value)
    }

    if (message.name == 'profile') {
        for (let i = 0; i < activesMap.length; i++) {
            ws.send(JSON.stringify({ "name": "sedMessage", "msg": { "name": "get-candles", "version": "2.0", "body": { "active_id": activesMap[i], "size": 1, "to": currentTime, "count": 100, "": 1 } }, "request_id": "" }))
            ws.send(JSON.stringify({ "name": "subscribeMessage", "msg": { "name": "candles-generated", "params": { "routingFilters": { "active_id": activesMap[i] } } }, "request_id": "" }))
        }
        subscribeActives()
    }

    const msg = message.msg
    if (message.name == "live-deal-binary-option-placed") {
        buysMap.set(msg.option_id, { createdAt: msg.created_at, expiration: msg.expiration, direction: msg.direction, active: msg.active_id, userId: msg.user_id, name: msg.name, priceAtBuy: pricesMap.get(msg.active_id) })
    }
    if (message.name == "live-deal-digital-option") {
        buysMap.set(msg.position_id, { createdAt: msg.created_at, expiration: msg.instrument_expiration, direction: msg.instrument_dir, active: msg.instrument_active_id, userId: msg.user_id, name: msg.name, priceAtBuy: pricesMap.get(msg.active_id) })
    }

}

const ws = new WebSocket(url)
ws.onopen = onOpen
ws.onerror = onError
ws.onmessage = onMessage

const loginAsync = async () => {
    await doLogin(ws)
}

const doLogin = () => {
    return new Promise((resolve, reject) => {
        console.log(JSON.stringify({ 'name': 'ssid', 'msg': ssid, "request_id": "" }))
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 'name': 'ssid', 'msg': ssid, "request_id": '' }))
            resolve()
        }
    })
}

axios.post('https://auth.iqoption.com/api/v2/login', {
    identifier: "vinipsidonik@hotmail.com",
    password: "gc896426"
}).then((response) => {
    ssid = response.data.ssid
    loginAsync(ssid)
}).catch(function (err) {
    if (err) {
        console.log('Erro ao se conectar... Tente novamente')
        console.log(err);
    }
})
function subscribeActives() {
    name = 'live-deal-binary-option-placed'
    for (let i = 0; i < activesMap.length; i++) {
        subscribeLiveDeal(name, activesMap[i], 'turbo')
    }

    for (let i = 0; i < activesMap.length; i++) {
        subscribeLiveDeal(name, activesMap[i], 'binary')
    }

    name = 'live-deal-digital-option'
    for (let i = 0; i < activesMapDigital.length; i++) {
        subscribeLiveDeal(name, activesMapDigital[i], 'digital', '1')
    }

    for (let i = 0; i < activesMapDigital.length; i++) {
        subscribeLiveDeal(name, activesMapDigital[i], 'digital', '5')
    }
    for (let i = 0; i < otcActives.length; i++) {
        subscribeLiveDeal(name, otcActives[i], 'turbo')
    }

    for (let i = 0; i < otcActives.length; i++) {
        subscribeLiveDeal(name, otcActives[i], 'binary')
    }
    name = 'live-deal-digital-option'
    for (let i = 0; i < otcActivesDigital.length; i++) {
        subscribeLiveDeal(name, otcActivesDigital[i], 'digital', '1')
    }

    for (let i = 0; i < otcActivesDigital.length; i++) {
        subscribeLiveDeal(name, otcActivesDigital[i], 'digital', '5')
    }

}

