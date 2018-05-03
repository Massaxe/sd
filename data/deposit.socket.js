module.exports = {
    Main
}

const url = require('url');
var config = require("./socket.io.config.js")
var ServerManager = require("./server.js");
var request = require("request")
const tcp = require("./tcp")
var collection_user;
var lobbies;
var prices = []

//TODO: Don't allow deposit if in trade.

function Main(io) {

    var MongoClient = require('mongodb').MongoClient;
    var session = require("../app.js").session;
    var sharedsession = require("express-socket.io-session");
    var dio = io




    var uri = "mongodb://localhost";
    var body;

    MongoClient.connect(uri, (err, client) => {
        if (err) throw err;
        collection_user = client.db("skinduel").collection("users");

        dio.on("connection", (socket) => {
            try {
                if (user = socket.handshake.session.passport.user) {
                    socket.steamUser = user;
                    //config.BroadcastLobbies(client, socket)
                    //config.UpdatePlayerSocket(client, socket)
                    //config.UpdatePlayer(client, socket)

                    ReturnInventory(socket, client)

                    TokenCheck(false, socket)

                    socket.on("token_send", (data) => {
                        TokenDB(client, socket, data);
                    })



                    socket.on("start_deposit", (data) => {
                        DepositStart(client, socket, data)
                    })

                    exports.TradeConfirm = function TradeConfirm(steamId, success) {
                        collection_user.findOne({ steamId: steamId }, (err, res) => {
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
                                collection_user.updateOne({ steamId: res.steamId }, { $inc: { balance: trade_value }, $set: { currentTrade: "" } }, (err, res2) => {
                                    socket.to(res.socketId).emit("trade_success")
                                })
                            }
                            else {
                                collection_user.updateOne({ steamId: res.steamId }, { $set: { currentTrade: "" } }, (err, res2) => {
                                    socket.to(res.socketId).emit("trade_fail")
                                })
                            }
                        })

                    }
                }
            }
            catch (e) {
                console.log("DIO Connection error: " + e);
            }


        })

        



    })
}





function DepositStart(client, socket, items) {
    var trade_list = []

    var inventory = socket.steamUser.inventory
    for (var i = 0; i < items.length; i++) {
        for (var j = 0; j < inventory.length; j++) {
            if (items[i].Assetid === inventory[j].Assetid) {
                trade_list.push(inventory[j].Assetid)
            }
        }
    }
    if (trade_list.length > 0) {
        collection_user.findOne({ steamId: socket.steamUser.id }, (err, res) => {
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

function TradeSend(socket, trade_list, client) {
    try {
        tcp.WriteToTrade(send_string)
        var send_string = "d ${res.steamId} ${res.token} ${trade_list}"
        TradeDB(client, socket, trade_list)
        TradeWait(socket)


    }
    catch (e) {
        console.log(e)
        socket.emit("alert", "Trade bot offline")
    }
}



function TradeWait(socket) {
    socket.emit("trade_wait")
}

function TradeDB(client, socket, trade_list) {
    collection_user.updateOne({ steamId: socket.steamUser.id }, { $set: { currentTrade: trade_list } })
}

function TokenCheck(user, socket) {
    if (user) {
        if (user.token.length > 0) { return true }
        else { return false }
    }
    else if (socket) {
        collection_user.findOne({ steamId: socket.steamUser.id }, (err, res) => {
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
    collection_user.updateOne({ steamId: socket.steamUser.id }, { $set: { token: token } }, (err, res) => {
        TokenConfirm(socket)
    })
}

function TokenConfirm(socket) {
    socket.emit("token_confirm", { status: true })
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



function ReturnInventory(socket, client) {
    var adamID = "76561198069841365"
    var itemUrl = "http://steamcommunity.com/inventory/" + socket.steamUser.id + "/730/2?l=english&count=5000";
    //var itemUrl = "http://steamcommunity.com/inventory/" + adamID + "/730/2?l=english&count=5000";
    var itemArray = [];
    var itemNames = [];
    var collection = client.db("items").collection("itemPrices");

    request({
        url: itemUrl,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200 && body.total_inventory_count > 0) {
            body.assets.forEach(element => {
                var x = body.descriptions;
                const result = x.find(item => item.classid === element.classid && item.instanceid === element.instanceid);

                if (result.tradable == 1) {
                    var desc = result.descriptions[0].value.replace("Exterior: ", "");

                    var itemName;

                    if (result.name.indexOf("Music") < 0) {
                        if (desc.length < 20 && desc.length > 1)
                            itemName = (result.name + " (" + desc + ")");
                        else
                            itemName = result.name;

                        var newItem = {
                            Assetid: element.assetid,
                            Classid: element.classid,
                            Instanceid: element.instanceid,
                            //Descriptions: desc,
                            Name: itemName,
                            Icon: "http://cdn.steamcommunity.com/economy/image/" + result.icon_url,
                            Price: ""
                        }
                        itemArray.push(newItem);

                        pos = itemNames.map(function (e) { return e.Name; }).indexOf(newItem.Name);

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
            collection.find({ "name": { $in: queryName } }).toArray(function (err, docs) {
                var sendList = [];
                itemArray.forEach((item_skin) => {
                    var item_name = item_skin.Name.replace(/['"]+/g, "");
                    var a = docs.find(item => item.name === item_name);
                    if (a) {
                        item_skin.Price = a.price;
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
                socket.steamUser.inventory = sendList
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

