require('dotenv').config();
const mongoose = require('mongoose')

const mongoURI = process.env.MONGO
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })

var schema = new mongoose.Schema({ win: Number, loss: Number, lastTrade: Date, name: String, userId: Number, percentageWins: Number, totalTrades: Number });
mongoose.set('useFindAndModify', false)

var Rank = mongoose.model('Rank', schema)

module.exports = Rank