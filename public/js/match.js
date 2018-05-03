var socket = io("/match");

var v_match = new Vue({
    el: ".match",
    data: {
        match_info: {}
    },
    methods: {
        RemoveLobby: () => {
            socket.emit("remove_lobby")
            window.location.href = "/"
        }
    }
})

socket.on("match_info", (match) => {
    v_match.match_info = match;
    console.log(v_match.match_info)
})
