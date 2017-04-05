# Pong-Score
from awesome_game.game_framework import Game_super
class Game(Game_super):
    game_info = {
      'naam_spel' : 'Pong Score',
      'omschrijving' : '2 spelers, 1 balletje en 1 kans op overwinning. Dit is een test van pure skill. Degene die scoort is de winnaar! Hoelang hou jij het vol? Zie hieronder de te kloppen scores!',
      'url' : 'pong-score',
    }
    def goal(self, ws_id, message):
        score = super().goal(ws_id, message)
        if score == 1:
            self.game_over()