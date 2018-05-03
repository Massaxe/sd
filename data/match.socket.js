module.exports = {
    Main,
    JoinLobby
}

const url = require('url');
var config = require("../data/socket.io.config.js")
var ServerManager = require("./server.js");

var collection_lobbies;
var collection_users;


//Add all game ids to player document in DB

function Main(server, io) {

    var MongoClient = require('mongodb').MongoClient;
    var session = require("../app.js").session;
    var sharedsession = require("express-socket.io-session");
    var mio = io.of("/match").use(sharedsession(session))




    var uri = "mongodb://localhost";
    var body;

    MongoClient.connect(uri, (err, client) => {
        if (err) throw err;

        ServerManager.StartInterval(client, mio);

        collection_user = client.db("skinduel").collection("users");
        collection_lobby = client.db("skinduel").collection("lobbies");

        mio.on("connection", (socket) => {
            var user;

            var url = socket.handshake.headers.referer
            var arrUrl = url.split("/")

            




            try { user = socket.handshake.session.passport.user }
            catch (e) { console.log(e) }

            console.log(arrUrl)

            collection_lobby.findOne({ id: arrUrl[4] }, (err, res) => {
                if (res) {
                    console.log("Found lobby")
                    //config.BroadcastLobbies(client, socket)
                    socket.emit("match_info", { playerNames: res.playerNames, pot: res.pot, maps: res.maps, score: res.score, avatars: res.avatars, playerIds: res.playerIds })
                    console.log("Match Connect")
                    if (user) {
                        socket.join("match")
                        socket.steamUser = user;
                        config.UpdatePlayerSocket(client, socket)
                        config.UpdateLobbySocket(client, socket)
                        config.UpdatePlayer(client, socket)

                        if (res.playerIds.indexOf(socket.steamUser.id) > -1) {
                            socket.join(arrUrl[4])
                            mio.to(arrUrl[4]).emit("ip", res.ip)


                            socket.on("map_vote", (data) => {
                                config.UpdateLobbySocket(client, socket)
                                MapVoting(client, socket, data, arrUrl[4]);
                            })
                            socket.on("remove_lobby", () => {
                                config.RemoveLobby(client, socket)
                            })
                        }
                    }
                }
            })
        })
    })
    function MapVoting(client, socket, selected, room) {
        var maps_new = []
        collection_lobbies.findOne({ id: room }, (err, res) => {
            if (err) { console.log(err) }
            if (res) {
                if (res.maps.length > 2) {
                    if (res.turn % 2 !== 0 && socket.steamUser.id === res.playerIds[0]) {
                        Vote(client, socket, room, res, selected, false)
                    }
                    else if (res.turn % 2 === 0 && socket.steamUser.id === res.playerIds[1]) {
                        Vote(client, socket, room, res, selected, false)
                    }
                }
                else if (res.maps.length > 1) {
                    if (res.turn % 2 !== 0 && socket.steamUser.id === res.playerIds[0]) {
                        Vote(client, socket, room, res, selected, true)
                    }
                    else if (res.turn % 2 === 0 && socket.steamUser.id === res.playerIds[1]) {
                        Vote(client, socket, room, res, selected, true)
                    }
                }
            }
        })
    }
    //TODO: Can't vote after server restart
    function Vote(client, socket, room, db_res, selected, last_vote) {
        var maps_new = db_res.maps
        var index = maps_new.indexOf(selected)
        if (index > -1) {
            maps_new.splice(index, 1)
            collection_lobbies.updateOne({ id: room }, { $set: { maps: maps_new }, $inc: { turn: 1 } }, (err, res) => {
                mio.to(room).emit("maps", maps_new)
                if (last_vote) {
                    StartMatch(client, socket, maps_new[0])
                    console.log("LastVote: " + maps_new[0])
                }
            })
        }
    }

    function StartMatch(client, socket, map) {
        console.log("StartMatch: " + map)
        //var query = { playerIds: socket.steamUser.id };
        collection_lobbies.findOne({ playerIds: socket.steamUser.id, stage: 2 }, (err, result) => {
            if (err) { console.log(err) }
            if (result) {
                ServerManager.StartMatch(result, "2", "3", result.maps[0], socket);
                collection_lobbies.updateOne({ playerIds: socket.steamUser.id, stage: 2 }, { $set: { stage: 3 } })
            }
        });
    }
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
                    console.log("Join requested")
                    socket.to(res.socketId[0]).emit("joinRequest", { mess: "Someone wants to join you lobby!", name: socket.steamUser.displayName });
                    collection_lobby.updateOne({ id: lobbyData.lobby.id }, { $set: { "socketId.1": socket.id, "playerNames.1": socket.steamUser.displayName, "playerIds.1": socket.steamUser.id, "avatars.1": socket.steamUser.photos[2].value, "pot.1": res.pot[0], stage: 1 } },
                        (err, result) => {
                            if (err) {
                                console.log(err);
                            }
                            config.BroadcastLobbies(client, mmr)
                            setTimeout(() => {
                                config.RemovePlayer(client, socket, mmr, res.id)
                            }, 10000);
                        });
                }
            })
        }
    })
}


