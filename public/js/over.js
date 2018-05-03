var v_load_cloak = new Vue({
    el: ".load_cloak",
    data: {
        loaded: false
    }
})

var v_sub_nav = new Vue({
    el: ".sub_nav",
    data: {
        steam_id: "",
        player_balance: null
    }
})

socket.on("connect", () => {
    OnConnect();
})
socket.on("update_player", (player_data) => {
    UpdatePlayer(player_data);
})

function UpdatePlayer(player_data) {
    v_sub_nav.player_balance = player_data.balance;
    Vue.prototype.$global_balance = player_data.balance;
    v_sub_nav.steam_id = player_data.steam_id;
    Vue.prototype.$global_steam_id = player_data.steam_id;
}

function OnConnect() {
    console.log("Connected");

    anime({
        targets: ".load_cloak",
        opacity: 0,
        duration: 250,
        complete: () => {
            v_load_cloak.loaded = true;
        },
        easing: 'linear'
    });


}