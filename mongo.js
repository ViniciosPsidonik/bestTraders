const mongoose = require('mongoose')
const mongoURI = process.env.MONGO || 'mongodb+srv://vinipsidonik:gc896426@cluster0-dq8ia.mongodb.net/test?retryWrites=true&w=majority'
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })

var schema = new mongoose.Schema({ win: Number, loss: Number, lastTrade: Number, name: String, userId: Number, percentageWins: Number, totalTrades: Number });
mongoose.set('useFindAndModify', false)

var Rank = mongoose.model('Rank', schema)

module.exports = Rank