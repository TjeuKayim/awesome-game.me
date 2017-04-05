# Pong-Arcade
from awesome_game.game_framework import Game_super
class Game(Game_super):
    game_info = {
      'naam_spel' : 'Pong Arcade',
      'omschrijving' : '9 punten, dan heb je gewonnen. Maar ben jij sneller bij de 9 dan jouw tegenstander? Zie hieronder de te kloppen scores!' ,
      'url' : 'pong-arcade',
    }
    def goal(self, ws_id, message):
        score = super().goal(ws_id, message)
        if score == 9:
            self.game_over()