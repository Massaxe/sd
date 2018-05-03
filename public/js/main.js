var socket = io("/main");

var global_balance = 0;

var v_game = new Vue({
    el: ".game",
    data: {
        lobbies: [],
        steam_id: ""
    },
    methods: {
        RemoveLobby: () => {
            socket.emit("remove_lobby")
            v_current_lobby.seen = false;
        },
        ShowCreateLobby: () => {

            Fade(["#pop_up", ".create_lobby"], 0, 1, () => { }, () => {
                ShowPopUp();
                v_create_lobby.seen = true;
            })


        }
    }
})

var v_create_lobby = new Vue({
    el: ".create_lobby",
    data: {
        amount: 50,
        seen: false
    },
    methods: {
        CreateLobby: () => {
            socket.emit("create_lobby", { amount: v_create_lobby.amount })
            Fade(["#pop_up", ".create_lobby"], 1, 0, HidePopUp, ()=>{})
            //HidePopUp()
        }
    }
})

var v_current_lobby = new Vue({
    el: ".current_lobby",
    data: {
        id: "",
        seen: false
    },
    methods: {
        GoTo: () => {
            Redirect("/match/" + v_current_lobby.id)
        }
    }
})




socket.on("update_lobbies", (lobby_data) => {
    v_game.lobbies = lobby_data.empty
})
socket.on("redirect", (data) => {
    Redirect(data.to)
})
socket.on("current_lobby", (lobby) => {
    Vue.prototype.$global_current_lobby_id = lobby.lobby_id
    v_current_lobby.id = lobby.lobby_id
    v_current_lobby.seen = true
})

function HidePopUp() {
    document.getElementById("pop_up").style.display = "none";
}
function ShowPopUp() {
    document.getElementById("pop_up").style.display = "flex";
}
function Redirect(to) {
    window.location.href = to
}
function Fade(target, from, to, onComplete, onBegin) {
    anime({
        targets: target,
        opacity: [from, to],
        duration: 100,
        complete: onComplete,
        begin: onBegin,
        easing: 'linear'
    });
}
$("#pop_up").click((e) => {
    if (e.target.id == "pop_up") {
        Fade("#pop_up", 1, 0, HidePopUp)
    }
});