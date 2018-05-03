const Main = require("./socket.io.config")
const ServerManager = require("./server")
const Withdraw = require("./withdraw.socket")
const Deposit = require("./deposit.socket")
//const Match = require("./match.socket")
const TradeBotTcp = require("./tcp")
const App = require("../app")


const appSession = App.session;
const startInterval = ServerManager.StartInterval
const matchMain = Match.Main
const depositMain = Deposit.Main
const withdrawMain = Withdraw.Main


module.exports = {
    appSession,
    startInterval,
    matchMain,
    depositMain,
    withdrawMain
}