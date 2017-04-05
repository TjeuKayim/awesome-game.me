// --------- WebSocket connection -----------
var socket = io.connect('https://www.awesome-game.me/{{ game_info.url }}');
socket.on('connect', function() {
  console.log('WS connected, ws_id (sid): '+socket.id)
  $('#connection-status').text('Wachten op andere speler...')
  //socket.emit('connect ', {data: 'test'})
});
// socket.emit('echo', {data: 'test'})
socket.on('log', function(msg) {
  console.log('log', msg)
  $('#ws-log').append("\nlog " + JSON.stringify(msg,null,2))
});

var beginSpelerPaddle;
var andereSpelerPaddle;
socket.on('room created', function(msg) {
  console.log('room_created', msg)
  var users = $.map(msg.users, function(value, index) {
      if (index != socket.id)
        return [value];
  })
  console.log(users)
  andere_speler = users[0]
  $('#connection-status').text('Je speelt tegen '+andere_speler.nickname)
  var nicknames = [msg.users[msg.links].nickname, msg.users[msg.rechts].nickname]
  console.log(nicknames)
  rechts_of_links = (msg.rechts == socket.id ? 1 : 0)
  console.log('Starting game...')
  Game.random = function(min, max) {
    return (min + (msg.random * (max - min)));
  }
  Game.start('game-canvas', Pong, {
    nicknames : nicknames,
    rechts_of_links : rechts_of_links,
  })
  countdown(3)
  if (msg.rechts == socket.id) {
    beginSpelerPaddle = pong_object.rightPaddle
    andereSpelerPaddle = pong_object.leftPaddle
  } else {
    beginSpelerPaddle = pong_object.leftPaddle
    andereSpelerPaddle = pong_object.rightPaddle
  }
  $('html, body').stop().animate({
      scrollTop: $("#game-canvas").offset().top
  }, 500);
})

var countdown = function (n) {
  console.log('Countdown: '+n)
  pong_object.menu.countdown = n
  if (n != 0)
    setTimeout(countdown.bind(null, --n), 1000)
  else
    pong_object.start(2)
}

// ----- Pijltjestoetsen triggers ------
function arrow_press(key) {
  if (key == 'up') {
    socket.emit('arrow_press_send', {key: 'up', pos: beginSpelerPaddle.y})
    beginSpelerPaddle.stopMovingDown()
    beginSpelerPaddle.moveUp()
    //console.log('up')
  } else if (key == 'down') {
    socket.emit('arrow_press_send', {key: 'down', pos: beginSpelerPaddle.y})
    beginSpelerPaddle.stopMovingUp()
    beginSpelerPaddle.moveDown()
    //console.log('down')
  } else if (key == 0) {
    socket.emit('arrow_press_send', {key: 0, pos: beginSpelerPaddle.y})
    beginSpelerPaddle.stopMovingDown()
    beginSpelerPaddle.stopMovingUp()
    //console.log('released')
  }
}
var arrow_up = 0
var arrow_down = 0
$(document).keydown(function(e){
  if (e.which ==38 || e.which == 40) {
    e.preventDefault()
  }
  if (e.which == 38 && arrow_up == 0) {
    arrow_press("up")
    arrow_up = 1
  } else if (e.which == 40 && arrow_down == 0) {
    arrow_press("down")
    arrow_down = 1
  }
})
$(document).keyup(function(e){
  if (e.which == 38) { 
    e.preventDefault()
    arrow_up = 0
  } else if (e.which == 40) {
    e.preventDefault()
    arrow_down = 0
  }
  if ((e.which == 38 || e.which == 40) && arrow_up == 0 && arrow_down ==0) {
    arrow_press(0)
  }
})

socket.on('arrow_press', function(msg) {
  //console.log('arrow_press', msg['key'], msg.pos)
  //$('#ws-log').append("\narrow_press " + msg['key'])
  andereSpelerPaddle.setpos(andereSpelerPaddle.x, msg.pos)
  set_paddle_dir(msg.key)
})

socket.on('final_position', function(msg) {
  //console.log('final_position', msg.key, msg.pos)
  //$('#ws-log').append("\nfinal_position " + msg['key'])
  //pong_object.ball.setpos(msg.ball.x, msg.ball.y)
  //pong_object.ball.setdir(msg.ball.dx, msg.ball.dy)
  andereSpelerPaddle.setpos(andereSpelerPaddle.x, msg.paddle)
  set_paddle_dir(msg.key)
  pong_object.runner.start()
})

socket.on('goal', function(msg) {
  pong_object.goal(1 - rechts_of_links)
})

function set_paddle_dir(key) {
  if (key == 'up') {
    andereSpelerPaddle.stopMovingDown()
    andereSpelerPaddle.moveUp()
  } else if (key == 'down') {
    andereSpelerPaddle.stopMovingUp()
    andereSpelerPaddle.moveDown()
  } else if (key == 0) {
    andereSpelerPaddle.stopMovingDown()
    andereSpelerPaddle.stopMovingUp()
  }
}


