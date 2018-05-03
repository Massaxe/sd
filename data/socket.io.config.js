//TODO: Use socket rooms instead of instances. It simplifies situations where the user switches sites midd lobby wait fe
module.exports = {
    Main,
    UpdateLobbySocket,
    UpdatePlayer,
    UpdatePlayerSocket,
    BroadcastLobbies,
    ReturnPrices,
    RemovePlayer,
    RemoveLobby
}

//TODO: Gör om så att allt går igenom denna module

var ObjectId = require('mongodb').ObjectID;
var MatchManager = require("./match.socket.js")
var ServerManager = require("./server.js");
const mainMaps = ["aim_map", "aim_map_cl", "awp_india", "aim_deagle", "aim_9h_ak", "aim_map2_go"]
var uniqid = require('uniqid');
var prices;
var collection_user;
var collection_lobby;

//TODO: Player can create lobby, then withdraw skins because server checks balance before lobby create

function Main(server) {

    var MongoClient = require('mongodb').MongoClient;
    var session = require("../app.js").session;
    var sharedsession = require("express-socket.io-session");
    var request = require("request");
    var io = require('socket.io')(server);
    var mmr = io.of("/main").use(sharedsession(session));

    MatchManager.Main(server, io);
    require("./deposit.socket.js").Main(io);
    require("./withdraw.socket.js").Main(io);


    var uri = "mongodb://localhost";
    var body;


    MongoClient.connect(uri, (err, client) => {
        if (err) throw err;

        collection_user = client.db("skinduel").collection("users");
        collection_lobby = client.db("skinduel").collection("lobbies");

        UpdateItemPrices(request, client);

        ServerManager.FinishedGames(client);

        mmr.on('connection', (socket) => {
            var user;

            try {
                if (user = socket.handshake.session.passport.user) {
                    socket.steamUser = user;

                    AddUser(client, socket, request);

                    socket.on("create_lobby", (data) => {
                        CheckBalance(client, socket, data, mmr, true)
                        //CreateLobby(client, socket, data, mmr);
                    });
                    socket.on("joinLobby", (data) => {
                        CheckBalance(client, socket, data, mmr, false)
                        //JoinLobby(data, socket, client, mmr);
                    })
                    socket.on("lobbyAccept", (data) => {
                        KeepPlayer(client, socket, mmr);
                    })
                    socket.on("mapSelected", (data) => {
                        StartMatch(client, socket, data);
                    })
                    socket.on("remove_lobby", () => {
                        RemoveLobby(client, socket)
                    })

                }
            }
            catch (e) {
                console.log("MMR Connection error: " + e);
            }

            BroadcastLobbies(client, socket);

            socket.on("refreshLobbies", (data) => {
                BroadcastLobbies(client, socket);
            });
        });
    });
}
//TODO: Do not rely on information send from the client. Only check with socket id which lobby and so on
//TODO: Challenge calculation and withdraw on server. Not client


function KeepPlayer(client, socket, mmr) {
    collection_lobby.findOne({ playerIds: socket.steamUser.id, stage: { $lt: 4 } }, (err, res) => {
        if (res) {
            collection_lobby.updateOne({ socketId: socket.id, stage: { $lt: 4 } }, { $set: { stage: 2 } }, (err, result) => {
                //ReduceBalance(client, socket)
                socket.to(res.socketId[1]).emit("redirect", { to: "/match/" + res.id });
                socket.emit("redirect", { to: "/match/" + res.id });
            });
            BroadcastLobbies(client, mmr);
        }
    })
}

function RemovePlayer(client, socket, mmr, id) {
    collection_lobby.findOne({ id: id }, (err, res) => {
        if (res.stage < 2) {
            collection_lobby.updateOne({ id: id }, { $set: { "playerNames.1": "", "playerIds.1": "", "pot.1": "", "avatars.1": "", stage: 0 } },
                (err, result) => {
                    if (err) { console.log(err); }
                    BroadcastLobbies(client, mmr);
                });
        }
    })

}

function AddUser(client, socket, request) {
    var query = { steamId: socket.steamUser.id };
    collection_user.findOne(query, (err, result) => {
        if (err) throw err;
        if (result) {
            UpdatePlayer(client, socket)
            UpdatePlayerSocket(client, socket)
        }
        else {
            var newUser = { steamId: socket.steamUser.id, socketId: socket.id, username: socket.steamUser.displayName, token: "", avatar: socket.steamUser.avatarfull, balance: 5000, isTrading: false, currentTrade: "" };
            collection_user.insertOne(newUser, (err, result) => {
                if (err) throw err;
                UpdatePlayer(client, socket)
            });
        }
    });
}

