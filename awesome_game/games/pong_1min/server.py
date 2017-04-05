# Pong-1min
from awesome_game.game_framework import Game_super, socketio
# from threading import Timer
from flask_socketio import emit

class Game(Game_super):
    game_info = {
      'naam_spel' : 'Pong 1min',
      'omschrijving' : '1 minuut om zo veel mogelijk punten te scoren. Simpel, maar wees snel want die minuut is zo voorbij... Zie hieronder de te kloppen scores!',
      'url' : 'pong-1min',
    }
    def __init__(self, room_id, users):
        super().__init__(room_id, users)
        # t = Timer(5, self.game_over)
        # t.start()
        socketio.start_background_task(target=self.background_thread)
    
    def background_thread(self):
        socketio.sleep(60)
        self.game_over()