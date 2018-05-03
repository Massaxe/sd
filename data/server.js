const fs = require('fs');
const util = require('util');

const gameServers = {
    fileStart: "/home/steam/Steam/cs_go/csgo/StartMatchInfo.txt",
    ip: "159.89.23.75"
}

var check_server

var check_start

var collection_lobby
var collection_user;

function StartInterval(client, mio) {
    check_start = setInterval(() => {
        collection_lobby = client.db("skinduel").collection("lobbies")
        collection_user = client.db("skinduel").collection("users")
        StartCheck(client, mio);
    }, 2000)
}

function StartMatch(lobby, team1, team2, map, socket) {
    //ServerCheck(lobby, team1, team2, map, socket);
    check_server = setInterval(() => {
        ServerCheck(lobby, team1, team2, map, socket);
    }, 2000)
}

function ServerCheck(lobby, team1, team2, map, socket) {
    var itemsProcessed = 0;
    var info = lobby.id + " " + lobby.playerIds[0] + " " + lobby.playerIds[1] + " " + team1 + " " + team2 + " " + map
    fs.readFile(gameServers.fileStart, "ascii", (err, data) => {
        if (data.length < 1) {
            fs.writeFile(gameServers.fileStart, info, function (err) {
                if (err) throw err;
            });
            clearInterval(check_server);
        }
        else {
            if (socket.id === lobby.socketId[0]) {
                socket.emit("alert", "All servers full. Wait bich")
                socket.to(lobby.socketId[1]).emit("alert", "All servers full. Wait bich")
            }
            else {
                socket.emit("alert", "All servers full. Wait bich")
                socket.to(lobby.socketId[0]).emit("alert", "All servers full. Wait bich")
            }
        }
    })
}

function StartCheck(client, mio) {
    fs.readFile(gameServers.fileStart, "ascii", (err, data) => {
        if (data.length < 30 && data.length > 0) {
            var info = data.split(" ")
            var query = { "id": info[0] }
            var ip = "159.89.23.75:" + info[1]
            collection_lobby.updateOne(query, { $set: { ip: ip } }, (err, res) => {
                console.log(query)
                console.log(info)
                console.log(info[1])

                var ip = "159.89.23.75:" + info[1]
                mio.to(info[0]).emit("ip", ip);
                fs.writeFile(gameServers.fileStart, '', () => { console.log('done') })
            })
        }
    })
}

//TODO: Reasoning behind score
//TODO: Give players a notification with the amount won and score
function FinishedGames(client) {
    var read = ""
    var lobbies_done = []
    var lobbies_id = []
    setInterval(() => {
        fs.readFile("/home/steam/Steam/cs_go/csgo/EndMatchInfo.txt", "ascii", (err, data) => {
            if (err) { console.log(err) }

            if (data.length > read.length) {
                read = data
                var file_split = data.split(",")
                file_split.forEach((el) => {
                    var line_split = el.split(" ")
                    var lobby = {
                        id: line_split[0],
                        id_p1: line_split[1],
                        id_p2: line_split[2],
                        score_p1: line_split[3],
                        score_p2: line_split[4]
                    }
                    lobbies_done.push(lobby)
                    lobbies_id.push(lobby.id)
                })
                collection_lobby.find({ stage: 3, id: { $in: lobbies_id } }).toArray(function (err, result) {
                    result.forEach((el) => {
                        var file_lobby = lobbies_done.find(x => x.id === el.id)
                        OnResult(client, file_lobby)
                    });
                });
            }
            else { read = data }
        });
    }, 2000)
}

function OnResult(client, result) {
    if (parseInt(result.score_p1) > parseInt(result.score_p2)) {
        GiveBalance(client, result.id_p1, result)
    }
    else if (parseInt(result.score_p1) === parseInt(result.score_p2)) {
        GiveBalance(client, null, result)
    }
    else {
        GiveBalance(client, result.id_p2, result)
    }
}

function GiveBalance(client, winner, result) {

    if (winner) {
        collection_user.findOne({ steamId: winner }, (err, res) => {
            if (res) {
                var updatedBalance
                collection_lobby.findOne({ id: result.id, stage: 3 }, (err, res2) => {
                    CloseLobby(res2)
                    updatedBalance = parseInt(res.balance) + parseInt(res2.pot[0]) + parseInt(res2.pot[1])
                    collection_user.updateOne({ steamId: winner }, { $set: { balance: updatedBalance } }, (err, res) => { })
                })
            }
        })
    }
    else {
        collection_lobby.findOne({ id: result.id, stage: 3 }, (err, res2) => {
            CloseLobby(res2)
            collection_user.findOne({ steamId: result.id_p1 }, (err, res) => {
                if (res) {
                    var updatedBalance
                    updatedBalance = parseInt(res.balance) + parseInt(res2.pot[0])
                    collection_user.updateOne({ steamId: result.id_p1 }, { $set: { balance: updatedBalance } }, (err, res) => { })
                }
            })
            collection_user.findOne({ steamId: result.id_p2 }, (err, res) => {
                if (res) {
                    var updatedBalance
                    updatedBalance = parseInt(res.balance) + parseInt(res2.pot[0])
                    collection_user.updateOne({ steamId: result.id_p2 }, { $set: { balance: updatedBalance } }, (err, res) => { })
                }
            })
        })
    }
}

function CloseLobby(result) {
    collection_lobby.updateOne({ id: result.id, stage: 3 }, { $set: { stage: 4, score: [result.score_p1, result.score_p2], ip: "" } })
}

module.exports = {
    StartMatch,
    FinishedGames,
    StartInterval
}

