var net = require('net')
const report_deposit = require("./deposit.socket")
const report_withdraw = require("./withdraw.socket")


var connected = false
let socket_global

var server = net.createServer(socket => {
    socket.setEncoding("ascii");

    socket.write("Valkommen");
    console.log("Trade bot connected");

    /*socket.on("end", () => {
        console.log("Socket closed");
        server.close(() => {
            console.log("TCP server closed");
        });
    });*/

    socket_global = socket;


    socket.on('data', (data) => {
        if (data.length > 18) {
            var split = data.split(",")
            var all_trades = []
            split.forEach(e => {
                var x = e.split(" ")
                var trade_status = {
                    steamId: x[0],
                    status: x[1]
                }
                all_trades.push(trade_status)
            });


            all_trades.forEach(e => {
                if (e.status === 0) {
                    report_deposit.TradeConfirm(e.steamId, false)
                }
                else if (e.status === 1) {
                    report_deposit.TradeConfirm(e.steamId, true)
                }
            });
        }
    });

    socket.on("error", () => { console.log(Date.now + " | TCP Error. Probably SteamBot disconnect") })
});
server.on('error', (err) => {
    console.log("Error: " + err);
});
server.listen(84, () => {
    console.log("Listening for CSGO Trade on port 84");
});


function WriteToTrade(trade_info) {
    let type_substr = trade_info.trade_string.substring(0, 1)
    try {
        socket_global.write(trade_info.trade_string);
        if (type_substr === "w")
            report_withdraw.TradeConfirm(trade_info.steam_id, true)
    }
    catch (e) {
        console.log(e)
        if (type_substr === "w")
            report_withdraw.TradeConfirm(trade_info.steam_id, false)
    }
}

module.exports = {
    WriteToTrade
}