function UpdatePlayer(client, socket) {
    var query = { steamId: socket.steamUser.id };
    collection_user.findOne(query, (err, result) => {
        if (result.currentTrade.length > 0) {
            socket.emit("in_trade")
        }
        socket.emit("update_player", { balance: result.balance, steam_id: result.steamId });
    });
}

function CreateLobby(client, socket, data, mmr) {
    var query = { playerIds: socket.steamUser.id, stage: { $lt: 4 } }
    collection_lobby.findOne(query, (err, result) => {
        if (err) throw err;
        if (result)
            socket.emit("lobbySpam", {});
        else {
            var lobby_id = uniqid();
            if (lobby_id.length < 14) {
                for (var i = 0; i < (14 - lobby_id.length); i++) {
                    lobby_id += "a";
                }
            }
            else if (lobby_id.length > 14) {
                lobby_id = lobby_id.slice(0, 13);
            }

            var bet = parseInt(data.amount);
            var lobby = { id: lobby_id, socketId: [socket.id, ""], avatars: [socket.steamUser.photos[2].value, ""], pot: [bet, ""], playerNames: [socket.steamUser.displayName, ""], playerIds: [socket.steamUser.id, ""], stage: 0, maps: mainMaps, turn: 1, score: [0, 0], ip: "" };
            collection_lobby.insertOne(lobby, (err, res) => {
                if (err) throw err;
                ReduceSpecificBalance(client, socket, res)
                socket.emit("redirect", { to: "/match/" + lobby.id })
                BroadcastLobbies(client, mmr);
            });

        }

    });
}

function JoinLobby(lobbyData, socket, client, mmr) {
    collection_lobby.findOne({ playerIds: socket.steamUser.id, stage: { $lt: 4 } }, (err, res) => {
        if (err) throw err;
        if (res) {
            socket.emit("alert", "Can only join one lobby bro <3");
        }
        else {
            collection_lobby.findOne({ id: lobbyData.lobby.id }, (err, res) => {
                if (res.playerIds[1].length > 1) { socket.emit("alert", "Lobby occupited") }
                else {
                    socket.to(res.socketId[0]).emit("joinRequest", { mess: "Someone wants to join you lobby!", name: socket.steamUser.displayName });
                    collection_lobby.updateOne({ id: lobbyData.lobby.id }, { $set: { "socketId.1": socket.id, "playerNames.1": socket.steamUser.displayName, "playerIds.1": socket.steamUser.id, "avatars.1": socket.steamUser.photos[2].value, "pot.1": res.pot[0], stage: 1 } },
                        (err, result) => {
                            if (err) { console.log(err); }

                            ReduceSpecificBalance(client, socket, res)
                            BroadcastLobbies(client, mmr)
                            setTimeout(() => {
                                RemovePlayer(client, socket, mmr, res.id)
                            }, 10000);
                        });
                }
            })
        }
    })
}

function CheckBalance(client, socket, data, mmr, bet_create) {
    collection_user.findOne({ steamId: socket.steamUser.id }, (err, res) => {
        if (err) { console.log(err) }
        if (res) {
            var bet_amount = parseInt(data.amount)
            if (bet_create && bet_amount <= parseInt(res.balance) && bet_amount > 49 && bet_amount < 9007199254740990) {
                CreateLobby(client, socket, data, mmr)
            }
            else if (!bet_create) {
                collection_lobby.findOne({ id: data.lobby.id }, (err, res_lobby) => {
                    if (parseInt(res_lobby.pot[0]) <= parseInt(res.balance)) {
                        MatchManager.JoinLobby(data, socket, client, mmr)
                    }

                })
            }
            else {
                socket.emit()
            }
        }
    })
}

function ReduceSpecificBalance(client, socket, lobby) {
    collection_user.findOne({ steamId: socket.steamUser.id, }, (err, res_user) => {
        if (err) { console.log(err) }
        if (parseInt(res_user.balance) >= parseInt(lobby.ops[0].pot[0])) {
            var new_balance = parseInt(res_user.balance) - parseInt(lobby.ops[0].pot[0])
            collection_user.updateOne({ steamId: res_user.steamId }, { $set: { balance: new_balance } }, (err, res) => {
                UpdatePlayer(client, socket)
            })
        }
    })
}

