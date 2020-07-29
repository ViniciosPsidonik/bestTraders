const fs = require('fs')
const axios = require('axios')
const WebSocket = require('ws')
const moment = require('moment')
const Rank = require('./mongo')
const cors = require('cors')
const bodyParser = require('body-parser')

var express = require('express')
var app = express()
app.use(cors({ origin: '*' }))
app.use(bodyParser.json())

let logging

let runningActives = []
let runningActivesBinary = []
let runningActivesDigital = []
let runningActivesDigitalFive = []

setInterval(() => {
    if (logging && logging.log) {
        console.log('Turbo: ' + runningActives.length)
        console.log('Binary: ' + runningActivesBinary.length)
        console.log('Digital: ' + runningActivesDigital.length)
        console.log('DigitalFive: ' + runningActivesDigitalFive.length)
        console.log('===================')
        log(buysMap.size)
    }
}, 5000)

let tryingToLogin = false
const checkLogin = setInterval(() => {
    if (runningActives.length == 0 && runningActivesBinary == 0 && runningActivesDigital == 0 && runningActivesDigitalFive == 0 && !tryingToLogin) {
        tryingToLogin = true
        ws = new WebSocket(url)
        ws.onopen = onOpen
        ws.onerror = onError
        ws.onmessage = onMessage
        axios.post('https://auth.iqoption.com/api/v2/login', {
            identifier: "vinipsidonik@hotmail.com",
            password: "gc896426"
        }).then((response) => {
            ssid = response.data.ssid
            loginAsync(ssid)
        }).catch(function (err) {
            if (err)
                console.log('Erro ao se conectar... Tente novamente')
        })
    }
}, 5000);

setInterval(() => {
    runningActives = []
    runningActivesBinary = []
    runningActivesDigital = []
    runningActivesDigitalFive = []

    axios.get('https://besttraders.herokuapp.com/')
}, 300000)

app.get('/bestTraders/:tagId', function (req, res) {
    let number = req.params.tagId
    Rank.find({ win: { $gte: 50 } }).limit(parseInt(number)).sort([['percentageWins', -1], ['totalTrades', -1]]).exec((err, docs) => {
        log(docs)
        let itemsBack = []
        for (let index = 0; index < docs.length; index++) {
            const element = docs[index];
            itemsBack.push(element.userId)
        }
        res.send(itemsBack)
    })

})

app.post('/log', (req, res) => {
    logging = req.body
    log(req.body)
    res.status(200).send()
})

let ini

app.get('/', function (req, res) {
    res.send('Opa')
})

const PORT = process.env.PORT || 3000
app.listen(PORT)
const log = m => {
    console.log(m)

}

const url = 'wss://iqoption.com/echo/websocket'

let name
let ssid

let timesMap = new Map()
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

            if (logging && logging.logg)
                log(pricesMap.get(1))

            let won = value.direction == 'call' && value.priceAtBuy <= pricesMap.get(value.active) || value.direction == 'put' && value.priceAtBuy >= pricesMap.get(value.active)
            let win = won ? 1 : 0
            let loss = !won ? 1 : 0

            let lastTrade = moment.unix(value.expiration / 1000).utcOffset(-3).format("HH:mm DD/MM/YYYY")

            if (value.userId == '70421908') {
                log('won: ' + won)
            }

            Rank.find({ userId: value.userId }, function (err, docs) {
                if (docs.length == 0) {
                    new Rank({ userId: value.userId, win, loss, percentageWins: 0, totalTrades: 1, ...value, lastTrade }).save()
                } else {
                    const wins = win ? docs[0].win + 1 : docs[0].win
                    const totalTrades = docs[0].win + docs[0].loss + 1
                    const percentageWins = (wins * 100) / totalTrades
                    if (logging && logging.logFoundTrades) {
                        log(win)
                        log(docs[0].win)
                        log(docs[0].loss)
                        log(docs[0].percentageWins)
                        log(docs[0].totalTrades)
                        log(value.userId)
                        log('==================')
                    }
                    Rank.findOneAndUpdate({ userId: value.userId }, { percentageWins, lastTrade, $inc: { win, loss, totalTrades: 1 } }, (err, result) => {
                        if (err)
                            log(err)
                    })
                }
            }).exec();
            buysMap.delete(key)
        }
    }
}

let minAux

const onMessage = e => {
    const message = JSON.parse(e.data)
    if (message.name == 'heartbeat') {
        currentTime = message.msg
        let currentTimeMinute = moment.unix(currentTime / 1000).utcOffset(0).format("mm")
        if (minAux != currentTimeMinute) {
            minAux = currentTimeMinute
            sendToDataBase()
        }
    }

    if (message.name == 'candles-generated') {
        let at = message.msg.at
        at = parseInt(at.toString().substring(0, 10))

        pricesMap.set(message.msg.active_id, message.msg.value)
        if (!timesMap.has(at)) {
            timesMap.set(at, new Map(pricesMap))
        }
        if (timesMap.size > 10) {
            for (let [key, value] of timesMap) {
                timesMap.delete(key)
                break
            }
        }
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

        let priceAtBuy
        if (timesMap.has(parseInt(msg.created_at.toString().substring(0, 10))) && timesMap.get(parseInt(msg.created_at.toString().substring(0, 10))).has(msg.active_id)) {
            priceAtBuy = timesMap.get(parseInt(msg.created_at.toString().substring(0, 10))).get(msg.active_id)
        } else {
            priceAtBuy = pricesMap.get(msg.active_id)
        }

        buysMap.set(msg.option_id, { createdAt: msg.created_at, expiration: msg.expiration, direction: msg.direction, active: msg.active_id, userId: msg.user_id, name: msg.name, priceAtBuy })
        if (message.msg.option_type == 'turbo') {
            if (!runningActives.includes(message.msg.active_id))
                runningActives.push(message.msg.active_id)
        } else {
            if (!runningActivesBinary.includes(message.msg.active_id))
                runningActivesBinary.push(message.msg.active_id)
        }
    }
    if (message.name == "live-deal-digital-option") {

        let priceAtBuy
        if (timesMap.has(parseInt(msg.created_at.toString().substring(0, 10))) && timesMap.get(parseInt(msg.created_at.toString().substring(0, 10))).has(msg.active_id)) {
            priceAtBuy = timesMap.get(parseInt(msg.created_at.toString().substring(0, 10))).get(msg.active_id)
        } else {
            priceAtBuy = pricesMap.get(msg.active_id)
        }

        buysMap.set(msg.position_id, { createdAt: msg.created_at, expiration: msg.instrument_expiration, direction: msg.instrument_dir, active: msg.instrument_active_id, userId: msg.user_id, name: msg.name, priceAtBuy })
        if (message.msg.expiration_type == 'PT1M') {
            if (!runningActivesDigital.includes(message.msg.instrument_active_id))
                runningActivesDigital.push(message.msg.instrument_active_id)
        } else {
            if (!runningActivesDigitalFive.includes(message.msg.instrument_active_id))
                runningActivesDigitalFive.push(message.msg.instrument_active_id)
        }
    }

}

let ws = new WebSocket(url)
ws.onopen = onOpen
ws.onerror = onError
ws.onmessage = onMessage

const loginAsync = async () => {
    await doLogin(ws)
}

const doLogin = () => {
    return new Promise((resolve, reject) => {
        if (ws.readyState === WebSocket.OPEN) {
            console.log(JSON.stringify({ 'name': 'ssid', 'msg': ssid, "request_id": "" }))
            ws.send(JSON.stringify({ 'name': 'ssid', 'msg': ssid, "request_id": '' }))
            tryingToLogin = false
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

