# Pong-Arcade
from awesome_game.game_framework import Game_super
class Game(Game_super):
    game_info = {
      'naam_spel' : 'Pong Endless',
      'omschrijving' : 'Tot 99' ,
      'url' : 'pong-endless',
    }
    def goal(self, ws_id, message):
        score = super().goal(ws_id, message)
        if score == 99:
            self.game_over()