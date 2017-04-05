import importlib
# Gebruikt de volgende games:
modules = [
    'pong_score',
    'pong_arcade',
    'pong_1min',
    #'pong_endless',
]
Games = []
for m in modules:
    game = importlib.import_module(".%s.server" % m, "awesome_game.games").Game
    
    Games.append(game)
