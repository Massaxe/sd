module.exports = {
    Main
}

const url = require('url')
var config = require("./socket.io.config.js")
var request = require("request")
const tcp = require("./tcp.js")
var collection_users;
var lobbies;
const prices = [];
var price_collection
var bot_inventory;

function Main(io) {
    var MongoClient = require('mongodb').MongoClient;
    var session = require("../app.js").session;
    var sharedsession = require("express-socket.io-session");
    var io_withdraw = io;

    var uri = "mongodb://localhost";
    var body;

    MongoClient.connect(uri, (err, client) => {
        if (err) throw err;
        collection_users = client.db("skinduel").collection("users");
        price_collection = client.db("items").collection("itemPrices");

        io_withdraw.on("connection", (socket) => {
            let user
            try {
                user = socket.handshake.session.passport.user;
            }
            catch (e) {
                console.log("Withdraw IO Connection error: " + e);
                user = false;
            }


            if (user) {
                socket.steamUser = user;
                //config.BroadcastLobbies(client, socket)
                //config.UpdatePlayerSocket(client, socket)

                //TODO: Remember to add a waiting splash screen if "in_trade" emits
                //config.UpdatePlayer(client, socket)
                ReturnBotInventory(socket, client)

                TokenCheck(false, socket)

                socket.on("token_send", (data) => {
                    TokenDB(client, socket, data);
                })




                socket.on("start_withdraw", (data) => {
                    WithdrawStart(data)
                })

                exports.TradeConfirm = function TradeConfirm(steam_id, success) {
                    collection_users.findOne({ steamId: steam_id },
                        function UpdateTradeBalance(err, res, success) {
                            if (success) {
                                var trade_current = res.currentTrade.split(",")
                                var trade_value = 0;
                                prices.forEach(e => {
                                    for (var i = 0; i < trade_current.length; i++) {
                                        if (e.Assetid === trade_current) {
                                            trade_value += e.Price;
                                        }
                                    }
                                });
                                trade_value = trade_value * -1;
                                collection_users.updateOne({ steamId: res.steamId }, { $inc: { balance: trade_value }, $set: { currentTrade: "" } }, (err, res2) => {
                                    socket.to(res.socketId).emit("trade_success")
                                })
                            } else {
                                collection_users.updateOne({ steamId: res.steamId }, { $set: { currentTrade: "" } }, (err, res2) => {
                                    socket.to(res.socketId).emit("trade_fail")
                                })
                            }

                        })
                }
            }

            function WithdrawStart(items) {
                var trade_list = []
                items.forEach(item => {
                    for (var j = 0; j < bot_inventory.length; j++) {
                        if (item.Assetid === bot_inventory[j].Assetid) {
                            trade_list.push(bot_inventory[j].Assetid)
                        }
                    }
                });
                if (trade_list.length > 0) {
                    collection_users.findOne({ steamId: socket.steamUser.id }, (err, res) => {
                        if (TokenCheck(res, false)) {
                            if (res.currentTrade.length < 1) {
                                trade_list.join(",")
                                TradeSend(socket, trade_list, client)
                            }
                            else {
                                socket.emit("alert", "You're currently in a trade")
                                socket.emit("in_trade")
                            }
                        }
                        else {
                            TokenRequest(socket)
                        }
                    })
                }
            }
        })
    })
}






function TradeSend(socket, trade_list, client) {
    let send_string
    try {
        send_string = "w ${res.steamId} ${res.token} ${trade_list}"
        tcp.WriteToTrade({ trade_string: send_string, steam_id: socket.steamUser.id })
        TradeDB(client, socket, trade_list)
        socket.emit("trade_wait")
    }
    catch (e) {
        console.log(e)
        socket.emit("alert", "Trade bot offline")
    }
}


function TradeDB(client, socket, trade_list) {
    collection_users.updateOne({ steamId: socket.steamUser.id }, { $set: { currentTrade: trade_list } })
}