function ReduceBalance(client, socket) {
    collection_lobby.findOne({ playerIds: socket.steamUser.id, stage: { $lt: 4 } }, (err, res) => {
        if (err) { console.log(err) }
        collection_user.findOne({ steamId: res.playerIds[0] }, (err, res_user) => {
            if (err) { console.log(err) }
            if (res) {
                var new_balance = parseInt(res_user.balance) - parseInt(res.pot[0])
                collection_user.updateOne({ steamId: res_user.steamId }, { $set: { balance: new_balance } });
            } else { console.log("No creator") }
        })
        collection_user.findOne({ steamId: res.playerIds[1] }, (err, res_user) => {
            if (err) { console.log(err) }
            if (res) {
                var new_balance = parseInt(res_user.balance) - parseInt(res.pot[0])
                collection_user.updateOne({ steamId: res_user.steamId }, { $set: { balance: new_balance } });
            } else { console.log("No opponent") }
        })
    })
}

function UpdateItemPrices(request, client) {
    request({
        url: "https://api.csgofast.com/price/all"
    }, function (error, response, body) {
        var x = body.replace("}", "");
        x = x.replace("{", "");
        x = x.split(",");
        var y = [];
        for (var i = 1; i < x.length; i++) {
            y.push(x[i].split(":"));
        }

        var z = []
        for (var i = 1; i < y.length; i++) {
            z.push({ name: y[i][0].replace(/['"]+/g, ""), price: parseInt(y[i][1]) * 1000 });
        }
        var collection = client.db("items").collection("itemPrices");

        collection.remove({});

        collection.insertMany(z, (err, result) => {
            if (err) throw err;

            prices = z;

            console.log("Successfully updated prices")
        });
    });
}

function ReturnPrices() {
    return prices;
}

function UpdateLobbySocket(client, socket) {
    collection_lobby.findOne({ playerIds: socket.steamUser.id, stage: { $lt: 4 } }, (err, res) => {
        if (err) { console.log(err) }
        if (res) {
            socket.emit("current_lobby", { lobby_id: res.id })
            var position = res.playerIds.indexOf(socket.steamUser.id);
            var query = "socketId." + position
            collection_lobby.updateMany({ playerIds: socket.steamUser.id }, { $set: { [query]: socket.id } }, (err, result) => {
                if (err) { console.log(err) }
                if (result) {
                    //UpdatePlayerState(client, socket);
                }
            })
        }
    })
}


function UpdatePlayerSocket(client, socket) {
    var query = { steamId: socket.steamUser.id };
    var newSocketId = { $set: { socketId: socket.id, username: socket.steamUser.displayName, avatars: socket.steamUser.photos[2].value } };
    collection_user.updateOne(query, newSocketId, (err, result) => {
        if (err) throw err;
        UpdateLobbySocket(client, socket);
    });
}


//TODO: Maybe broadcasts all server every second or so instead of after all edits
function BroadcastLobbies(client, socket) {
    var empty = []
    var on_going = []
    collection_lobby.find({ /*["playerIds.0"]: { not: socket.steamUser.id }*/ }).toArray(function (err, result) {
        console.log(result)
        result.forEach((item) => {
            var send_info = { id: item.id, avatars: item.avatars, pot: item.pot, playerNames: item.playerNames, playerIds: item.playerIds, stage: item.stage, maps: item.maps, score: item.score, socketId: item.socketId }
            if (item.stage < 4) {
                item.playerIds.forEach((temp_id) => {
                    try {
                        if (temp_id === socket.steamUser.id) {
                            console.log("Inside IF")
                            socket.emit("in_lobby", item)
                        }
                    }
                    catch (e) {
                        console.log(e)
                        console.log("Inside catch")
                        socket.emit("offline")
                    }

                })
            }
            if (item.stage < 5 && item.stage > 1) {
                on_going.push(send_info)
            }
            else if (item.stage < 2) {
                empty.push(send_info)
            }
        })
        console.log(on_going)
        socket.emit("update_lobbies", { empty: empty, on_going: on_going });

    });
}

function RemoveLobby(client, socket) {
    collection_lobby.findOne({ "playerIds.0": socket.steamUser.id, stage: { $lt: 4 } }, (err, res) => {
        if (res) {
            var pot_increase = res.pot[0]
            for (var i = 0; i < res.playerIds.length; i++) {
                if (res.playerIds[i].length > 0) {
                    collection_user.updateOne({ steamId: res.playerIds[i] }, { $inc: { balance: pot_increase } })
                    UpdatePlayer(client, socket)
                }
            }
            collection_lobby.remove({ _id: res._id }, (err, res) => {
                if (err) { console.log(err) }
                BroadcastLobbies(client, socket)
            })
        }
        else {
            socket.emit("alert", "Can't delete lobby that isn't yours")
        }
    })
}
