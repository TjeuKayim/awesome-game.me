import sys, os
from flask import Flask
from flask_login import current_user
from werkzeug.contrib.fixers import ProxyFix

app = Flask(__name__, static_url_path='/static')
app.wsgi_app = ProxyFix(app.wsgi_app)

db_path = os.path.join(os.path.dirname(__file__), 'app.db')
db_uri = 'sqlite:///{}'.format(db_path)
app.config['SQLALCHEMY_DATABASE_URI'] = db_uri

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'x09dV#sk>_Dsd7/f230fjhS'

from awesome_game.database import *
with app.app_context():
    db.create_all()
    db.session.commit()

from awesome_game.google_login import login_manager

''' ======================= Games ============================== '''
# De superklasse `Game_super`
from awesome_game.game_framework import Game_super, socketio

# Laad de gekozen games in (games/__init__.py bevat de lijst met games)
from awesome_game.games import Games

game_dropdown = [{
        'caption' : g.game_info['naam_spel'],
        'href' : g.game_info['url'],
    } for g in Games]
@app.context_processor
def add_game_dropdown():
    return dict(game_dropdown=game_dropdown)

# Update de tabel Enabled_games 
with app.app_context():
    for g in Games:
        naam_spel = g.game_info['naam_spel']
        row = Enabled_games.query.filter_by(directory=g.path).first()

        if row is None:
            row = Enabled_games(
                naam_spel = g.game_info['naam_spel'],
                directory = g.path,
            )
            db.session.add(row)
            db.session.commit()
        elif row.naam_spel != naam_spel:
            row.naam_spel = naam_spel
            db.session.commit()
        g.game_id = row.game_id

''' ====== views ====== '''
import awesome_game.views

''' ============= Run en setup ===================== '''
if __name__ == "__main__":
    if "--setup" in sys.argv:
        with app.app_context():
            db.create_all()
            db.session.commit()
            print("Database tables created")
    else:
        #app.run(host='0.0.0.0',port=8000,debug=True,use_reloader=True)
        socketio.run(app, debug=True)
# fae@f8iu_D7du
