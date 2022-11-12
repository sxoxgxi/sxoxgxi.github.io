var worldcup = new Date("Nov 20, 2022 21:45:00").getTime();
var x = setInterval(function() {
var now = new Date().getTime();
var diffe = worldcup - now;
var days = Math.floor(diffe / (1000 * 60 * 60 * 24));
var hours = Math.floor((diffe % (1000 * 60 * 60 * 24))/(1000 * 60 * 60));
var minutes = Math.floor((diffe % (1000 * 60 * 60)) / (1000 * 60));
var seconds = Math.floor((diffe % (1000 * 60)) / 1000);

document.getElementById("about").innerHTML = "FIFA World Cup in " + days + "d " 
+ hours + "h " + minutes + "m " + seconds + "s.";
    if (diffe < 0) {
        clearInterval(x);
        document.getElementById("about").innerHTML = "Victory to Portugal.";
    }
}, 1000);