function TokenCheck(user, socket) {
    if (user) {
        if (user.token.length > 0) { return true }
        else { return false }
    }
    else if (socket) {
        collection_users.findOne({ steamId: socket.steamUser.id }, (err, res) => {
            if (res.token.length > 0) { return true }
            else {
                TokenRequest(socket)
                return false
            }
        })
    }
}

function TokenRequest(socket) {
    socket.emit("token")
}

function TokenDB(client, socket, token) {
    collection_users.updateOne({ steamId: socket.steamUser.id }, { $set: { token: token } },
        function EmitTokenConfirm(err, res) {
            socket.emit("token_confirm", { status: true })
        })
}



function compare(a, b) {
    const genreA = a.Name.toUpperCase();
    const genreB = b.Name.toUpperCase();

    var comparison = 0;
    if (genreA > genreB) {
        comparison = 1;
    } else if (genreA < genreB) {
        comparison = -1;
    }
    return comparison;
}



function ReturnBotInventory(socket, client) {
    const bot_steam_id = "76561198252974123"
    let itemUrl = "http://steamcommunity.com/inventory/" + bot_steam_id + "/730/2?l=english&count=5000";
    let itemArray = [];
    let itemNames = [];

    const value_multiplier = 15;

    request({
        url: itemUrl,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200 && body.total_inventory_count > 0) {
            body.assets.forEach(element => {
                let x = body.descriptions;
                const result = x.find(item => item.classid === element.classid && item.instanceid === element.instanceid);

                if (result.tradable == 1) {
                    let desc = result.descriptions[0].value.replace("Exterior: ", "");

                    let itemName;

                    if (result.name.indexOf("Music") < 0) {
                        if (desc.length < 20 && desc.length > 1)
                            itemName = (result.name + " (" + desc + ")");
                        else
                            itemName = result.name;

                        let newItem = {
                            Assetid: element.assetid,
                            Classid: element.classid,
                            Instanceid: element.instanceid,
                            //Descriptions: desc,
                            Name: itemName,
                            Icon: "http://cdn.steamcommunity.com/economy/image/" + result.icon_url,
                            Price: ""
                        }
                        itemArray.push(newItem);

                        let pos = itemNames.map(function (e) { return e.Name; }).indexOf(newItem.Name);

                        if (pos === -1) {
                            name_new = newItem.Name.replace(/['"]+/g, "")
                            itemNames.push({ Name: name_new, quantity: 1 });
                        }
                        else {
                            itemNames[pos].quantity++;
                        }
                    }
                }
            });
            itemArray.sort(compare);

            var queryName = itemNames.map(function (obj) {
                return obj.Name.replace(/['"]+/g, "");
            });
            price_collection.find({ "name": { $in: queryName } }).toArray(function (err, docs) {
                var sendList = [];
                itemArray.forEach((item_skin) => {
                    var item_name = item_skin.Name.replace(/['"]+/g, "");
                    var a = docs.find(item => item.name === item_name);
                    if (a) {
                        let price_temp = a.price * value_multiplier;
                        item_skin.Price = price_temp
                        LocalPrices({ Assetid: item_skin.Assetid, Price: item_skin.Price })
                        sendList.push(item_skin);
                    }
                })
                var testArray = [];
                for (var m = 0; m < sendList.length; m++) {
                    testArray.push(sendList[m].Name);
                }
                for (var k = 0; k < itemArray.length; k++) {
                    if (testArray.indexOf(itemArray[k].Name) < 0) {
                        //console.log("------------------" + itemArray[k].Name + "------------------");
                    }
                }
                bot_inventory = sendList
                socket.emit("items", { items: sendList })
            });
        }
    })
}

function LocalPrices(item) {
    var pos = prices.map(function (e) { return e.Assetid; }).indexOf(item.Assetid);
    if (pos < 0) {
        prices.push(item)
    }
    else {
        prices.splice(pos, 1);
        prices.push(item)
    }
}

